'use strict';
// ───────── SIM ↔ Pulse serveris (Kitware Pulse Physiology Engine) ─────────
// Monitorius (šeimininkas) jungiasi prie serverio WebSocket ryšiu, siunčia gydymo veiksmus ir kas sekundę gauna
// rodiklius, kuriuos rodo monitoriuje. Instruktorius veiksmus siunčia monitoriui įprastu ryšiu ({c:'pulse', …}).
// Serverio protokolas – server/pulse_server.py.
const PULSE = (() => {
  const KEY = 'sim-pulse';
  const cfg = () => Object.assign({ url: '', token: '', sid: '', state: '' }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
  const saveCfg = o => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(cfg(), o))); } catch (e) {} };
  // ── paruošti scenarijai (pradinės traumos) ──
  const PRESETS = [
    ['hem', 'Kraujavimas iš šlaunies', 'Arterinis, dešinė šlaunis', [{ k: 'hem', cmp: 'RightLeg', sev: 0.7 }]],
    ['hemi', 'Vidinis kraujavimas', 'Blužnis – nesuspaudžiamas', [{ k: 'hem', cmp: 'Spleen', sev: 0.5 }]],
    ['tpx', 'Įtampos pneumotoraksas', 'Kairė pusė', [{ k: 'tpx', side: 'L', sev: 0.6 }]],
    ['blast', 'Sprogimas', 'Kojos kraujavimas + pneumotoraksas + galva', [{ k: 'hem', cmp: 'LeftLeg', sev: 0.6 }, { k: 'tpx', side: 'R', sev: 0.3 }, { k: 'tbi', sev: 0.3 }]],
    ['aw', 'Kvėpavimo takų obstrukcija', 'Veido trauma', [{ k: 'aw', sev: 0.7 }]],
    ['tbi', 'Galvos smegenų trauma', 'Sunki, difuzinė', [{ k: 'tbi', sev: 0.8 }]],
    ['tam', 'Širdies tamponada', 'Skeveldra krūtinėje', [{ k: 'eff', rate: 15 }]],
    ['brn', 'Nudegimai 40 %', 'Šarvuočio gaisras', [{ k: 'burn', tbsa: 0.4 }]],
    ['none', 'Be sužalojimų', 'Sveikas karys – sužalojimus pridėsite vėliau', []]
  ];
  // ── veiksmai: [raktas, pavadinimas, veiksmas, įprasta trukmė (tekstas), grupė] ──
  const ACTS = [
    ['g', 'Kraujavimas'],
    ['hstop', 'Kraujavimas sustabdytas', { k: 'hem_stop' }, 'turniketas 30–60 s; tamponavimas + spaudimas 3 min', 'Turniketas, tamponavimas ar spaudimas – visiems aktyviems kraujavimams'],
    ['hnew', 'Naujas kraujavimas (koja)', { k: 'hem', cmp: 'LeftLeg', sev: 0.5 }, '', 'Instruktorius sukelia papildomą kraujavimą'],
    ['g', 'Kraujas ir skysčiai'],
    ['wb10', 'Pilnas kraujas 500 ml – su slėgio maišu', { k: 'inf', cmp: 'Blood', ml: 500, rate: 50 }, '≈ 10 min', ''],
    ['wb20', 'Pilnas kraujas 500 ml – laša savaime', { k: 'inf', cmp: 'Blood', ml: 500, rate: 25 }, '≈ 20 min (įprastai 15–30 min)', ''],
    ['pl', 'Plazma 250 ml', { k: 'inf', cmp: 'Plasma', ml: 250, rate: 25 }, '≈ 10 min', ''],
    ['ns', 'NaCl 0,9 % 500 ml', { k: 'inf', cmp: 'Saline', ml: 500, rate: 50 }, '≈ 10 min', ''],
    ['lr', 'Ringerio laktatas 500 ml', { k: 'inf', cmp: 'LactatedRingers', ml: 500, rate: 50 }, '≈ 10 min', ''],
    ['g', 'Kvėpavimas'],
    ['ndcL', 'Adatinė dekompresija – kairė', { k: 'ndc', side: 'L' }, '1–2 min', ''],
    ['ndcR', 'Adatinė dekompresija – dešinė', { k: 'ndc', side: 'R' }, '1–2 min', ''],
    ['occL', 'Okliuzinis tvarstis – kairė', { k: 'occl', side: 'L' }, '30–60 s', ''],
    ['occR', 'Okliuzinis tvarstis – dešinė', { k: 'occl', side: 'R' }, '30–60 s', ''],
    ['awo', 'Kvėpavimo takai atverti', { k: 'aw', sev: 0 }, 'manevrai 10–30 s; NPA 30 s; atsiurbimas', ''],
    ['o2', 'Deguonis – kaukė 15 l/min', { k: 'o2', dev: 'NonRebreatherMask', flow: 15 }, '1 min', ''],
    ['o2nc', 'Deguonis – kaniulės 4 l/min', { k: 'o2', dev: 'NasalCannula', flow: 4 }, '1 min', ''],
    ['intub', 'Intubacija', { k: 'intub' }, 'RSI 5–10 min nuo sprendimo', 'Pulse modelyje – trachėjos vamzdelis'],
    ['g', 'Vaistai (dozė – pagal ETC / March gidą)'],
    ['ket', 'Ketaminas 25 mg IV', { k: 'bolus', sub: 'Ketamine', mg: 25, route: 'IV' }, 'poveikis po 1 min', ''],
    ['ketm', 'Ketaminas 100 mg IM', { k: 'bolus', sub: 'Ketamine', mg: 100, route: 'IM' }, 'poveikis po 5 min', ''],
    ['fen', 'Fentanilis 50 mcg IV', { k: 'bolus', sub: 'Fentanyl', mg: 0.05, route: 'IV' }, 'poveikis po 2–3 min', ''],
    ['mor', 'Morfinas 5 mg IV', { k: 'bolus', sub: 'Morphine', mg: 5, route: 'IV' }, 'poveikis po 5–10 min', ''],
    ['nal', 'Naloksonas 0,4 mg IV', { k: 'bolus', sub: 'Naloxone', mg: 0.4, route: 'IV' }, 'poveikis po 1–2 min', ''],
    ['epi', 'Adrenalinas 0,5 mg IM', { k: 'bolus', sub: 'Epinephrine', mg: 0.5, route: 'IM' }, 'poveikis po 3–5 min', ''],
    ['mid', 'Midazolamas 2 mg IV', { k: 'bolus', sub: 'Midazolam', mg: 2, route: 'IV' }, 'poveikis po 2–3 min', ''],
    ['g', 'Sukelti būklę (instruktorius)'],
    ['xtpx', 'Įtampos pneumotoraksas – kairė', { k: 'tpx', side: 'L', sev: 0.6 }, '', ''],
    ['xaw', 'Kvėpavimo takų obstrukcija', { k: 'aw', sev: 0.7 }, '', ''],
    ['xtbi', 'Galvos smegenų trauma', { k: 'tbi', sev: 0.7 }, '', ''],
    ['xeff', 'Tamponada (skystis perikarde)', { k: 'eff', rate: 15 }, '', ''],
    ['xarr', 'Širdies sustojimas', { k: 'arrest', rhythm: 'Asystole' }, '', '']
  ];
  const actBy = id => ACTS.find(a => a[0] === id && a[0] !== 'g');
  // ── būsena (monitoriaus pusėje) ──
  let ws = null, st = 'off', info = null, simt = 0, speed = 1, paused = false, alive = true, msg = '', lastV = null, retry = 0, wantRun = false, reqId = 0;
  const pend = {};          // id → {n, a, t}
  let acts = [];            // vykdomi veiksmai su trukme: {id, n, t0, tot}
  let hems = [];            // aktyvūs kraujavimai (skyriai)
  let hist = [];            // paskutiniai veiksmai
  let onChange = () => {};
  const setSt = (s, m) => { st = s; if (m != null) msg = m; onChange(); };
  function wsUrl(c) {
    let u = String(c.url || '').trim(); if (!u) return '';
    if (/^https?:\/\//.test(u)) u = u.replace(/^http/, 'ws');
    if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
    if (!/\/ws(\?|$)/.test(u)) u = u.replace(/\/?$/, '/ws');
    return u + (c.token ? (u.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(c.token) : '');
  }
  function connect(then) {
    const c = cfg(), u = wsUrl(c);
    if (!u) { setSt('err', 'Pulse serveris nenustatytas (Nustatymai → Pulse serveris)'); return; }
    if (ws && ws.readyState <= 1) { if (then && ws.readyState === 1) then(); else if (then) connect.q = then; return; }
    connect.q = then || null;
    setSt('conn', 'Jungiamasi prie serverio… (pirmą kartą gali užtrukti 1–3 min., kol serveris pasileidžia)');
    try { ws = new WebSocket(u); } catch (e) { setSt('err', 'Netinkamas serverio adresas'); return; }
    ws.onopen = () => { retry = 0; tx({ t: 'hello' }); const q = connect.q; connect.q = null; if (q) q(); else if (c.sid && wantRun) tx({ t: 'resume', sid: c.sid }); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
    ws.onclose = ev => {
      ws = null;
      if (ev.code === 4001) { wantRun = false; setSt('err', 'Neteisingas žetonas – patikrinkite nustatymus'); return; }
      if (wantRun) { retry = Math.min(retry + 1, 6); setSt('conn', 'Ryšys su serveriu nutrūko – jungiamasi iš naujo…'); setTimeout(() => { if (wantRun) connect(); }, 1500 * retry); }
      else if (st !== 'err') setSt('off', '');
    };
  }
  const tx = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
  function onMsg(m) {
    switch (m.t) {
      case 'info': info = m; onChange(); break;
      case 'started': saveCfg({ sid: m.sid }); simt = +m.simt || 0; if (m.speed) speed = m.speed; paused = !!m.paused; alive = true; setSt(paused ? 'pause' : 'run', m.resumed ? 'Sesija atkurta' : ''); if (!m.resumed) SIM.log('mark', 'Pulse: modeliavimas pradėtas (' + (m.engine || '') + ')'); break;
      case 'gone': saveCfg({ sid: '' }); wantRun = false; acts = []; setSt('off', 'Ankstesnė sesija serveryje nebeegzistuoja – pradėkite iš naujo'); break;
      case 'vit': simt = +m.simt || simt; if (m.speed) speed = m.speed; alive = m.alive !== false; lastV = m.v || lastV; applyVitals(m.v || {}, alive); acts = acts.filter(a => simt - a.t0 < a.tot + 30); onChange(); break;
      case 'ack': {
        const p = pend[m.id]; delete pend[m.id];
        if (!p) break;
        hist.unshift({ n: p.n, ok: m.ok, t: m.simt, e: m.msg || '' }); hist = hist.slice(0, 8);
        if (p.a.k === 'hem' && m.ok && hems.indexOf(p.a.cmp) < 0) hems.push(p.a.cmp);
        if (p.a.k === 'hem_stop' && m.ok) hems = hems.filter(c => c !== p.a.cmp);
        if (p.silent) { onChange(); break; }
        if (m.ok) {
          SIM.log('mark', 'Pulse: ' + p.n);
          if (p.a.k === 'inf') acts.push({ id: m.id, n: p.n, t0: +m.simt || simt, tot: Math.round(p.a.ml / Math.max(1, p.a.rate) * 60), cmp: p.a.cmp });
          if (p.a.k === 'inf_stop') acts = acts.filter(a => a.cmp !== p.a.cmp);
        } else SIM.log('mark', 'Pulse: nepavyko – ' + p.n + (m.msg ? ' (' + m.msg.slice(0, 60) + ')' : ''));
        onChange(); break;
      }
      case 'dead': alive = false; SIM.log('mark', 'Pulse: negrįžtama būklė (mirtis) – ' + mmss(m.simt)); setSt('dead', 'Modeliuojamas pacientas mirė – pradėkite iš naujo'); break;
      case 'stopped': setSt('off', ''); break;
      case 'err': if (m.code === 'auth') wantRun = false; setSt(wantRun ? st : 'err', m.msg || 'Serverio klaida'); if (/užimtas|Variklio/.test(m.msg || '')) { wantRun = false; setSt('err', m.msg); } break;
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
    if (!live || ((t.hr || 0) < 5 && map < 20)) r = 'asys';
    else if (map < 20) r = 'pea';
    else if (['asys', 'pea', 'vf'].indexOf(r0) >= 0) r = 'sinus';
    if (r !== r0) SIM.setRhythm(r);
    SIM.apply(t, 1.2);
  }
  const mmss = s => { s = Math.max(0, Math.round(+s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  // ── komandos (vykdomos monitoriuje) ──
  function cmd(o) {
    const c = cfg();
    if (o.url) saveCfg({ url: o.url, token: o.token || '' });
    switch (o.op) {
      case 'start': {
        const p = PRESETS.find(x => x[0] === o.preset) || PRESETS[0];
        wantRun = true; acts = []; hist = []; Object.keys(pend).forEach(k => delete pend[k]);
        hems = p[3].filter(a => a.k === 'hem').map(a => a.cmp);
        SIM.sesStart(); SIM.setLabel('Pulse: ' + p[1], '');
        const go = () => { tx({ t: 'start', state: o.state || '', acts: p[3], speed: +o.speed || 1 }); setSt('load', 'Ruošiamas modelis…'); };
        if (ws && ws.readyState === 1) go(); else connect(go);
        break;
      }
      case 'resume': wantRun = true; if (c.sid) { if (ws && ws.readyState === 1) tx({ t: 'resume', sid: c.sid }); else connect(() => tx({ t: 'resume', sid: c.sid })); } break;
      case 'act': {
        const A = actBy(o.id); if (!A) break;
        const a = Object.assign({}, A[2]);
        const list = a.k === 'hem_stop' ? (hems.length ? hems.slice() : ['RightLeg']) : [null];
        list.forEach((cm, i) => { const id = 'a' + (++reqId) + Date.now().toString(36).slice(-3), x = Object.assign({}, a); if (cm) x.cmp = cm; pend[id] = { n: A[1], a: x, t: simt, silent: i > 0 }; if (!tx({ t: 'act', id, a: x })) { delete pend[id]; msg = 'Nėra ryšio su serveriu'; } });
        onChange(); break;
      }
      case 'istop': { const id = 'a' + (++reqId), x = { k: 'inf_stop', cmp: o.cmp, ml: 1 }; pend[id] = { n: 'Infuzija sustabdyta', a: x, t: simt }; tx({ t: 'act', id, a: x }); break; }
      case 'speed': if (tx({ t: 'speed', x: +o.x || 1 })) { speed = +o.x || 1; SIM.log('sys', 'Pulse greitis ×' + speed); } onChange(); break;
      case 'pause': tx({ t: o.on ? 'pause' : 'run' }); paused = !!o.on; setSt(o.on ? 'pause' : 'run'); break;
      case 'stop': wantRun = false; tx({ t: 'stop' }); saveCfg({ sid: '' }); acts = []; SIM.log('mark', 'Pulse: modeliavimas baigtas'); setTimeout(() => { try { ws && ws.close(); } catch (e) {} }, 200); setSt('off', ''); break;
      case 'probe': wantRun = false; connect(() => setTimeout(() => setSt('off', info ? 'Serveris pasiekiamas: ' + info.engine + ' ' + info.version : ''), 300)); break;
      case 'cfg': break;
    }
  }
  // būsena instruktoriui (siunčiama momentinėje nuotraukoje)
  function status() {
    if (st === 'off' && !info && !cfg().url) return { st: 'none' };
    return { st, msg, eng: info ? info.engine : '', ver: info ? info.version : '', pulse: !!(info && info.pulse), simt: Math.round(simt), speed, sup: info ? Object.keys(info.supported || {}).filter(k => info.supported[k] === true) : null,
      comp: info ? info.compounds : null, sub: info ? info.substances : null, act: acts.map(a => ({ id: a.id, n: a.n, t0: a.t0, tot: a.tot, cmp: a.cmp })), h: hist.slice(0, 5), v: lastV ? { bv: lastV.bv, co: lastV.co, map: lastV.map } : null, sid: cfg().sid ? 1 : 0 };
  }
  const running = () => wantRun && (st === 'run' || st === 'pause' || st === 'load' || st === 'conn');
  // monitoriaus perkrovimas – atkurti sesiją
  function boot() { const c = cfg(); if (c.sid && c.url) { wantRun = true; connect(() => tx({ t: 'resume', sid: c.sid })); } }
  // ── pultas ──
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  function avail(a, P) {
    if (!P || !P.sup) return true;
    if (a.k === 'hem_stop') return P.sup.indexOf('hem') >= 0;
    if (P.sup.indexOf(a.k) < 0) return false;
    if (a.k === 'inf' && P.comp && P.comp.indexOf(a.cmp) < 0) return false;
    if (a.k === 'bolus' && P.sub && P.sub.indexOf(a.sub) < 0) return false;
    return true;
  }
  function tab(P, local) {
    const c = cfg(); let h = '';
    if (!local && (!P || P.st === 'none') && c.url) P = { st: 'off', msg: 'Monitorius naudos šio telefono Pulse nustatymus.' };
    const stTxt = { none: 'nenustatytas', off: 'neprisijungta', conn: 'jungiamasi…', load: 'ruošiamas modelis…', run: 'vyksta', pause: 'pauzė', dead: 'pacientas mirė', err: 'klaida' };
    if (!P || P.st === 'none') {
      return '<section class="pnl"><h2>Pulse fiziologijos modelis</h2><p class="mt0">Rodikliai skaičiuojami Kitware Pulse varikliu: gydymo veiksmai (kraujas, dekompresija, vaistai…) keičia rodiklius pagal fiziologinį modelį.</p>' +
        '<p class="muted">Reikia Pulse serverio. Įveskite jo adresą ir žetoną: <b>Nustatymai → Pulse serveris</b> (arba atidarykite nuorodą, kurią pateikė diegimo skriptas).</p>' +
        '<div class="acts"><button class="btn" data-act="tab" data-k="set">Į nustatymus</button></div></section>';
    }
    const run = ['run', 'pause', 'load'].indexOf(P.st) >= 0;
    h += `<section class="pnl"><h2>Pulse ${P.eng ? '· ' + esc2(P.eng + ' ' + P.ver) : ''}</h2>` +
      `<div class="pus ${P.st}"><b>${stTxt[P.st] || P.st}</b>${run || P.st === 'dead' ? ' · ⏱ ' + mmss(P.simt) : ''}${P.speed && run ? ' · ×' + P.speed : ''}</div>` +
      (P.msg ? `<p class="muted">${esc2(P.msg)}</p>` : '') + (P.eng && !P.pulse ? '<p class="mira p1">Serveryje veikia testinis (supaprastintas) variklis, ne Pulse.</p>' : '');
    if (run) {
      h += '<div class="chips">' + [1, 2, 5, 10].map(x => `<button class="chip${P.speed === x ? ' on' : ''}" data-act="pu" data-k="speed" data-x="${x}">×${x}</button>`).join('') +
        `<button class="chip" data-act="pu" data-k="pause" data-x="${P.st === 'pause' ? 0 : 1}">${P.st === 'pause' ? '▶ Tęsti' : '⏸ Pauzė'}</button><button class="chip" data-act="pu" data-k="stop">■ Baigti</button></div>`;
      if (P.v && P.v.bv) h += `<p class="muted">Kraujo tūris ${Math.round(P.v.bv)} ml${P.v.co ? ' · širdies išstūmis ' + String(P.v.co).replace('.', ',') + ' l/min' : ''}${P.v.map ? ' · VAKS ' + Math.round(P.v.map) : ''}</p>`;
    }
    h += '</section>';
    if (!run) {
      h += '<section class="pnl"><h2>Pradėti modeliavimą</h2><div class="pres">' + PRESETS.map(p => `<button class="stb" data-act="pu" data-k="start" data-x="${p[0]}"><span><b>${esc2(p[1])}</b><small>${esc2(p[2])}</small></span></button>`).join('') + '</div>' +
        (P.sid && P.st !== 'dead' ? '<div class="acts"><button class="btn" data-act="pu" data-k="resume">Atkurti ankstesnę sesiją</button></div>' : '') +
        '<p class="muted">Modeliavimas vyksta realiu laiku (×1); greitį galima didinti. Būsenos ir veiksmų poveikį skaičiuoja serveris.</p></section>';
      return h;
    }
    if (P.act && P.act.length) {
      h += '<section class="pnl"><h2>Vykdoma</h2>' + P.act.map(a => { const done = Math.max(0, Math.min(a.tot, P.simt - a.t0)), left = Math.max(0, a.tot - done); return `<div class="pua"><div><b>${esc2(a.n)}</b><small>${left > 0 ? 'liko ' + mmss(left) + ' (modelio laikas)' : 'baigta'}</small></div><i class="pfb2"><i style="width:${Math.round(done / Math.max(1, a.tot) * 100)}%"></i></i>${left > 0 ? `<button class="chip" data-act="pu" data-k="istop" data-x="${esc2(a.cmp)}">Stabdyti</button>` : ''}</div>`; }).join('') + '</section>';
    }
    let grp = '';
    ACTS.forEach(A => {
      if (A[0] === 'g') { if (grp) h += '</div></section>'; grp = A[1]; h += `<section class="pnl"><h2>${esc2(A[1])}</h2><div class="puacts">`; return; }
      const ok = avail(A[2], P);
      h += `<button class="pub" data-act="pu" data-k="act" data-x="${A[0]}"${ok ? '' : ' disabled'}><b>${esc2(A[1])}</b>${A[3] ? `<small>⏱ ${esc2(A[3])}</small>` : ''}${!ok ? '<small>nepalaikoma šioje Pulse versijoje</small>' : ''}</button>`;
    });
    if (grp) h += '</div></section>';
    if (P.h && P.h.length) h += '<section class="pnl"><h2>Paskutiniai veiksmai</h2>' + P.h.map(x => `<div class="puh${x.ok ? '' : ' bad'}">${x.ok ? '✓' : '✕'} ${esc2(x.n)} <small>${mmss(x.t)}${x.e ? ' · ' + esc2(x.e.slice(0, 80)) : ''}</small></div>`).join('') + '</section>';
    return h;
  }
  // mygtukas → komanda (siunčiama per send(): vietoje arba nuotoliniam monitoriui)
  function click(el) {
    const k = el.dataset.k, x = el.dataset.x, c = cfg(), o = { c: 'pulse', op: k };
    if (k === 'start') { o.preset = x; if (c.url) { o.url = c.url; o.token = c.token; } }
    else if (k === 'act') o.id = x;
    else if (k === 'speed') o.x = +x;
    else if (k === 'pause') o.on = x === '1';
    else if (k === 'istop') o.cmp = x;
    else if (k === 'stop' && !confirm('Baigti Pulse modeliavimą?')) return null;
    return o;
  }
  function settingsHtml(local) {
    const c = cfg();
    return `<label class="rl">Serverio adresas<input class="inp" id="pu-url" placeholder="wss://….azurecontainerapps.io/ws" value="${esc2(c.url)}" autocomplete="off" spellcheck="false"></label>` +
      `<label class="rl">Žetonas (token)<input class="inp" id="pu-tok" value="${esc2(c.token)}" autocomplete="off" spellcheck="false"></label>` +
      `<div class="acts"><button class="btn" data-act="pu-save">Išsaugoti</button><button class="btn" data-act="pu-test">Tikrinti ryšį</button></div><p class="muted" id="pu-res">${esc2(info ? 'Serveris: ' + info.engine + ' ' + info.version + (info.pulse ? '' : ' (testinis)') : '')}</p>` +
      '<p class="muted">Adresą ir žetoną pateikia diegimo skriptas (server/azure/diegti.sh). Užtenka įvesti instruktoriaus telefone – pradedant modeliavimą jie perduodami monitoriui.</p>';
  }
  // ryšio patikra iš nustatymų (šiame telefone)
  function test(url, token, cb) {
    const u = wsUrl({ url, token }); if (!u) return cb('Įveskite adresą');
    let done = false, s;
    try { s = new WebSocket(u); } catch (e) { return cb('Netinkamas adresas'); }
    const to = setTimeout(() => { if (!done) { done = true; try { s.close(); } catch (e) {} cb('Serveris neatsako (jei jis ką tik pasileidžia – palaukite 1–3 min. ir bandykite dar kartą)'); } }, 90000);
    s.onopen = () => s.send(JSON.stringify({ t: 'hello' }));
    s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (done) return; if (m.t === 'info') { done = true; clearTimeout(to); info = m; s.close(); cb('✓ Pasiekiamas: ' + m.engine + ' ' + m.version + (m.pulse ? '' : ' (testinis variklis)') + ' · sesijos ' + m.sessions + '/' + m.max); } else if (m.t === 'err') { done = true; clearTimeout(to); cb('✕ ' + m.msg); } };
    s.onclose = ev => { if (!done) { done = true; clearTimeout(to); cb(ev.code === 4001 ? '✕ Neteisingas žetonas' : '✕ Nepavyko prisijungti'); } };
  }
  return { cmd, status, running, boot, tab, click, settingsHtml, test, saveCfg, cfg, set onChange(f) { onChange = f; }, PRESETS, ACTS, mmss, _wsUrl: wsUrl };
})();
