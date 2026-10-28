'use strict';
// ───────── SIM – nuotolinis valdymas per internetą (MQTT per WebSocket, vieši brokeriai) ─────────
// Monitorius ir instruktorius jungiasi prie to paties kambario kodo; žinutės eina per viešą MQTT brokerį,
// todėl nereikia bendro Wi-Fi ir neveikia Wi-Fi klientų izoliacija ar NAT. Siunčiami tik treniruotės rodikliai.
// Jungiamasi prie kelių brokerių vienu metu – žinutės siunčiamos per visus, dublikatai atmetami.
const RELAY = (() => {
  // [adresas, naudotojas, slaptažodis]. SIM_BROKERS – tik testams.
const BROKERS = window.SIM_BROKERS || [['wss://broker.hivemq.com:8884/mqtt'], ['wss://broker.emqx.io:8084/mqtt']];
  const PRE = 'lt1040sim/v1/';
  const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let role = '', room = '', conns = [], onMsg = null, onState = null, state = 'off', peerT = 0, tick = 0, hb = 0;
  const seen = new Set(), seenQ = [];
  const te = new TextEncoder(), td = new TextDecoder();
  const newRoom = () => { const a = new Uint32Array(6); crypto.getRandomValues(a); return Array.from(a, x => AL[x % AL.length]).join(''); };
  const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const valid = c => /^[A-Z0-9]{6}$/.test(norm(c));
  // ── MQTT 3.1.1 paketai ──
  function vlen(n) { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; }
  const str = s => { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const pkt = (h, body) => new Uint8Array([h, ...vlen(body.length), ...body]);
  const pConnect = (id, u, p) => pkt(0x10, [...str('MQTT'), 4, u ? 0xC2 : 0x02, 0, 30, ...str(id), ...(u ? [...str(u), ...str(p || '')] : [])]);
  const pSub = (pid, topic) => pkt(0x82, [pid >> 8, pid & 255, ...str(topic), 0]);
  const pPub = (topic, payload) => pkt(0x30, [...str(topic), ...te.encode(payload)]);
  const PING = new Uint8Array([0xC0, 0]);
  function connect(i) {
    const B = [].concat(BROKERS[i]), c = { url: B[0], user: B[1], pass: B[2], ws: null, ok: false, buf: new Uint8Array(0), retry: 0, timer: 0, ping: 0 };
    conns[i] = c; open(c); return c;
  }
  function open(c) {
    if (!role) return;
    let ws; try { ws = new WebSocket(c.url, 'mqtt'); } catch (e) { return later(c); }
    c.ws = ws; ws.binaryType = 'arraybuffer';
    ws.onopen = () => { try { ws.send(pConnect('sim' + Math.random().toString(36).slice(2, 12), c.user, c.pass)); } catch (e) {} };
    ws.onmessage = e => { const d = new Uint8Array(e.data); const b = new Uint8Array(c.buf.length + d.length); b.set(c.buf); b.set(d, c.buf.length); c.buf = b; parse(c); };
    ws.onclose = ws.onerror = () => { if (c.ws !== ws) return; c.ok = false; c.ws = null; clearInterval(c.ping); eval_(); later(c); };
  }
  function later(c) { if (!role) return; clearTimeout(c.timer); c.retry = Math.min(c.retry + 1, 6); c.timer = setTimeout(() => open(c), 1500 * c.retry); }
  function parse(c) {
    let b = c.buf;
    while (b.length >= 2) {
      let mul = 1, len = 0, i = 1, byte;
      do { if (i >= b.length) { c.buf = b; return; } byte = b[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (b.length < i + len) break;
      const type = b[0] >> 4, body = b.subarray(i, i + len);
      if (type === 2) { // CONNACK
        if (body[1] === 0) { c.ok = true; c.retry = 0; const topic = PRE + room + (role === 'host' ? '/c' : '/s'); try { c.ws.send(pSub(1, topic)); } catch (e) {} clearInterval(c.ping); c.ping = setInterval(() => { try { c.ws && c.ws.send(PING); } catch (e) {} }, 20000); eval_(); if (role === 'ctrl') send({ c: 'hello' }); }
      } else if (type === 3) { // PUBLISH (QoS 0)
        const tl = (body[0] << 8) | body[1], qos = (b[0] >> 1) & 3, off = 2 + tl + (qos ? 2 : 0);
        recv(td.decode(body.subarray(off)));
      }
      b = b.subarray(i + len);
    }
    c.buf = b.slice();
  }
  function recv(txt) {
    let o; try { o = JSON.parse(txt); } catch (e) { return; }
    if (!o || typeof o !== 'object') return;
    if (o.m) { if (seen.has(o.m)) return; seen.add(o.m); seenQ.push(o.m); if (seenQ.length > 300) seen.delete(seenQ.shift()); }
    peerT = Date.now(); eval_();
    if (o.c === 'hello') return;
    if (onMsg) onMsg(o);
  }
  function send(o) {
    if (!role) return false;
    const msg = Object.assign({ m: Math.random().toString(36).slice(2, 10) }, o), topic = PRE + room + (role === 'host' ? '/s' : '/c'), p = pPub(topic, JSON.stringify(msg));
    let n = 0; conns.forEach(c => { if (c && c.ok && c.ws && c.ws.readyState === 1) { try { c.ws.send(p); n++; } catch (e) {} } });
    return n > 0;
  }
  function eval_() {
    const up = conns.some(c => c && c.ok), peer = Date.now() - peerT < (role === 'host' ? 15000 : 4500);
    const s = !role ? 'off' : !up ? 'conn' : peer ? 'on' : 'wait';
    if (s !== state) { state = s; if (onState) onState(s); }
  }
  function start(r, code) {
    stop(true); role = r; room = norm(code).toLowerCase(); peerT = 0; state = '';
    BROKERS.forEach((u, i) => connect(i));
    tick = setInterval(eval_, 1000);
    if (r === 'ctrl') hb = setInterval(() => send({ c: 'hello' }), 5000);
    eval_();
    return norm(code);
  }
  function stop(silent) {
    role = ''; clearInterval(tick); clearInterval(hb);
    conns.forEach(c => { if (!c) return; clearTimeout(c.timer); clearInterval(c.ping); const ws = c.ws; c.ws = null; c.ok = false; if (ws) { try { ws.send(new Uint8Array([0xE0, 0])); } catch (e) {} try { ws.close(); } catch (e) {} } });
    conns = []; if (!silent) { state = 'off'; if (onState) onState('off'); }
  }
  return {
    host: code => start('host', code || newRoom()), join: code => start('ctrl', code), stop, send, valid, norm,
    role: () => role, room: () => room.toUpperCase(), open: () => state === 'on', up: () => conns.some(c => c && c.ok), state: () => state,
    set onMsg(f) { onMsg = f; }, set onState(f) { onState = f; }, _brokers: BROKERS
  };
})();
