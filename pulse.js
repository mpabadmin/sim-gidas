'use strict';
// ───────── SIM ↔ Pulse serveris (Kitware Pulse Physiology Engine) ─────────
// Monitorius (šeimininkas) jungiasi prie serverio WebSocket ryšiu, siunčia Pulse veiksmus ir kas sekundę gauna rodiklius.
// Scenarijaus būsena (aplinka, pacientas, sužalojimai, gydymas, įvykiai) laikoma monitoriuje ir siunčiama instruktoriui
// momentinėje nuotraukoje (status()). Instruktorius ir gydymo grandis siunčia aukšto lygio komandas ({c:'pulse', op, …}),
// kurios čia paverčiamos Pulse veiksmais (žr. pulse-cat.js). Serverio protokolas – server/pulse_server.py.
const PULSE = (() => {
  const KEY = 'sim-pulse';
  const DEF_URL = 'wss://sim-pulse.greenriver-b16085e7.swedencentral.azurecontainerapps.io/ws';   // numatytasis serveris (Azure); keičiamas nustatymuose
  const UNDO_S = 5;                                                                               // kiek sekundžių galima atšaukti veiksmą
  const cfg = () => { const c = Object.assign({ url: '', token: '', sid: '', state: '', eng: 'local' }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })()); if (!c.url) c.url = DEF_URL; return c; };
  const saveCfg = o => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(cfg(), o))); } catch (e) {} };
  const r1 = x => Math.round(x * 10) / 10;
  const mmss = s => { s = Math.max(0, Math.round(+s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

  // ── būsena (monitoriaus pusėje) ──
  let startFn = null;       // nepatvirtintas „start“ (kol serveris neatsiuntė „started“) – kartojamas prisijungus iš naujo
  let ws = null, st = 'off', info = null, simt = 0, speed = 1, paused = false, alive = true, msg = '', lastV = null, retry = 0, wantRun = false, reqId = 0, skipLeft = 0, ffInfo = null;
  const pend = {};          // laukiama serverio atsakymo: id → {n, a, by}
  let SC = null;            // scenarijus: {set, pat, mech, mechN, inj[], inf[], o2, kit, log[], arrest, min, t0}
  let Q = [];               // atšaukiami veiksmai: {uid, n, by, at(ms), o}
  let alog = [];            // pritaikyti Pulse veiksmai komentarams: [{a, t}]
  let hist = [];            // paskutiniai serverio atsakymai
  let onChange = () => {};
  const keep = () => saveCfg({ sc: SC, alog: alog.slice(-80), hist });
  const setSt = (s, m) => { st = s; if (m != null) msg = m; onChange(); };
  const L = (x, kind) => SIM.log(kind || 'mark', x);

  function wsUrl(c) {
    let u = String(c.url || '').trim().replace(/\s+/g, ''); if (!u) return '';
    u = u.replace(/^[a-z]+:\/\//i, x => x.toLowerCase());   // telefono klaviatūra dažnai rašo „Wss://“
    if (/^https?:\/\//.test(u)) u = u.replace(/^http/, 'ws');
    if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
    u = u.replace(/\/ws\/+(\?|$)/, '/ws$1');
    if (!/\/ws(\?|$)/.test(u)) u = u.replace(/\/?(\?|$)/, '/ws$1');
    const tok = String(c.token || '').trim();
    return u + (tok ? (u.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(tok) : '');
  }
  const isLocal = () => cfg().eng !== 'pulse';
  function connect(then) {
    const c = cfg(), u = isLocal() ? 'local' : wsUrl(c);
    if (!u) { setSt('err', 'Pulse serveris nenustatytas (Nustatymai → Pulse serveris)'); return; }
    if (!isLocal() && !String(c.token || '').trim()) { wantRun = false; startFn = null; connect.q = null; setSt('err', 'Pulse serverio žetonas neįvestas – įveskite jį instruktoriaus arba monitoriaus telefone: Nustatymai → Pulse serveris'); return; }
    if (ws && ws.readyState <= 1) { if (then && ws.readyState === 1) then(); else if (then) connect.q = then; return; }
    connect.q = then || connect.q || null;   // pakartotinis bandymas neturi pamesti laukiančios komandos
    if (st !== 'conn') setSt('conn', isLocal() ? 'Paleidžiamas taisyklių modelis…' : 'Jungiamasi prie serverio… (jei jis miegojo – iki 1–2 min.)');
    let opened = false;
    try { ws = isLocal() ? PLOCAL.socket() : new WebSocket(u); } catch (e) { setSt('err', 'Netinkamas serverio adresas'); return; }
    ws.onopen = () => { retry = 0; opened = true; tx({ t: 'hello' }); const q = connect.q; connect.q = null; if (q) q(); else if (wantRun) { const sid = cfg().sid; if (sid) tx({ t: 'resume', sid }); else if (startFn) startFn(); } };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
    ws.onclose = ev => {
      ws = null;
      if (ev.code === 4001) { wantRun = false; startFn = null; connect.q = null; setSt('err', 'Neteisingas Pulse serverio žetonas – patikrinkite: Nustatymai → Pulse serveris'); return; }
      if (wantRun) { retry = Math.min(retry + 1, 6); setSt('conn', opened || /nutrūko/.test(msg) ? 'Ryšys su serveriu nutrūko – jungiamasi iš naujo…' : 'Serveris nepasiekiamas – bandoma dar kartą… (jei jis ką tik paleistas, gali užtrukti 1–2 min.)'); setTimeout(() => { if (wantRun) connect(); }, 1500 * retry); }
      else if (st !== 'err') setSt('off');
    };
  }
  const tx = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
  // Pulse veiksmo siuntimas
  function pa(a, n, by, silent) {
    const id = 'a' + (++reqId) + Date.now().toString(36).slice(-3);
    pend[id] = { n, a, by, silent };
    if (!tx({ t: 'act', id, a })) { delete pend[id]; msg = 'Nėra ryšio su serveriu – veiksmas nepritaikytas'; return false; }
    alog.push({ a, t: simt });
    return true;
  }
  function onMsg(m) {
    switch (m.t) {
      case 'info': info = m; onChange(); break;
      case 'started': saveCfg({ sid: m.sid }); startFn = null; if (SC) SC.on = 1; simt = +m.simt || 0; ffInfo = null; if (m.speed) speed = m.speed; paused = !!m.paused; alive = true; setSt(paused ? 'pause' : 'run', m.resumed ? 'Sesija atkurta' : ''); if (!m.resumed) L(engN() + ': modeliavimas pradėtas' + (simt ? ' (praėjus ' + mmss(simt) + ' nuo sužeidimo)' : '')); if (SC && SC.prep) prepTick(true); break;
      case 'ff': ffInfo = { done: m.done, tot: m.tot }; setSt('load', 'Prasukama iki ' + mmss(m.tot) + ' nuo sužeidimo… ' + Math.round(m.done / Math.max(1, m.tot) * 100) + ' %'); break;
      case 'gone': saveCfg({ sid: '' }); wantRun = false; startFn = null; Q = []; if (SC && SC.on) { SC.end = simt; SC.lost = 1; } keep(); L('Pulse: sesija serveryje nebeegzistuoja'); setSt('off', 'Ankstesnė sesija serveryje nebeegzistuoja (serveris buvo paleistas iš naujo) – monitorius rodo paskutines Pulse reikšmes. Pradėkite iš naujo.'); break;
      case 'vit': {
        simt = +m.simt || simt; if (m.speed) speed = m.speed; skipLeft = m.skip || 0; alive = m.alive !== false; lastV = m.v || lastV;
        applyVitals(m.v || {}, alive);
        if (SC && SC.prep) { if (!m.skip) prepTick(); onChange(); break; }
        if (SC) {
          scenTick(m.v || {});
          if (!SC.vh) SC.vh = [];
          const lh = SC.vh[SC.vh.length - 1], vv = m.v || {};
          if (!lh || simt - lh[0] >= 30) { SC.vh.push([Math.round(simt), vv.hr, vv.sys, vv.spo2, vv.rr, vv.temp]); if (SC.vh.length > 600) SC.vh.shift(); }
          SC.inf = SC.inf.filter(a => simt - a.t0 < a.tot + 20);
          const v = m.v || {};
          if (SC.bv0 == null && v.bv) SC.bv0 = v.bv;
          if (v.sys != null && v.hr > 20) SC.min.sys = Math.min(SC.min.sys, v.sys);
          if (v.spo2 != null && v.hr > 20) SC.min.spo2 = Math.min(SC.min.spo2, v.spo2);
          if (typeof PULSE_CM !== 'undefined') PULSE_CM.evaluate(v, alog, { t: simt, live: alive, hems: SC.inj.filter(j => j.k === 'bleed' && isBleeding(j)).map(j => j.loc) }).forEach(c => L('Pulse komentaras: ' + c.title, 'sys'));
        }
        if (!alive && st !== 'dead') setSt('dead', 'Modeliuojamas pacientas mirė – pradėkite iš naujo'); else onChange();
        break;
      }
      case 'ack': {
        const p = pend[m.id]; delete pend[m.id];
        if (!p) break;
        hist.unshift({ n: p.n, ok: m.ok, t: m.simt, e: m.msg || '', by: p.by }); hist = hist.slice(0, 8);
        if (!m.ok && !p.silent) L('Pulse: nepavyko – ' + p.n + (m.msg ? ' (' + m.msg.slice(0, 70) + ')' : ''));
        keep(); onChange(); break;
      }
      case 'dead': { alive = false; const c = cfg(); if (c.deadSid && c.deadSid === c.sid) { setSt('dead', 'Modeliuojamas pacientas mirė – pradėkite iš naujo'); break; } saveCfg({ deadSid: c.sid }); }
        L('Pulse: negrįžtama būklė (mirtis) – ' + mmss(m.simt)); setSt('dead', 'Modeliuojamas pacientas mirė – pradėkite iš naujo'); break;
      case 'stopped': if (st !== 'err') setSt('off'); break;
      case 'err': if (m.code === 'auth') { wantRun = false; startFn = null; } setSt(wantRun ? st : 'err', m.msg || 'Serverio klaida'); if (/užimtas|Variklio/.test(m.msg || '')) { wantRun = false; startFn = null; setSt('err', m.msg); } break;
    }
  }
  // Pulse rodikliai → monitorius (1,2 s sklandus perėjimas)
  function applyVitals(v, live) {
    const t = {};
    ['hr', 'sys', 'dia', 'rr', 'temp'].forEach(k => { if (v[k] != null && isFinite(v[k])) t[k] = Math.round(v[k] * (k === 'temp' ? 10 : 1)) / (k === 'temp' ? 10 : 1); });
    if (v.spo2 != null && isFinite(v.spo2)) t.spo2 = Math.round(Math.max(40, Math.min(100, v.spo2)));
    const map = v.map != null ? v.map : t.dia != null && t.sys != null ? t.dia + (t.sys - t.dia) / 3 : 80;
    const r0 = SIM.state().rhythm;
    let r = r0;
    if (SC && SC.arrest === 'vf' && (t.hr || 0) < 5) r = 'vf';
    else if (!live || ((t.hr || 0) < 5 && map < 20)) r = 'asys';
    else if (map < 20) r = 'pea';
    else if (['asys', 'pea', 'vf'].indexOf(r0) >= 0) r = 'sinus';
    if (r !== r0) SIM.setRhythm(r);
    SIM.apply(t, 1.2);
  }

  // ── scenarijaus pagalbinės ──
  const isBleeding = j => ['bleeding', 'rebleed', 'tq_loose'].indexOf(j.state) >= 0;
  const injById = id => SC && SC.inj.find(j => j.id === id);
  const firstState = k => k === 'bleed' ? 'bleeding' : 'active';
  function newInj(j, t) {
    const x = { id: 'i' + (++reqId), k: j.k, sev: +j.sev, state: firstState(j.k), t0: t, h: [] };
    if (j.loc) x.loc = j.loc; if (j.side) x.side = j.side;
    ['key', 'lbl', 'note', 'wound'].forEach(k => { if (j[k] != null) x[k] = j[k]; });
    return x;
  }
  const iname = j => { const n = PCAT.injName(j); return n.name + (n.sev ? ' (' + n.sev.toLowerCase() + ')' : ''); };
  const recE = (n, by, x) => rec(n, by, Object.assign({ kind: 'ev' }, x || {}));
  function rec(n, by, extra) {
    if (!SC) return;
    SC.log.push(Object.assign({ t: Math.round(simt), n, by: by || 'instr', kind: 'tx', ph: SC.ph }, extra || {}));
    if (SC.log.length > 400) SC.log.shift();
    L((by === 'team' ? 'Komanda: ' : by === 'cls' ? '' : engN() + ': ') + n);
  }
  const hpush = (j, txt) => { j.h.push([Math.round(simt), txt]); if (j.h.length > 8) j.h.shift(); };
  function sendInj(j) { const a = PCAT.injAct(j); if (a) pa(a, iname(j), 'instr'); }

  // ── veiksmų vykdymas (po atšaukimo laiko) ──
  function run(o) {
    const by = o.by || 'instr';
    switch (o.op) {
      case 'card': {
        const j = injById(o.iid); if (!j) return;
        if (o.a === 'sevup' || o.a === 'sevdn') return sevStep(j, o.a === 'sevup' ? 1 : -1, by);
        const A = PCAT.cardActions(j, SC.set).find(x => x[0] === o.a); if (!A) return;
        (A[3] || []).forEach(a => pa(a, A[1] + ' – ' + PCAT.injName(j).name, by));
        if (A[2]) j.state = A[2];
        if (o.a === 'seal') j.sealed = simt;
        if (o.a === 'tq' || o.a === 'jtq' || o.a === 'tqre') { j.tqOn = simt; if (j.tq0 == null) j.tq0 = simt; }
        if (o.a === 'tqloose' || o.a === 'tqconv') j.tqOn = null;
        if (j.ctl == null && ['tq', 'jtq', 'pack', 'pdress', 'ndc', 'occl', 'tube', 'htube', 'fthor', 'sga', 'cric', 'ett', 'pos', 'npa', 'pcd'].indexOf(o.a) >= 0) j.ctl = simt;   // pirmoji kontrolė – ataskaitai
        hpush(j, o.n || A[1]); if (!o.silent) rec((o.n || A[1] + ' – ' + PCAT.injName(j).name) + (!isLocal() && PCAT.apx('act:' + o.a) ? ' (≈ apytiksliai: Pulse tokios funkcijos neturi)' : ''), by, { iid: j.id, a: o.a, kind: A[4] === 'team' ? 'tx' : 'ev' });
        // krūtinės drenas – drenuoja visus tos pusės pleuros sužalojimus (pneumotoraksas + hemotoraksas)
        if (o.a === 'tube' || o.a === 'htube') SC.inj.filter(x => x !== j && x.side === j.side && ['ptx', 'optx', 'htx'].indexOf(x.k) >= 0 && x.state !== 'drained').forEach(x => {
          const B = PCAT.cardActions(x, SC.set).find(y => y[0] === 'tube' || y[0] === 'htube'); if (!B) return;
          (B[3] || []).forEach(a => pa(a, B[1] + ' – ' + PCAT.injName(x).name, by)); x.state = 'drained'; if (x.ctl == null) x.ctl = simt; hpush(x, B[1]);
        });
        break;
      }
      case 'inj': {
        const j = newInj(o.j, simt); SC.inj.push(j); sendInj(j); hpush(j, 'Atsirado'); rec('Naujas sužalojimas: ' + iname(j) + (PCAT.apx('inj:' + j.k) ? ' (≈ apytiksliai: Pulse tokios funkcijos neturi)' : ''), by, { iid: j.id, kind: 'inj' });
        break;
      }
      case 'tx': return treat(o.code, o.p || {}, by, o.n);
      case 'ev': return event(o.code, o.p || {}, by);
      case 'istop': { const f = SC.inf.find(x => x.cmp === o.cmp); pa({ k: 'inf_stop', cmp: o.cmp, ml: 1 }, 'Infuzija sustabdyta', by); SC.inf = SC.inf.filter(x => x.cmp !== o.cmp); rec('Sustabdyta: ' + (f ? f.n : o.cmp), by); break; }
    }
  }
  function sevStep(j, d, by) {
    const T = PCAT.injBy(j.k) || {}, S = T.sevs || PCAT.SEV;
    let i = S.findIndex(s => Math.abs(s[2] - j.sev) < 1e-6); if (i < 0) i = 1;
    const ni = Math.max(0, Math.min(S.length - 1, i + d)); if (ni === i) { rec((d > 0 ? 'Jau stipriausias: ' : 'Jau silpniausias: ') + iname(j), by, { iid: j.id, kind: 'ev' }); return; }
    j.sev = S[ni][2];
    if (j.k !== 'bleed' || isBleeding(j)) sendInj(j);
    hpush(j, d > 0 ? 'Stipresnis: ' + S[ni][1] : 'Silpnesnis: ' + S[ni][1]); rec((d > 0 ? 'Sustiprinta: ' : 'Susilpninta: ') + iname(j), by, { iid: j.id, kind: 'ev' });
  }
  const ROUTE = { IV: 'IV', IO: 'IV', IM: 'IM', IN: 'IM', OTFC: 'IM' };   // Pulse: į veną arba į raumenį (IO ≈ IV, IN/OTFC ≈ IM)
  function treat(code, p, by, label) {
    switch (code) {
      case 'o2': {
        const D = PCAT.O2DEV.find(d => d[0] === p.dev) || PCAT.O2DEV[0], fl = +p.flow || D[2][0];
        pa({ k: 'o2', dev: D[0], flow: fl }, 'Deguonis ' + fl + ' l/min', by);
        SC.o2 = { dev: D[0], n: D[1], flow: fl, t: simt }; rec('Deguonis: ' + D[1].toLowerCase() + ' ' + fl + ' l/min', by, { code: 'o2' }); break;
      }
      case 'o2off': if (SC.o2) { pa({ k: 'o2_off' }, 'Deguonis nuimtas', by); SC.o2 = null; rec('Deguonis nuimtas', by, { code: 'o2off', kind: by === 'team' ? 'tx' : 'ev' }); } break;
      case 'fluid': {
        const F = PCAT.FLUIDS.find(f => f[0] === p.cmp) || PCAT.FLUIDS[0], ml = +p.ml || 500, rate = Math.max(5, +p.rate || 50), tot = Math.round(ml / rate * 60);
        const n = F[1] + ' ' + ml + ' ml';
        pa({ k: 'inf', cmp: F[0], ml, rate }, n, by);
        SC.inf = SC.inf.filter(x => x.cmp !== F[0]); SC.inf.push({ id: 'f' + (++reqId), cmp: F[0], n, ml, rate, t0: simt, tot });
        if (/Blood|PackedRBC|Plasma/.test(F[0])) { SC.kit.used += ml / 500; if (SC.tBlood == null) SC.tBlood = simt; }
        rec(n + ' (' + rate + ' ml/min, ~' + Math.round(tot / 60) + ' min)' + (!isLocal() && PCAT.apx('fl:' + F[0]) ? ' (≈ modelyje NaCl)' : ''), by, { code: 'fluid', cmp: F[0] }); break;
      }
      case 'drug': {
        const D = PCAT.drugBy(p.id, SC.set); const nm = (D ? D.n : p.id) + ' ' + String(p.dose).replace('.', ',') + ' ' + (p.unit || 'mg') + ' ' + p.route;
        let mg = p.unit === 'mcg' ? p.dose / 1000 : p.unit === 'g' ? p.dose * 1000 : +p.dose;
        if (p.route === 'OTFC') mg = Math.min(mg, 0.1);   // transmukozinis fentanilis – apytiksliai 100 mcg IM
        const loc = isLocal(), sim = !loc && D && D.pulse && ROUTE[p.route] && (!info || !info.substances || info.substances.indexOf(D.pulse) >= 0) && p.unit !== 'ml';
        if (sim) pa({ k: 'bolus', sub: D.pulse, mg, route: ROUTE[p.route] }, nm, by);
        if (loc) pa({ k: 'drug', id: p.id, mg, route: p.route }, nm, by, true);
        if (D && D.id === 'txa' && SC.tTxa == null) SC.tTxa = simt;
        rec(nm + (loc ? '' : sim ? (PCAT.apx('drug:' + p.id) || PCAT.apx('route:' + p.route) ? ' (≈ apytiksliai)' : '') : ' (tik žurnale – Pulse šio vaisto neturi)'), by, { code: 'drug', id: p.id }); break;
      }
      default: {
        const it = PCAT.TX.flatMap(g => g[2]).find(i => i[0] === code), ty = (it && it[4]) || code;   // daviklių kodai – katalogo 5-ame lauke (probe:ecg:1)
        if (/^probe:/.test(ty)) { const [, k, on] = ty.split(':'); if (typeof exec === 'function') exec({ c: 'probe', k, on: on === '1' }); }
        if (code === 'txa' && SC.tTxa == null) SC.tTxa = simt;
        if (isLocal() && ['hpmk', 'warm', 'bvm', 'vent', 'ett_g'].indexOf(code) >= 0) pa({ k: 'tx', id: code }, label || code, by, true);
        if (code === 'ett_g') {   // intubacija be kvėpavimo takų sužalojimo: jei obstrukcija yra – ją pašalina
          const aw = SC.inj.find(x => x.k === 'aw' && x.state !== 'secured');
          if (aw) return run({ op: 'card', iid: aw.id, a: 'ett', by });
          return rec('Intubacija (RSI)' + (isLocal() ? '' : ' (≈ Pulse ventiliatorius neprijungtas – ventiliaciją sakykite garsiai)'), by, { code });
        }
        rec(label || code, by, { code });
      }
    }
  }
  function event(code, p, by) {
    const firstBy = f => SC.inj.find(f);
    switch (code) {
      case 'tqloose': { const j = p.iid ? injById(p.iid) : firstBy(x => x.state === 'tq'); if (j) run({ op: 'card', iid: j.id, a: 'tqloose', by }); else recE('Atsileido turniketas – turniketo nėra', by); break; }
      case 'retens': { const j = firstBy(x => (x.k === 'ptx' || x.k === 'optx') && (x.state === 'decomp' || x.state === 'occl')); if (j) run({ op: 'card', iid: j.id, a: 'retens', by }); else run({ op: 'inj', j: { k: 'ptx', side: p.side || 'L', sev: 0.45 }, by }); break; }
      case 'vomit': { let j = firstBy(x => x.k === 'aw'); if (j) { j.sev = Math.max(j.sev, 0.55); j.state = 'active'; sendInj(j); hpush(j, 'Vėmimas / aspiracija'); recE('Vėmimas / aspiracija – kvėpavimo takai užsikimšo', by, { iid: j.id }); } else run({ op: 'inj', j: { k: 'aw', sev: 0.55 }, by }); break; }
      case 'o2off': treat('o2off', {}, by); recE('Nukrito deguonies kaukė', by); break;
      case 'ivout': SC.inf.forEach(f => pa({ k: 'inf_stop', cmp: f.cmp, ml: 1 }, 'Infuzija sustabdyta', by)); SC.inf = []; recE('Ištraukta IV / IO – infuzijos sustojo', by); break;
      case 'ecgoff': exec({ c: 'probe', k: 'ecg', on: false }); recE('Atlipo EKG elektrodas', by); break;
      case 'spo2off': exec({ c: 'probe', k: 'spo2', on: false }); recE('Nukrito SpO₂ daviklis', by); break;
      case 'nibpoff': exec({ c: 'probe', k: 'nibp', on: false }); recE('Nuimta AKS manžetė', by); break;
      case 'painup': { const j = firstBy(x => x.k === 'pain'); if (j) sevStep(j, 1, by); else run({ op: 'inj', j: { k: 'pain', sev: 0.8 }, by }); break; }
      case 'vib': { const on = p.on != null ? !!p.on : (!SIM.state().art || !SIM.state().art.motion); exec({ c: 'art', k: 'motion', on }); recE(on ? 'Vibracija – judesio artefaktai' : 'Vibracija baigėsi', by); break; }
      case 'noise': { const mn = +p.min || 10; exec({ c: 'mute', m: mn }); recE('Triukšmas – aliarmai negirdimi ' + mn + ' min', by); break; }
      case 'land': SC.landed = simt; if (SC.ph === 'medevac') { closePh(); SC.ph = 'handover'; } recE('Nusileidimas – perdavimas (MIST)', by); break;
      case 'evac': SC.evacT = simt; recE('Evakuacija į Role 2 atvyko – ATMISTER', by); break;
      case 'vf': case 'asys': pa({ k: 'arrest', rhythm: code === 'vf' ? 'CoarseVentricularFibrillation' : 'Asystole' }, code === 'vf' ? 'Skilvelių virpėjimas' : 'Asistolija', by); SC.arrest = code; SC.tArrest = simt; recE(code === 'vf' ? 'Širdies sustojimas – skilvelių virpėjimas' : 'Širdies sustojimas – asistolija', by); break;
      case 'rosc': pa({ k: 'arrest', rhythm: 'NormalSinus' }, 'ROSC', by); SC.arrest = ''; SIM.setRhythm('sinus'); recE('ROSC – pulsas grįžo', by); break;
      default: recE(code, by);
    }
  }

  // ── scenarijus: priešistorė (prep), planuoti įvykiai, fazės ──
  const engN = () => isLocal() ? 'Modelis' : 'Pulse';
  const SCN = () => SC && SC.scen && typeof PSCEN !== 'undefined' ? PSCEN.get(SC.scen.id) : null;
  function closePh() { const P = SC.phs && SC.phs[SC.phs.length - 1]; if (P && P.t1 == null) P.t1 = Math.round(simt); }
  function runOps(ops, dflBy) {
    (ops || []).forEach(op => {
      const by = op.by || dflBy || 'team';
      if (op.card) { const j = SC.inj.find(x => x.key === op.card); if (j) run({ op: 'card', iid: j.id, a: op.a, by, n: op.n, silent: op.silent }); }
      else if (op.a) pa(op.a, 'scenarijus', 'instr', true);
      else if (op.tx) { const it = PCAT.TX.flatMap(g => g[2]).find(i => i[0] === op.tx); treat(op.tx, {}, by, op.n || (it ? it[1] : op.tx)); }
      else if (op.drug) treat('drug', { id: op.drug, dose: op.dose, unit: op.unit, route: op.route }, by);
      else if (op.fluid) treat('fluid', { cmp: op.fluid, ml: op.ml, rate: op.rate }, by);
      else if (op.o2) treat('o2', { dev: op.o2, flow: op.flow }, by);
      else if (op.ev) event(op.ev, op.p || {}, 'instr');
      else if (op.bank != null) { if (SC.kit) SC.kit.max = Math.ceil(SC.kit.used) + op.bank; }
      else if (op.note) recE(op.note, 'instr');
    });
  }
  // priešistorė ir „tik Role 1“ MEDEVAC dalis: stotelės (veiksmai + įvykiai), tarp jų – modelio prasukimas (skip)
  function prepTick(first) {
    const P = SC.prep; if (!P) return;
    if (!first && simt < P.stops[P.i] - 0.5) { if (P.sent && Date.now() - P.sent > 20000) { P.sent = Date.now(); tx({ t: 'skip', s: Math.max(1, Math.ceil(P.stops[P.i] - simt)) }); } return; }
    while (P.i < P.stops.length && simt >= P.stops[P.i] - 0.5) {
      const T = P.stops[P.i];
      (P.ops[T] || []).forEach(o => runOps(o.ops, o.by));
      if (P.ev) evTick(P.ev, T - (P.evT0 || 0), lastV, P.evT0 || 0);
      P.i++;
    }
    if (P.i >= P.stops.length) { const then = P.then; SC.prep = null; setSt(paused ? 'pause' : 'run', ''); prepDone(then); keep(); return; }
    const d = Math.max(1, Math.ceil(P.stops[P.i] - simt)); P.sent = Date.now();
    skipLeft = d; tx({ t: 'skip', s: d });
    setSt('load', 'Ruošiama: ' + (P.lbl || 'priešistorė') + ' – ' + mmss(simt) + ' iš ' + mmss(P.stops[P.stops.length - 1]));
  }
  function prepDone(then) {
    const S = SCN();
    if (then === 'medevac') { SC.ph = 'medevac'; SC.phs.push({ ph: 'medevac', t0: Math.round(simt) }); recE('MEDEVAC perima sužeistąjį (' + mmss(simt) + ' nuo sužeidimo)', 'instr'); }
    else if (then === 'role1') {
      SC.phs.push({ ph: 'medevac', t0: S ? S.start.medevac : 0, t1: S && S.ev.find(e => e.id === 'land') ? Math.min(Math.round(simt), S.ev.find(e => e.id === 'land').at) : Math.round(simt), pre: 1 });
      toRole1({ skip: 0, reprobe: true, auto: 1 });
    }
  }
  function toRole1(o) {
    closePh();
    if (o.skip > 0) { tx({ t: 'skip', s: o.skip }); skipLeft = o.skip; simt += 0; }
    const t0 = Math.round(simt + (o.skip || 0));
    SC.set = 'role1'; SC.ph = 'role1'; SC.kit = { max: PCAT.SETTINGS.role1.blood, used: 0 }; SC.team2 = !!o.team2; SC.r1t0 = t0;
    SC.phs.push({ ph: 'role1', t0 });
    try { SIM.setLabel(('Role 1 · ' + (SC.mechN || 'Pulse')).slice(0, 40), ''); } catch (e) {}
    if (o.reprobe && typeof exec === 'function') ['ecg', 'spo2', 'nibp'].forEach(k => exec({ c: 'probe', k, on: false }));
    recE('Perduota į Role 1' + (o.skip ? ' (pervežimas ' + Math.round(o.skip / 60) + ' min)' : '') + (o.reprobe ? ' – monitorius: prijunkite daviklius' : ''), 'instr');
    if (typeof PULSE_CM !== 'undefined') PULSE_CM.reset();
  }
  // planuoti įvykiai: rel – laikas nuo fazės pradžios (MEDEVAC – nuo sužeidimo)
  function evTick(list, rel, v, base) {
    list.forEach(e => {
      if (SC.evd[e.id] != null) return;
      if (e.at != null && rel < e.at - 0.5) return;
      try { if (e.when && !e.when(SC, simt, v || lastV || {})) return; } catch (x) { return; }
      SC.evd[e.id] = Math.round(simt);
      if (!e.quiet) recE('Planuotas įvykis: ' + e.n, 'instr');
      runOps(e.ops, 'instr');
    });
  }
  function scenTick(v) {
    const S = SCN(); if (!S || !SC.scen.auto || !SC.evd) return;
    const ph = SC.ph; if (ph !== 'medevac' && ph !== 'role1') return;
    const P = SC.phs[SC.phs.length - 1], base = ph === 'role1' ? P.t0 : 0;
    if (ph === 'role1' && simt < P.t0) return;
    evTick(S.ev.filter(e => e.ph === ph), simt - base, v, base);
  }
  function startScen(o) {
    const S = PSCEN.get(o.scen.id), mode = o.scen.mode || 'chain', out = S.out[o.scen.out || 'typ'] || S.out.typ;
    const acts = [];
    SC.scen = { id: S.id, mode, out: o.scen.out || 'typ', auto: o.scen.auto !== false, team2: !!o.scen.team2 };
    SC.mech = S.mech; SC.mechN = S.mechN; SC.pat = Object.assign({}, S.pat); SC.evd = {}; SC.hand = {}; SC.phs = []; SC.vh = []; SC.ph = 'prep';
    S.inj.forEach(j => { const x = newInj(j, 0); SC.inj.push(x); hpush(x, 'Sužeidimas'); (j.a || [PCAT.injAct(x)]).forEach(a => { if (a) { acts.push(a); alog.push({ a, t: 0 }); } }); });
    // stotelės
    const ops = {}, stops = new Set();
    const addOp = (t, o2, by0) => { (ops[t] = ops[t] || []).push({ ops: o2, by: by0 }); stops.add(t); };
    (S.pre || []).forEach(p => addOp(p.t, p.ops, 'cls'));
    let end = S.start.medevac, then = 'medevac', ev = null;
    if (mode === 'role1') {
      end = S.role1At; then = 'role1';
      out.ops.forEach(([t, o2]) => addOp(t, o2, 'team'));
      ev = S.ev.filter(e => e.ph === 'medevac' && e.id !== 'noise' && e.id !== 'vib' && e.id !== 'vib0' && e.id !== 'o2off');
      for (let t = S.start.medevac; t < end; t += isLocal() ? 60 : 120) stops.add(t);
    }
    stops.add(end);
    const L0 = [...stops].filter(t => t <= end).sort((a, b) => a - b);
    SC.prep = { stops: L0, ops, i: 0, then, ev, evT0: 0, lbl: mode === 'role1' ? 'MEDEVAC dalis (' + out.n.toLowerCase() + ')' : 'priešistorė' };
    return { acts, ff: L0[0] };
  }
  // atšaukiami veiksmai: instruktorius ir komanda gali atšaukti per UNDO_S s
  function enqueue(o) {
    const uid = 'u' + (++reqId), n = o.n || describe(o);
    if (o.now) { run(o); keep(); onChange(); return; }
    Q.push({ uid, n, by: o.by || 'instr', at: Date.now() + UNDO_S * 1000, o });
    onChange();
  }
  function describe(o) {
    if (o.op === 'card') { const j = injById(o.iid); const A = j && PCAT.cardActions(j, SC.set).find(x => x[0] === o.a); return (A ? A[1] : o.a === 'sevup' ? 'Stiprinti' : o.a === 'sevdn' ? 'Silpninti' : o.a) + (j ? ' – ' + PCAT.injName(j).name : ''); }
    if (o.op === 'inj') return 'Naujas sužalojimas: ' + iname(o.j);
    if (o.op === 'tx') return o.n || o.code;
    if (o.op === 'ev') { const E = PCAT.EVENTS.find(e => e[0] === o.code); return E ? E[1] : o.code; }
    if (o.op === 'istop') return 'Stabdyti infuziją';
    return o.op;
  }
  setInterval(() => {
    if (!Q.length) return;
    const now = Date.now(), due = Q.filter(q => q.at <= now);
    if (!due.length) { onChange(); return; }
    Q = Q.filter(q => q.at > now);
    due.forEach(q => { try { run(q.o); } catch (e) { console.warn(e); } });
    keep(); onChange();
  }, 500);

  // ── komandos (vykdomos monitoriuje) ──
  function cmd(o) {
    const c = cfg();
    if (o.url && String(o.token || '').trim()) saveCfg({ url: o.url, token: o.token });   // instruktorius be žetono – naudojami monitoriaus nustatymai
    switch (o.op) {
      case 'start': {
        if (o.eng) saveCfg({ eng: o.eng === 'pulse' ? 'pulse' : 'local' });
        const S = o.sc || {}, set = o.scen ? 'medevac' : PCAT.SETTINGS[S.set] ? S.set : 'role1';
        wantRun = true; hist = []; alog = []; Q = []; startFn = null; connect.q = null; Object.keys(pend).forEach(k => delete pend[k]); saveCfg({ sid: '', deadSid: '' });
        SC = { set, pat: S.pat || {}, mech: S.mech || '', mechN: S.mechN || '', inj: [], inf: [], o2: null, kit: { max: PCAT.SETTINGS[set].blood, used: 0 }, log: [], arrest: '', min: { sys: 999, spo2: 100 }, ff: +o.ff || 0, nonce: o.nonce || '' };
        let acts = [];
        SC.ph = set; SC.phs = [{ ph: set, t0: SC.ff }]; SC.evd = {}; SC.hand = {}; SC.vh = [];
        if (o.scen && typeof PSCEN !== 'undefined' && PSCEN.get(o.scen.id)) { const r = startScen(o); acts = r.acts; SC.ff = r.ff; }
        else (S.inj || []).forEach(j => { const x = newInj(j, 0); SC.inj.push(x); hpush(x, 'Sužeidimas'); const a = PCAT.injAct(x); if (a) { acts.push(a); alog.push({ a, t: 0 }); } });
        if (typeof PULSE_CM !== 'undefined') PULSE_CM.reset();
        keep();
        SIM.sesStart(); SIM.setLabel((PCAT.SETTINGS[set].n + ' · ' + (SC.mechN || 'Pulse')).slice(0, 40), '');
        // švari pradžia: sinusinis ritmas, visi davikliai prijungti, be artefaktų (ankstesnio scenarijaus likučiai)
        try { SIM.setRhythm('sinus'); ['ecg', 'spo2', 'nibp'].forEach(k => SIM.setProbe(k, true)); SIM.setArt('motion', false); SIM.setArt('cpr', false); SIM.unmute(); } catch (e) {}
        L(engN() + ': ' + (SC.scen ? 'scenarijus ' + SC.mechN : PCAT.SETTINGS[set].n + ' · ' + (SC.mechN || 'scenarijus')) + (SC.inj.length ? ' – ' + SC.inj.map(iname).join('; ') : ''));
        const go = startFn = () => { tx({ t: 'start', state: (SC.pat && SC.pat.state) || '', acts, speed: 1, ff: SC.ff, kg: (SC.pat && SC.pat.kg) || 80, temp0: (SCN() || {}).temp0 || 36.6 }); setSt('load', SC.prep ? 'Ruošiama priešistorė…' : SC.ff ? 'Prasukama iki ' + mmss(SC.ff) + ' nuo sužeidimo…' : 'Ruošiamas modelis…'); };
        if (ws && ws.readyState === 1) go(); else connect(go);
        break;
      }
      case 'resume': wantRun = true; if (c.sid) { if (ws && ws.readyState === 1) tx({ t: 'resume', sid: c.sid }); else connect(() => tx({ t: 'resume', sid: c.sid })); } break;
      case 'card': case 'inj': case 'tx': case 'ev': case 'istop': if (SC && wantRun) enqueue(o); break;
      case 'undo': { const q = Q.find(x => x.uid === o.uid); Q = Q.filter(x => x.uid !== o.uid); if (q) L('Atšaukta: ' + q.n, 'sys'); onChange(); break; }
      case 'phase': if (SC && wantRun && o.to === 'role1' && SC.set !== 'role1') { if (SC.ph === 'medevac') closePh(); toRole1({ skip: Math.max(0, +o.skip || 0), reprobe: !!o.reprobe, team2: !!o.team2 }); keep(); onChange(); } break;
      case 'hand': if (SC) { SC.hand = SC.hand || {}; SC.hand[o.kind === 'atm' ? 'atm' : 'mist'] = { m: o.m || {}, t: Math.round(simt) }; if (o.kind !== 'atm' && SC.ph === 'medevac') { closePh(); SC.ph = 'handover'; } keep(); onChange(); } break;
      case 'sev': if (SC && wantRun && SC.evd) { const S = SCN(), e = S && S.ev.find(x => x.id === o.id); if (e && SC.evd[e.id] == null) { SC.evd[e.id] = Math.round(simt); recE('Planuotas įvykis (instruktorius): ' + e.n, 'instr'); runOps(e.ops, 'instr'); keep(); onChange(); } } break;
      case 'auto': if (SC && SC.scen) { SC.scen.auto = !!o.on; L('Planuoti įvykiai ' + (o.on ? 'automatiškai' : 'rankiniu būdu'), 'sys'); keep(); onChange(); } break;
      case 'mark': if (SC) { SC.log.push({ t: Math.round(simt), n: '★ ' + (o.x || 'Žymė'), by: 'instr', star: 1 }); L('★ ' + (o.x || 'Žymė')); keep(); onChange(); } break;
      case 'speed': if (tx({ t: 'speed', x: +o.x || 1 })) { speed = +o.x || 1; L('Pulse greitis ×' + speed, 'sys'); } onChange(); break;
      case 'skip': if (tx({ t: 'skip', s: +o.s || 300 })) { skipLeft = +o.s || 300; L('Praleista ' + Math.round((+o.s || 300) / 60) + ' min', 'sys'); } onChange(); break;
      case 'pause': tx({ t: o.on ? 'pause' : 'run' }); paused = !!o.on; setSt(o.on ? 'pause' : 'run'); break;
      case 'stop': { const was = st; wantRun = false; Q = []; startFn = null; connect.q = null; tx({ t: 'stop' }); saveCfg({ sid: '' }); L('Pulse: modeliavimas baigtas'); setTimeout(() => { try { ws && ws.close(); } catch (e) {} }, 200); if (SC && !SC.on) SC = null; if (SC) { SC.end = simt; keep(); } setSt('off', !SC ? 'Pradžia atšaukta' : was === 'conn' || was === 'err' ? 'Modeliavimas baigtas – ataskaita skiltyje „Ataskaita“.' : 'Modeliavimas baigtas – ataskaita skiltyje „Ataskaita“. Monitorius rodo paskutines Pulse reikšmes (normalūs: Rodikliai → Atkurti normą).'); break; }
      case 'probe': wantRun = false; connect(() => setTimeout(() => setSt('off', info ? 'Serveris pasiekiamas: ' + info.engine + ' ' + info.version : ''), 300)); break;
    }
  }
  // būsena instruktoriui (siunčiama momentinėje nuotraukoje)
  function status() {
    const now = Date.now();
    return { st, msg, eng: info ? info.engine : (isLocal() ? PLOCAL.ENGINE : ''), ver: info ? info.version : '', pulse: !!(info && info.pulse), local: isLocal(), engSet: cfg().eng, simt: Math.round(simt), speed, skip: skipLeft, ff: ffInfo,
      sup: info ? Object.keys(info.supported || {}).filter(k => info.supported[k] === true) : null, comp: info ? info.compounds : null, sub: info ? info.substances : null, hemc: info ? info.hem_cmp || null : null,
      v: lastV ? { hr: lastV.hr && Math.round(lastV.hr), sys: lastV.sys && Math.round(lastV.sys), dia: lastV.dia && Math.round(lastV.dia), spo2: lastV.spo2 && Math.round(lastV.spo2), rr: lastV.rr && Math.round(lastV.rr), temp: lastV.temp && r1(lastV.temp), bv: lastV.bv && Math.round(lastV.bv), lost: lastV.lost, htx: lastV.htx, co: lastV.co && r1(lastV.co), map: lastV.map && Math.round(lastV.map) } : null,
      sc: SC, q: Q.map(x => ({ uid: x.uid, n: x.n, by: x.by, left: Math.max(0, Math.ceil((x.at - now) / 1000)) })), cm: typeof PULSE_CM !== 'undefined' ? PULSE_CM.list() : [], h: hist.slice(0, 5), sid: cfg().sid ? 1 : 0, tok: isLocal() || !!String(cfg().token || '').trim() };
  }
  const running = () => wantRun && (st === 'run' || st === 'pause' || st === 'load' || st === 'conn');
  // monitoriaus perkrovimas – atkurti sesiją ir scenarijų
  function boot() {
    const c = cfg();
    if (c.sc && typeof c.sc === 'object') { SC = c.sc; alog = Array.isArray(c.alog) ? c.alog : []; hist = Array.isArray(c.hist) ? c.hist : []; }
    if (c.sid && c.url) { wantRun = true; connect(() => tx({ t: 'resume', sid: c.sid })); }
  }
  // ── Pulse serverio pažadinimas iš anksto (Azure MIN=0 – miegantis serveris pasileidžia 1–2 min.) ──
  // Atidaro atskirą ryšį, kas 40 s siunčia „hello“, kad serveris neužmigtų, kol ruošiamasi (iki 20 min.).
  let W = null;
  const WAKE_MIN = 20;
  function wake(cb) {
    const c = cfg(), u = wsUrl(c);
    if (W && W.st !== 'err' && W.st !== 'off' && Date.now() < W.until) { W.cb = cb || W.cb; W.until = Date.now() + WAKE_MIN * 60000; if (W.cb) W.cb(wakeState()); return; }
    if (!u) { W = { st: 'err', msg: 'Pulse serverio adresas nenustatytas', t0: Date.now(), cb }; if (cb) cb(wakeState()); return; }
    if (!String(c.token || '').trim()) { W = { st: 'err', msg: 'Įveskite Pulse serverio žetoną: Nustatymai → Pulse serveris', t0: Date.now(), cb }; if (cb) cb(wakeState()); return; }
    W = { st: 'waking', t0: Date.now(), until: Date.now() + WAKE_MIN * 60000, cb, u, s: null, msg: '' };
    wakeOpen();
    if (!wake.iv) wake.iv = setInterval(() => {
      if (!W || W.st === 'off' || W.st === 'err') return;
      if (Date.now() > W.until) { W.st = 'off'; try { W.s && W.s.close(); } catch (e) {} if (W.cb) W.cb(wakeState()); return; }
      if (W.s && W.s.readyState === 1 && Date.now() - (W.ping || 0) > 40000) { W.ping = Date.now(); W.s.send(JSON.stringify({ t: 'hello' })); }
      if (W.cb && W.st === 'waking') W.cb(wakeState());
    }, 1000);
  }
  function wakeOpen() {
    const w = W; let s;
    try { s = new WebSocket(w.u); } catch (e) { w.st = 'err'; w.msg = 'Netinkamas serverio adresas'; if (w.cb) w.cb(wakeState()); return; }
    w.s = s;
    s.onopen = () => s.send(JSON.stringify({ t: 'hello' }));
    s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t === 'info') { if (w.st !== 'ready') { w.st = 'ready'; w.at = Date.now(); } w.msg = m.engine + ' ' + m.version + (m.pulse ? '' : ' (testinis variklis)'); w.ses = m.sessions + '/' + m.max; info = info || m; if (w.cb) w.cb(wakeState()); } else if (m.t === 'err' && m.code === 'auth') { w.st = 'err'; w.msg = 'Neteisingas žetonas'; if (w.cb) w.cb(wakeState()); } };
    s.onclose = ev => {
      if (W !== w) return;
      if (ev.code === 4001) { w.st = 'err'; w.msg = 'Neteisingas žetonas – Nustatymai → Pulse serveris'; if (w.cb) w.cb(wakeState()); return; }
      if (w.st === 'off' || w.st === 'err' || Date.now() > w.until) return;
      if (w.st === 'ready') w.st = 'waking';
      setTimeout(() => { if (W === w && w.st === 'waking') wakeOpen(); }, 3000);   // serveris dar kyla (502/503) – bandoma vėl
    };
  }
  function wakeState() {
    if (!W) return { st: 'none' };
    const now = Date.now();
    return { st: W.st, sec: Math.round(((W.at || now) - W.t0) / 1000), msg: W.msg || '', ses: W.ses || '', left: W.until ? Math.max(0, Math.round((W.until - now) / 60000)) : 0 };
  }
  function wakeStop() { if (W) { W.st = 'off'; try { W.s && W.s.close(); } catch (e) {} } }
  // ryšio patikra iš nustatymų (šiame telefone)
  function test(url, token, cb) {
    const u = wsUrl({ url, token }); if (!u) return cb('Įveskite adresą');
    let done = false, s;
    try { s = new WebSocket(u); } catch (e) { return cb('Netinkamas adresas'); }
    const to = setTimeout(() => { if (!done) { done = true; try { s.close(); } catch (e) {} cb('Serveris neatsako (jei jis ką tik pasileidžia – palaukite 1–2 min. ir bandykite dar kartą)'); } }, 90000);
    s.onopen = () => s.send(JSON.stringify({ t: 'hello' }));
    s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (done) return; if (m.t === 'info') { done = true; clearTimeout(to); info = m; s.close(); cb('✓ Pasiekiamas: ' + m.engine + ' ' + m.version + (m.pulse ? '' : ' (testinis variklis)') + ' · sesijos ' + m.sessions + '/' + m.max); } else if (m.t === 'err') { done = true; clearTimeout(to); cb('✕ ' + m.msg); } };
    s.onclose = ev => { if (!done) { done = true; clearTimeout(to); cb(ev.code === 4001 ? '✕ Neteisingas žetonas' : '✕ Nepavyko prisijungti'); } };
  }
  return { cmd, status, running, boot, test, wake, wakeState, wakeStop, saveCfg, cfg, mmss, set onChange(f) { onChange = f; }, DEF_URL, UNDO_S, _wsUrl: wsUrl };
})();
