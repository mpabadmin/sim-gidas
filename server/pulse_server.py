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
import math
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
        'substances': ['Ketamine', 'Morphine', 'Fentanyl', 'Naloxone', 'Epinephrine', 'Midazolam'], 'supported': {}, 'error': '',
        'hem_cmp': list(engine_mock.LIMB_MAX.keys())}
Engine = engine_mock.MockEngine
if os.environ.get('FORCE_MOCK') != '1':
    try:
        import engine_pulse
        b, ver = engine_pulse.setup()
        Engine = engine_pulse.PulseEngine
        INFO.update(engine='Pulse', version=ver, pulse=True, states=engine_pulse.states(), compounds=engine_pulse.compounds(),
                    substances=engine_pulse.substances(), bin=b, hem_cmp=engine_pulse.hem_compartments())
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
DEAD_KEEP_S = 60  # miręs (negrįžtama būklė) ir atsijungęs – laikomas tik tiek, kad klientas spėtų sužinoti „dead“
MAX_LAG = 3.0  # s modeliavimo: jei variklis lėtesnis už prašomą greitį, skola nekaupiama (kitaip vėliau – šuolis į priekį)

# veiksmų laukų patikra (blogi duomenys neturi nulaužti sesijos gijos ar paduoti NaN/∞ varikliui)
NUM = {'sev': (0.0, 1.0), 'tbsa': (0.0, 1.0), 'ml': (0.0, 5000.0), 'rate': (0.0, 1000.0), 'flow': (0.0, 60.0), 'mg': (0.0, 5000.0),
       'drain': (0.0, 500.0), 'dur': (0.0, 3600.0)}
STR = ('k', 'cmp', 'side', 'sub', 'dev', 'route', 'rhythm', 'id', 'loc')


def num(x, default, lo, hi):
    try:
        f = float(x if x is not None else default)
    except (TypeError, ValueError):
        f = default
    if not math.isfinite(f):
        f = default if math.isnan(f) else (hi if f > 0 else lo)
    return max(lo, min(hi, f))


def clean_act(a):
    """Grąžina (išvalytas veiksmas, '') arba (None, klaidos tekstas)."""
    if not isinstance(a, dict) or not isinstance(a.get('k'), str):
        return None, 'netinkamas veiksmas'
    out = {}
    for k, v in a.items():
        if k in NUM:
            try:
                f = float(v)
            except (TypeError, ValueError):
                return None, f'netinkama reikšmė: {k}'
            if not math.isfinite(f):
                return None, f'netinkama reikšmė: {k}'
            out[k] = max(NUM[k][0], min(NUM[k][1], f))
        elif k in STR:
            if not isinstance(v, (str, int)) or isinstance(v, bool) or len(str(v)) > 64:
                return None, f'netinkama reikšmė: {k}'
            out[k] = str(v)
        elif k == 'open':
            out[k] = bool(v)
    return out, ''


def live_count():
    """Sesijos, kurios skaičiuojasi į MAX_SESSIONS: veikiančios gijos su gyvu pacientu (mirusios / sugedusios CPU nenaudoja)."""
    return sum(1 for x in SESSIONS.values() if not x.stopped and x.alive)


def default_state():
    for s in ('Soldier@0s.json', 'StandardMale@0s.json'):
        if s in INFO['states']:
            return s
    return INFO['states'][0] if INFO['states'] else 'StandardMale@0s.json'


class Session:
    def __init__(self, state, acts, speed, ff=0):
        self.sid = secrets.token_hex(6)
        self.state = state if state in INFO['states'] else default_state()
        self.init_acts = [a for a in acts if isinstance(a, dict)] if isinstance(acts, list) else []
        self.speed = num(speed, 1.0, 0.25, 20.0)
        self.ff = num(ff, 0.0, 0.0, 3600.0)   # „praėjo X s nuo sužeidimo“ – modelis prasukamas prieš pradedant
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

    def apply(self, eng, a):
        a, msg = clean_act(a)
        if a is None:
            return False, msg
        try:
            return eng.apply(a)
        except Exception as ex:  # testinis variklis ar netikėta klaida – sesija tęsiasi
            return False, f'{type(ex).__name__}: {ex}'[:300]

    def run(self):
        try:
            eng = Engine(INFO['version'])
            eng.load(self.state)
            for a in self.init_acts:
                ok, msg = self.apply(eng, a)
                if not ok:
                    self.emit({'t': 'ack', 'id': a.get('id', 'init'), 'ok': False, 'msg': msg, 'simt': 0})
            eng.advance(STEP)
            if self.ff >= STEP:
                t_last = time.monotonic()
                while self.simt < self.ff and not self.stopped:
                    chunk = min(10.0, self.ff - self.simt)
                    if not eng.advance(chunk):
                        self.alive = False
                        break
                    self.simt += chunk
                    if time.monotonic() - t_last >= 1.0:
                        t_last = time.monotonic()
                        self.emit({'t': 'ff', 'done': round(self.simt), 'tot': round(self.ff)})
            self.ready = True
            self.last_v = eng.vitals()
            self.emit({'t': 'started', 'sid': self.sid, 'state': self.state, 'simt': self.simt, 'engine': INFO['engine']})
            wall0, sim0, last_send, sim_sent = time.monotonic(), self.simt, 0.0, self.simt
            while not self.stopped:
                while self.cmds:
                    c = self.cmds.popleft()
                    if c[0] == 'act':
                        ok, msg = self.apply(eng, c[2]) if self.alive else (False, 'pacientas miręs – pradėkite iš naujo')
                        self.emit({'t': 'ack', 'id': c[1], 'ok': ok, 'msg': msg, 'simt': round(self.simt, 1)})
                    elif c[0] == 'speed':
                        wall0, sim0 = time.monotonic(), self.simt
                        self.speed = c[1]
                    elif c[0] == 'skip' and self.alive:
                        # praleisti N s modelio laiko (kuo greičiau), rodant eigą
                        end, t_last = self.simt + c[1], time.monotonic()
                        while self.simt < end and not self.stopped:
                            chunk = min(10.0, end - self.simt)
                            if not eng.advance(chunk):
                                self.alive = False
                                self.last_v = eng.vitals()
                                self.emit({'t': 'vit', 'simt': round(self.simt, 1), 'v': self.last_v, 'alive': False, 'speed': self.speed})
                                self.emit({'t': 'dead', 'simt': round(self.simt, 1)})
                                break
                            self.simt += chunk
                            if time.monotonic() - t_last >= 1.0:
                                t_last = time.monotonic()
                                self.last_v = eng.vitals()
                                self.emit({'t': 'vit', 'simt': round(self.simt, 1), 'v': self.last_v, 'alive': self.alive, 'speed': self.speed, 'skip': round(end - self.simt)})
                        wall0, sim0, last_send = time.monotonic(), self.simt, 0.0
                    elif c[0] == 'pause':
                        self.paused = True
                    elif c[0] == 'run':
                        self.paused = False
                        wall0, sim0 = time.monotonic(), self.simt
                if self.paused or not self.alive:
                    wall0, sim0, last_send = time.monotonic(), self.simt, 0.0
                    time.sleep(0.1)
                    continue
                it0 = time.monotonic()
                target = sim0 + (it0 - wall0) * self.speed
                if target - self.simt > MAX_LAG:  # variklis nespėja – lėtėjame, o ne kaupiame skolą
                    wall0, sim0 = it0, self.simt + MAX_LAG
                    target = sim0
                n = 0
                # riboti ir laiku: lėtas variklis (Pulse ~12x) neturi vėlinti rodiklių siuntimo (kas ~1 s) ir komandų
                while self.simt + STEP <= target and n < 30 and not self.cmds and time.monotonic() - it0 < 0.5:
                    if not eng.advance(STEP):
                        self.alive = False
                        break
                    self.simt += STEP
                    n += 1
                now = time.monotonic()
                if n and now - last_send >= 0.9:
                    eff = (self.simt - sim_sent) / (now - last_send) if last_send else self.speed
                    last_send, sim_sent = now, self.simt
                    self.last_v = eng.vitals()
                    self.emit({'t': 'vit', 'simt': round(self.simt, 1), 'v': self.last_v, 'alive': self.alive, 'speed': self.speed,
                               'eff': round(eff, 1)})
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
                idle = time.time() - s.detached_at if s.detached_at else 0
                if s.stopped or idle > KEEP_S or (idle > DEAD_KEEP_S and not s.alive):
                    s.stopped = True
                    SESSIONS.pop(sid, None)


async def handle_ws(ws):
    if ws.path.rstrip('/') not in ('/ws', ''):
        return
    if TOKEN and not secrets.compare_digest(str(ws.query.get('token', '')).encode(), TOKEN.encode()):
        await ws.send({'t': 'err', 'msg': 'Neteisingas žetonas (token)', 'code': 'auth'})
        await ws.close(4001)
        return
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()
    cur = {'s': None}

    def mine():
        """Šio ryšio sesija; None, jei jos nėra arba ją perėmė kitas ryšys (resume iš naujo lizdo)."""
        s = cur['s']
        if s is not None and s.out is not q:
            cur['s'] = s = None
        return s

    def detach(s):
        if s is not None and s.out is q:  # neatjungti, jei sesiją jau perėmė kitas ryšys
            s.out = None
            s.detached_at = time.time()

    def attach(s):
        old = mine()
        if old is not None and old is not s:
            detach(old)
        s.out, s.loop, s.detached_at = q, loop, None
        cur['s'] = s

    async def pump():
        try:
            while True:
                msg = await q.get()
                await ws.send(msg)
        except wsmod.WSClosed:
            try:
                ws.w.transport.abort()  # siuntimas neįmanomas – nutraukti ir skaitymą
            except Exception:
                pass

    pump_task = asyncio.ensure_future(pump())
    try:
        while True:
            raw = await ws.recv()
            try:
                m = json.loads(raw)
            except Exception:
                continue
            if not isinstance(m, dict):
                continue
            try:
                await on_msg(ws, m, mine, attach, q)
            except wsmod.WSClosed:
                raise
            except Exception as ex:  # bloga žinutė neturi nutraukti ryšio
                traceback.print_exc()
                await ws.send({'t': 'err', 'msg': f'Bloga žinutė: {type(ex).__name__}'})
    except wsmod.WSClosed:
        pass
    finally:
        pump_task.cancel()
        s = mine()
        if s is not None:
            detach(s)
            if not s.ready:  # klientas atsijungė dar negavęs sid – sesijos niekas nebeatkurs
                s.stopped = True
                with LOCK:
                    SESSIONS.pop(s.sid, None)


async def on_msg(ws, m, mine, attach, q):
    t, s = m.get('t'), mine()
    if t == 'hello':
        with LOCK:
            n = live_count()
        await ws.send(dict({'t': 'info', 'sessions': n, 'max': MAX_SESSIONS}, **{k: INFO[k] for k in ('engine', 'version', 'pulse', 'states', 'compounds', 'substances', 'supported', 'hem_cmp')}))
    elif t == 'start':
        ns, busy = None, 0
        with LOCK:
            if s:
                s.stopped = True
                SESSIONS.pop(s.sid, None)
            live = live_count()
            if live >= MAX_SESSIONS:
                busy = live
            else:
                ns = Session(m.get('state'), m.get('acts'), m.get('speed'), m.get('ff'))
                SESSIONS[ns.sid] = ns
        if ns is None:
            await ws.send({'t': 'err', 'msg': f'Serveris užimtas: {busy}/{MAX_SESSIONS} sesijos'})
            return
        attach(ns)
        ns.th.start()
    elif t == 'resume':
        with LOCK:
            rs = SESSIONS.get(str(m.get('sid', '')))
        if rs and not rs.stopped:
            attach(rs)
            if rs.ready:  # dar įkeliama – „started“ atsiųs pati sesijos gija
                await ws.send({'t': 'started', 'sid': rs.sid, 'state': rs.state, 'simt': round(rs.simt, 1), 'resumed': True, 'engine': INFO['engine'], 'paused': rs.paused, 'speed': rs.speed})
                if rs.last_v:
                    await ws.send({'t': 'vit', 'simt': round(rs.simt, 1), 'v': rs.last_v, 'alive': rs.alive, 'speed': rs.speed})
                if not rs.alive:
                    await ws.send({'t': 'dead', 'simt': round(rs.simt, 1)})
        else:
            await ws.send({'t': 'gone', 'sid': m.get('sid')})
    elif not s:
        await ws.send({'t': 'err', 'msg': 'Sesija nepradėta'})
    elif t == 'act':
        if isinstance(m.get('a'), dict):
            s.cmds.append(('act', m.get('id'), m['a']))
        else:
            await ws.send({'t': 'ack', 'id': m.get('id'), 'ok': False, 'msg': 'netinkamas veiksmas', 'simt': round(s.simt, 1)})
    elif t == 'speed':
        s.cmds.append(('speed', num(m.get('x'), 1.0, 0.25, 20.0)))
    elif t == 'skip':
        s.cmds.append(('skip', num(m.get('s'), 300.0, 1.0, 3600.0)))
    elif t in ('pause', 'run'):
        s.cmds.append((t,))
    elif t == 'stop':
        s.stopped = True
        s.out = None  # po „stopped“ nebesiųsti rodiklių
        with LOCK:
            SESSIONS.pop(s.sid, None)
        await ws.send({'t': 'stopped'})


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
             'tbi': {'k': 'tbi', 'sev': 0.7}, 'eff': {'k': 'eff', 'rate': 100}, 'burn': {'k': 'burn', 'tbsa': 0.3},
             'vf': {'k': 'arrest', 'rhythm': 'CoarseVentricularFibrillation'}, 'htx': {'k': 'htx', 'side': 'L', 'sev': 0.6},
             'tube': {'k': 'tube', 'side': 'L'}, 'bronch': {'k': 'bronch', 'sev': 0.6}, 'asthma': {'k': 'asthma', 'sev': 0.6},
             'stress': {'k': 'stress', 'sev': 0.6}, 'pain': {'k': 'pain', 'sev': 0.7, 'loc': 'LeftLeg'}, 'cric': {'k': 'cric'}}
    for k, a in tests.items():
        try:
            e = Engine(INFO['version'])
            e.load(default_state())
            ok, msg = e.apply(a)
            if ok and k == 'ndc':
                e.apply({'k': 'tpx', 'side': 'L', 'sev': 0.6})
            if ok and k == 'tube':
                e.apply({'k': 'htx', 'side': 'L', 'sev': 0.6})
            if ok and k == 'cric':
                e.apply({'k': 'aw', 'sev': 0.8})
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
            n = live_count()
        return j({'ok': True, 'engine': INFO['engine'], 'version': INFO['version'], 'sessions': n, 'max': MAX_SESSIONS})
    if path == '/info':
        return j({k: v for k, v in INFO.items() if k != 'bin'})
    if path == '/selftest':
        if TOKEN and not secrets.compare_digest(str(query.get('token', '')).encode(), TOKEN.encode()):
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
