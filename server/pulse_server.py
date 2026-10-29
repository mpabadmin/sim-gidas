#!/usr/bin/env python3
"""SIM Pulse serveris – skaičiuoja sužeistojo fiziologiją Kitware Pulse varikliu ir siunčia rodiklius SIM monitoriui.

Paleidimas:  python3 pulse_server.py            (PORT=8080, SIM_TOKEN=slaptas, MAX_SESSIONS=4, FORCE_MOCK=1 – testinis variklis)
HTTP:  GET /health  ·  GET /info  ·  GET /selftest?token=…   WebSocket:  /ws?token=…
Protokolas (JSON):
  klientas → serveris: hello · start{state, acts[], speed} · resume{sid} · act{id, a} · speed{x} · pause · run · stop
  serveris → klientas: info · started{sid, state, simt, resumed} · vit{simt, v, alive} · ack{id, ok, msg, simt} · err{msg} · dead
Veiksmai a.k: hem, hem_stop, inf, inf_stop, o2, o2_off, tpx, ndc, occl, aw, intub, bolus, tbi, eff, burn, arrest
"""
import asyncio
import json
import os
import secrets
import sys
import threading
import time
import traceback
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ws as wsmod  # noqa: E402
import engine_mock  # noqa: E402

PORT = int(os.environ.get('PORT', '8080'))
TOKEN = os.environ.get('SIM_TOKEN', '')
MAX_SESSIONS = int(os.environ.get('MAX_SESSIONS', '4'))
KEEP_S = int(os.environ.get('KEEP_DETACHED_S', '900'))
STEP = 1.0  # modeliuojamas žingsnis, s (Pulse viduje – 0,02 s)

INFO = {'engine': 'Testinis', 'version': engine_mock.MockEngine.version, 'pulse': False, 'states': ['StandardMale@0s.json'],
        'compounds': ['Blood', 'Saline', 'LactatedRingers', 'Plasma', 'PackedRBC'],
        'substances': ['Ketamine', 'Morphine', 'Fentanyl', 'Naloxone', 'Epinephrine', 'Midazolam'], 'supported': {}, 'error': ''}
Engine = engine_mock.MockEngine
if os.environ.get('FORCE_MOCK') != '1':
    try:
        import engine_pulse
        b, ver = engine_pulse.setup()
        Engine = engine_pulse.PulseEngine
        INFO.update(engine='Pulse', version=ver, pulse=True, states=engine_pulse.states(), compounds=engine_pulse.compounds(),
                    substances=engine_pulse.substances(), bin=b)
    except Exception as ex:  # Pulse nėra – testinis variklis
        INFO['error'] = f'{type(ex).__name__}: {ex}'
try:
    INFO['supported'] = Engine(INFO['version']).supported()
except Exception as ex:
    INFO['supported'] = {}
    INFO['error'] += f' | supported: {ex}'
print('SIM Pulse serveris:', json.dumps({k: v for k, v in INFO.items() if k not in ('substances',)}, ensure_ascii=False)[:2000], flush=True)

SESSIONS = {}
LOCK = threading.Lock()


def default_state():
    for s in ('Soldier@0s.json', 'StandardMale@0s.json'):
        if s in INFO['states']:
            return s
    return INFO['states'][0] if INFO['states'] else 'StandardMale@0s.json'


class Session:
    def __init__(self, state, acts, speed):
        self.sid = secrets.token_hex(6)
        self.state = state if state in INFO['states'] else default_state()
        self.init_acts = acts or []
        self.speed = max(0.25, min(20.0, float(speed or 1)))
        self.cmds = deque()
        self.out = None          # asyncio.Queue (prijungtas klientas)
        self.loop = None
        self.paused = False
        self.stopped = False
        self.ready = False
        self.alive = True
        self.simt = 0.0
        self.err = ''
        self.detached_at = None
        self.last_v = None
        self.th = threading.Thread(target=self.run, daemon=True)

    def emit(self, msg):
        q, loop = self.out, self.loop
        if q is not None and loop is not None:
            try:
                loop.call_soon_threadsafe(q.put_nowait, msg)
            except RuntimeError:
                pass

    def run(self):
        try:
            eng = Engine(INFO['version'])
            eng.load(self.state)
            for a in self.init_acts:
                ok, msg = eng.apply(a)
                if not ok:
                    self.emit({'t': 'ack', 'id': a.get('id', 'init'), 'ok': False, 'msg': msg, 'simt': 0})
            eng.advance(STEP)
            self.ready = True
            self.last_v = eng.vitals()
            self.emit({'t': 'started', 'sid': self.sid, 'state': self.state, 'simt': self.simt, 'engine': INFO['engine']})
            wall0, sim0, last_send = time.monotonic(), 0.0, 0.0
            while not self.stopped:
                while self.cmds:
                    c = self.cmds.popleft()
                    if c[0] == 'act':
                        ok, msg = eng.apply(c[2])
                        self.emit({'t': 'ack', 'id': c[1], 'ok': ok, 'msg': msg, 'simt': round(self.simt, 1)})
                    elif c[0] == 'speed':
                        wall0, sim0 = time.monotonic(), self.simt
                        self.speed = c[1]
                    elif c[0] == 'pause':
                        self.paused = True
                    elif c[0] == 'run':
                        self.paused = False
                        wall0, sim0 = time.monotonic(), self.simt
                if self.paused or not self.alive:
                    wall0, sim0 = time.monotonic(), self.simt
                    time.sleep(0.1)
                    continue
                target = sim0 + (time.monotonic() - wall0) * self.speed
                n = 0
                while self.simt + STEP <= target and n < 30 and not self.cmds:
                    if not eng.advance(STEP):
                        self.alive = False
                        break
                    self.simt += STEP
                    n += 1
                now = time.monotonic()
                if n and now - last_send >= 0.9:
                    last_send = now
                    self.last_v = eng.vitals()
                    self.emit({'t': 'vit', 'simt': round(self.simt, 1), 'v': self.last_v, 'alive': self.alive, 'speed': self.speed})
                if not self.alive:
                    self.last_v = eng.vitals()
                    self.emit({'t': 'vit', 'simt': round(self.simt, 1), 'v': self.last_v, 'alive': False, 'speed': self.speed})
                    self.emit({'t': 'dead', 'simt': round(self.simt, 1)})
                if n == 0:
                    time.sleep(0.05)
        except Exception as ex:
            self.err = f'{type(ex).__name__}: {ex}'
            traceback.print_exc()
            self.emit({'t': 'err', 'msg': 'Variklio klaida: ' + self.err})
        finally:
            self.stopped = True


def reaper():
    while True:
        time.sleep(30)
        with LOCK:
            for sid, s in list(SESSIONS.items()):
                if s.stopped or (s.detached_at and time.time() - s.detached_at > KEEP_S):
                    s.stopped = True
                    SESSIONS.pop(sid, None)


async def handle_ws(ws):
    if ws.path.rstrip('/') not in ('/ws', ''):
        return
    if TOKEN and ws.query.get('token') != TOKEN:
        await ws.send({'t': 'err', 'msg': 'Neteisingas žetonas (token)', 'code': 'auth'})
        await ws.close(4001)
        return
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()
    cur = {'s': None}

    def attach(s):
        if cur['s'] and cur['s'] is not s:
            cur['s'].detached_at = time.time()
            cur['s'].out = None
        s.out, s.loop, s.detached_at = q, loop, None
        cur['s'] = s

    async def pump():
        while True:
            msg = await q.get()
            await ws.send(msg)

    pump_task = asyncio.ensure_future(pump())
    try:
        while True:
            raw = await ws.recv()
            try:
                m = json.loads(raw)
            except Exception:
                continue
            t, s = m.get('t'), cur['s']
            if t == 'hello':
                with LOCK:
                    n = sum(1 for x in SESSIONS.values() if not x.stopped)
                await ws.send(dict({'t': 'info', 'sessions': n, 'max': MAX_SESSIONS}, **{k: INFO[k] for k in ('engine', 'version', 'pulse', 'states', 'compounds', 'substances', 'supported')}))
            elif t == 'start':
                ns, busy = None, 0
                with LOCK:
                    if s:
                        s.stopped = True
                        SESSIONS.pop(s.sid, None)
                    live = [x for x in SESSIONS.values() if not x.stopped]
                    if len(live) >= MAX_SESSIONS:
                        busy = len(live)
                    else:
                        ns = Session(m.get('state'), m.get('acts'), m.get('speed'))
                        SESSIONS[ns.sid] = ns
                if ns is None:
                    await ws.send({'t': 'err', 'msg': f'Serveris užimtas: {busy}/{MAX_SESSIONS} sesijos'})
                    continue
                attach(ns)
                ns.th.start()
            elif t == 'resume':
                with LOCK:
                    rs = SESSIONS.get(str(m.get('sid', '')))
                if rs and not rs.stopped:
                    attach(rs)
                    await ws.send({'t': 'started', 'sid': rs.sid, 'state': rs.state, 'simt': round(rs.simt, 1), 'resumed': True, 'engine': INFO['engine'], 'paused': rs.paused, 'speed': rs.speed})
                    if rs.last_v:
                        await ws.send({'t': 'vit', 'simt': round(rs.simt, 1), 'v': rs.last_v, 'alive': rs.alive, 'speed': rs.speed})
                else:
                    await ws.send({'t': 'gone', 'sid': m.get('sid')})
            elif not s:
                await ws.send({'t': 'err', 'msg': 'Sesija nepradėta'})
            elif t == 'act' and isinstance(m.get('a'), dict):
                s.cmds.append(('act', m.get('id'), m['a']))
            elif t == 'speed':
                s.cmds.append(('speed', max(0.25, min(20.0, float(m.get('x', 1))))))
            elif t in ('pause', 'run'):
                s.cmds.append((t,))
            elif t == 'stop':
                s.stopped = True
                with LOCK:
                    SESSIONS.pop(s.sid, None)
                cur['s'] = None
                await ws.send({'t': 'stopped'})
    except wsmod.WSClosed:
        pass
    finally:
        pump_task.cancel()
        if cur['s']:
            cur['s'].out = None
            cur['s'].detached_at = time.time()


def selftest():
    """Įkelia būseną ir išbando kiekvieną veiksmą atskirame variklyje (5 s modeliavimo)."""
    res = {'engine': INFO['engine'], 'version': INFO['version'], 'state': default_state(), 'error': INFO['error'], 'actions': {}}
    t0 = time.time()
    try:
        e = Engine(INFO['version'])
        e.load(default_state())
        e.advance(2)
        res['baseline'] = e.vitals()
        res['load_s'] = round(time.time() - t0, 2)
        t1 = time.time()
        e.advance(60)
        res['speed_x'] = round(60 / max(0.001, time.time() - t1), 1)
    except Exception as ex:
        res['load_error'] = f'{type(ex).__name__}: {ex}'
        return res
    tests = {'hem': {'k': 'hem', 'cmp': 'RightLeg', 'sev': 0.6}, 'inf': {'k': 'inf', 'cmp': 'Blood' if 'Blood' in INFO['compounds'] else 'Saline', 'ml': 500, 'rate': 50},
             'o2': {'k': 'o2', 'dev': 'NonRebreatherMask', 'flow': 12}, 'tpx': {'k': 'tpx', 'side': 'L', 'sev': 0.6},
             'ndc': {'k': 'ndc', 'side': 'L'}, 'occl': {'k': 'occl', 'side': 'L'}, 'aw': {'k': 'aw', 'sev': 0.6}, 'intub': {'k': 'intub'},
             'bolus': {'k': 'bolus', 'sub': 'Ketamine' if 'Ketamine' in INFO['substances'] else 'Morphine', 'mg': 25},
             'tbi': {'k': 'tbi', 'sev': 0.7}, 'eff': {'k': 'eff', 'rate': 10}, 'burn': {'k': 'burn', 'tbsa': 0.3}}
    for k, a in tests.items():
        try:
            e = Engine(INFO['version'])
            e.load(default_state())
            ok, msg = e.apply(a)
            if ok and k == 'ndc':
                e.apply({'k': 'tpx', 'side': 'L', 'sev': 0.6})
            e.advance(30)
            v = e.vitals()
            res['actions'][k] = {'ok': bool(ok), 'msg': msg, 'v30': v}
        except Exception as ex:
            res['actions'][k] = {'ok': False, 'msg': f'{type(ex).__name__}: {ex}'}
    res['total_s'] = round(time.time() - t0, 1)
    return res


async def handle_http(path, query):
    j = lambda o, st='200 OK': (st, 'application/json; charset=utf-8', json.dumps(o, ensure_ascii=False, indent=1).encode())
    if path in ('/', '/health'):
        with LOCK:
            n = sum(1 for x in SESSIONS.values() if not x.stopped)
        return j({'ok': True, 'engine': INFO['engine'], 'version': INFO['version'], 'sessions': n, 'max': MAX_SESSIONS})
    if path == '/info':
        return j({k: v for k, v in INFO.items() if k != 'bin'})
    if path == '/selftest':
        if TOKEN and query.get('token') != TOKEN:
            return j({'error': 'token'}, '403 Forbidden')
        return j(await asyncio.get_running_loop().run_in_executor(None, selftest))
    return j({'error': 'not found'}, '404 Not Found')


async def main():
    threading.Thread(target=reaper, daemon=True).start()
    srv = await wsmod.serve('0.0.0.0', PORT, handle_ws, handle_http)
    print(f'Klausoma :{PORT} · variklis {INFO["engine"]} {INFO["version"]} · žetonas {"nustatytas" if TOKEN else "NENUSTATYTAS"}', flush=True)
    async with srv:
        await srv.serve_forever()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'selftest':
        print(json.dumps(selftest(), ensure_ascii=False, indent=1))
    else:
        asyncio.run(main())
