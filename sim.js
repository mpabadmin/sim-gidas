'use strict';
// ───────── SIM – paciento monitoriaus simuliatorius (variklis, kreivės, garsas, aliarmai) ─────────
// Parametrai: ŠSD (EKG), SpO₂ (pletizmograma), AKS (neinvazinis, MAP), KD (kvėpavimo kreivė), T. EtCO₂ – nenaudojamas.
// Instruktorius keičia tikslines reikšmes; monitorius jas pasiekia per pasirinktą laiką (tendencija).
const SIM = (() => {
  const KEY = 'sim-busena';
  const P = ['hr', 'spo2', 'sys', 'dia', 'rr', 'temp'];
  const LIM = { hr: [0, 250], spo2: [40, 100], sys: [0, 260], dia: [0, 180], rr: [0, 60], temp: [25, 43] };
  const DEF = { hr: 80, spo2: 98, sys: 122, dia: 78, rr: 14, temp: 36.6 };
  const RH = [['sinus', 'Sinusinis'], ['af', 'Prieširdžių virpėjimas'], ['vt', 'Skilvelinė tachikardija'], ['vf', 'Skilvelių virpėjimas'], ['asys', 'Asistolija'], ['pea', 'BEA (be pulso)']];
  const NOPULSE = { vf: 1, asys: 1, pea: 1 };
  const clamp = (k, v) => Math.max(LIM[k][0], Math.min(LIM[k][1], +v));
  const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

  // ── būsena ──
  let S = load();
  function base() {
    const tr = {}; P.forEach(k => { tr[k] = { from: DEF[k], to: DEF[k], t0: 0, dur: 0 }; });
    return { tr, rhythm: 'sinus', probe: { ecg: 1, spo2: 1, nibp: 1 }, nibp: { mode: 0, last: null, meas: 0, next: 0 }, alarms: 1, sound: 1, beep: 1, label: '', stage: '', mute: 0 };
  }
  function load() {
    const b = base();
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        P.forEach(k => { const v = o.v && isFinite(o.v[k]) ? clamp(k, o.v[k]) : DEF[k]; b.tr[k] = { from: v, to: v, t0: 0, dur: 0 }; });
        if (RH.some(r => r[0] === o.rhythm)) b.rhythm = o.rhythm;
        ['alarms', 'sound', 'beep'].forEach(k => { if (k in o) b[k] = o[k] ? 1 : 0; });
        if (o.probe) ['ecg', 'spo2', 'nibp'].forEach(k => { b.probe[k] = o.probe[k] === 0 ? 0 : 1; });
        if ([0, 3, 5, 10, 15].indexOf(+o.nmode) >= 0) b.nibp.mode = +o.nmode;
        b.label = typeof o.label === 'string' ? o.label.slice(0, 80) : ''; b.stage = typeof o.stage === 'string' ? o.stage.slice(0, 80) : '';
      }
    } catch (e) {}
    return b;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: targets(), rhythm: S.rhythm, alarms: S.alarms, sound: S.sound, beep: S.beep, probe: S.probe, nmode: S.nibp.mode, label: S.label, stage: S.stage })); } catch (e) {}
  }
  const now = () => performance.now() / 1000;
  function val(k, t) {
    const x = S.tr[k]; if (!x.dur) return x.to;
    return x.from + (x.to - x.from) * ease(((t == null ? now() : t) - x.t0) / x.dur);
  }
  function targets() { const o = {}; P.forEach(k => { o[k] = S.tr[k].to; }); return o; }
  // tikslinės reikšmės per dur sekundžių
  function apply(v, dur) {
    const t = now(); dur = Math.max(0, +dur || 0);
    P.forEach(k => { if (v && v[k] != null && isFinite(v[k])) { const c = val(k, t); S.tr[k] = { from: c, to: clamp(k, v[k]), t0: t, dur }; } });
    if (S.tr.dia.to >= S.tr.sys.to && S.tr.sys.to > 0) S.tr.dia.to = Math.max(0, S.tr.sys.to - 10);
    save(); fire();
  }
  function setRhythm(r) { if (!RH.some(x => x[0] === r)) return; S.rhythm = r; beats.length = 0; nextBeat = 0; save(); fire(); }
  function setProbe(k, on) { if (k in S.probe) { S.probe[k] = on ? 1 : 0; save(); fire(); } }
  function setOpt(k, v) { if (['alarms', 'sound', 'beep'].indexOf(k) >= 0) { S[k] = v ? 1 : 0; save(); fire(); } }
  function setLabel(label, stage) { if (label != null) S.label = String(label).slice(0, 80); if (stage != null) S.stage = String(stage).slice(0, 80); save(); fire(); }
  function setNibpMode(m) { if ([0, 3, 5, 10, 15].indexOf(+m) < 0) return; S.nibp.mode = +m; S.nibp.next = m ? Date.now() + m * 60000 : 0; save(); fire(); }
  function reset() { const keep = { sound: S.sound, beep: S.beep, alarms: S.alarms }; S = base(); Object.assign(S, keep); beats.length = 0; save(); fire(); }
  // ── klausytojai (UI, nuotolinis valdymas) ──
  const subs = [];
  function on(f) { subs.push(f); }
  function fire() { subs.forEach(f => { try { f(); } catch (e) {} }); }

  // ── dabartinės (rodomos) reikšmės su natūraliu svyravimu ──
  let jit = { hr: 0, spo2: 0, rr: 0 }, jitT = 0;
  function cur() {
    const t = now();
    if (t - jitT > 2.5) { jitT = t; jit = { hr: Math.round((Math.random() - 0.5) * 4), spo2: Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0, rr: Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0 }; }
    const o = {}; P.forEach(k => { o[k] = val(k, t); });
    o.hr = Math.max(0, Math.round(o.hr + (o.hr > 20 ? jit.hr : 0)));
    o.spo2 = Math.min(100, Math.round(o.spo2 + (o.spo2 < 100 ? jit.spo2 : 0)));
    o.rr = Math.max(0, Math.round(o.rr + (o.rr > 4 ? jit.rr : 0)));
    o.sys = Math.round(o.sys); o.dia = Math.round(o.dia); o.temp = Math.round(o.temp * 10) / 10;
    return o;
  }
  // perfuzija 0–1 – pletizmogramos amplitudė ir SpO₂ signalo kokybė
  function perf(c) {
    if (NOPULSE[S.rhythm]) return 0;
    if (S.rhythm === 'vt' && c.sys < 60) return 0;
    const a = Math.max(0, Math.min(1, (c.sys - 45) / 65)), pp = Math.max(0.25, Math.min(1, (c.sys - c.dia) / 40));
    return a * pp;
  }

  // ── širdies ciklų (dūžių) tvarkaraštis ──
  const beats = []; let nextBeat = 0;
  function rate() { const c = val('hr'); return S.rhythm === 'vt' ? Math.max(140, c) : c; }
  function schedule(t) {
    if (S.rhythm === 'vf' || S.rhythm === 'asys') { nextBeat = 0; return; }
    const hr = rate(); if (hr < 5) { nextBeat = 0; return; }
    if (!nextBeat || nextBeat < t - 2) nextBeat = t + 0.05;
    while (nextBeat <= t + 0.6) {
      beats.push(nextBeat);
      let rr = 60 / hr;
      if (S.rhythm === 'af') rr *= 0.6 + Math.random() * 0.8;
      nextBeat += rr;
    }
    while (beats.length > 12) beats.shift();
  }
  const g = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
  function ecgBeat(d, rr) {
    if (S.rhythm === 'vt') return -0.5 * g(d, -0.02, 0.035) + 1.25 * g(d, 0.05, 0.045) - 0.55 * g(d, 0.16, 0.06);
    const qt = Math.min(0.42, 0.36 * Math.sqrt(Math.max(0.25, rr)));
    let v = 1.05 * g(d, 0, 0.011) - 0.12 * g(d, -0.028, 0.009) - 0.26 * g(d, 0.03, 0.011) + 0.28 * g(d, qt * 0.78, 0.05);
    if (S.rhythm !== 'af') v += 0.13 * g(d, -0.16 * Math.min(1, rr / 0.6 + 0.2), 0.024);
    if (S.rhythm === 'pea') v = 0.7 * g(d, 0, 0.022) - 0.2 * g(d, 0.05, 0.02) + 0.18 * g(d, 0.32, 0.07);
    return v;
  }
  function ecg(t) {
    if (!S.probe.ecg) return 0.03 * Math.sin(t * 2.1) + (Math.random() - 0.5) * 0.04;
    const noise = (Math.random() - 0.5) * 0.025 + 0.03 * Math.sin(t * 0.7);
    if (S.rhythm === 'asys') return noise * 0.6;
    if (S.rhythm === 'vf') return 0.45 * Math.sin(t * 2 * Math.PI * 5.2 + 0.8 * Math.sin(t * 1.3)) * (0.6 + 0.4 * Math.sin(t * 0.9)) + 0.18 * Math.sin(t * 2 * Math.PI * 7.4) + noise;
    let v = noise;
    if (S.rhythm === 'af') v += 0.05 * Math.sin(t * 2 * Math.PI * 6.3) + 0.03 * Math.sin(t * 2 * Math.PI * 8.9);
    for (let i = 0; i < beats.length; i++) { const d = t - beats[i]; if (d > -0.3 && d < 0.6) v += ecgBeat(d, i ? beats[i] - beats[i - 1] : 60 / Math.max(30, rate())); }
    return v;
  }
  function pleth(t, pf) {
    if (!S.probe.spo2 || pf <= 0) return 0;
    let v = 0;
    for (let i = 0; i < beats.length; i++) { const d = t - beats[i] - 0.22; if (d > 0 && d < 0.9) v += g(d, 0.11, 0.055) + 0.32 * g(d, 0.3, 0.07); }
    return v * pf;
  }
  let rph = 0, rT = 0;
  function resp(t) {
    const r = val('rr'); const dt = rT ? Math.max(0, Math.min(0.2, t - rT)) : 0; rT = t;
    if (r < 2) return 0;
    rph = (rph + dt * r / 60) % 1; const ph = rph; // fazė kaupiama – keičiant KD kreivė nešokinėja
    return ph < 0.4 ? Math.sin(ph / 0.4 * Math.PI / 2) : Math.cos((ph - 0.4) / 0.6 * Math.PI / 2) ** 2;
  }

  // ── garsas (WebAudio) ──
  let ac = null, lastBeepBeat = 0;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function tone(f, d, at, vol) {
    if (!ac || !S.sound) return;
    const o = ac.createOscillator(), gn = ac.createGain(), t = at || ac.currentTime;
    o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const beepF = sp => 440 * Math.pow(2, (Math.max(60, Math.min(100, sp)) - 85) / 24); // mažesnis SpO₂ – žemesnis tonas
  // IEC 60601-1-8 primena: aukšto prioriteto – 3 + 2 impulsai, vidutinio – 3 impulsai
  function alarmTone(pri) {
    if (!ac || !S.sound) return; const t = ac.currentTime + 0.02;
    if (pri === 2) { [0, 0.2, 0.4, 1.0, 1.2].forEach(dt => tone(988, 0.15, t + dt, 0.22)); }
    else { [0, 0.25, 0.5].forEach(dt => tone(660, 0.2, t + dt, 0.16)); }
  }

  // ── aliarmai ──
  const ALIM = { hr: [50, 120, 40, 150], spo2: [90, null, 85, null], sys: [90, 180, 70, null], rr: [8, 30, 5, 40], temp: [35, 38.5, 32, 40] };
  function alarms(c, pf) {
    const out = [];
    if (S.probe.ecg) {
      if (S.rhythm === 'asys') out.push([2, 'ASISTOLIJA']);
      else if (S.rhythm === 'vf') out.push([2, 'SKILVELIŲ VIRPĖJIMAS']);
      else if (S.rhythm === 'vt') out.push([2, 'SKILVELINĖ TACHIKARDIJA']);
    } else out.push([1, 'EKG elektrodai atjungti']);
    const chk = (k, v, nm) => { const L = ALIM[k]; if (v == null) return; if (L[2] != null && v < L[2]) out.push([2, nm + ' ' + fmt(k, v) + ' ↓']); else if (L[3] != null && v > L[3]) out.push([2, nm + ' ' + fmt(k, v) + ' ↑']); else if (L[0] != null && v < L[0]) out.push([1, nm + ' ' + fmt(k, v) + ' ↓']); else if (L[1] != null && v > L[1]) out.push([1, nm + ' ' + fmt(k, v) + ' ↑']); };
    if (S.probe.ecg && !NOPULSE[S.rhythm] && S.rhythm !== 'vt') chk('hr', c.hr, 'ŠSD');
    if (!S.probe.spo2) out.push([1, 'SpO₂ zondas nuimtas']);
    else if (pf <= 0) out.push([1, 'SpO₂ – nėra pulso signalo']);
    else { if (pf < 0.15) out.push([1, 'SpO₂ – silpnas signalas']); chk('spo2', c.spo2, 'SpO₂'); }
    if (S.nibp.last && S.nibp.last.ok && Date.now() - S.nibp.last.t < 20 * 60000) chk('sys', S.nibp.last.sys, 'AKS sist.');
    chk('rr', c.rr, 'KD'); if (c.rr === 0) out.push([2, 'APNĖJA']);
    chk('temp', c.temp, 'T');
    return out.sort((a, b) => b[0] - a[0]);
  }
  function fmt(k, v) { return k === 'temp' ? String(v.toFixed(1)).replace('.', ',') : String(v); }

  // ── AKS matavimas ──
  function nibpStart() {
    if (S.nibp.meas) return; S.nibp.meas = Date.now(); fire();
  }
  function nibpTick(c) {
    const N = S.nibp;
    if (!N.meas && N.mode && N.next && Date.now() >= N.next) nibpStart();
    if (N.meas) {
      const dur = 16000 + (c.sys > 0 ? Math.min(12000, c.sys * 40) : 8000);
      if (Date.now() - N.meas >= dur) {
        const ok = S.probe.nibp && !NOPULSE[S.rhythm] && c.sys >= 40 && !(S.rhythm === 'vt' && c.sys < 60);
        N.last = ok ? { ok: 1, sys: c.sys, dia: c.dia, map: Math.round(c.dia + (c.sys - c.dia) / 3), t: Date.now() } : { ok: 0, t: Date.now(), why: S.probe.nibp ? 'Nepavyko išmatuoti' : 'Manžetė neuždėta' };
        N.meas = 0; N.next = N.mode ? Date.now() + N.mode * 60000 : 0; fire();
      }
    }
  }
  function cuff() { const N = S.nibp; if (!N.meas) return 0; const e = (Date.now() - N.meas) / 1000; return e < 6 ? Math.round(e / 6 * 180) : Math.max(0, Math.round(180 - (e - 6) * 9)); }

  // ── būsenos santrauka (instruktoriui, nuotoliniam ryšiui) ──
  function snapshot() {
    const c = cur(), pf = perf(c), A = S.alarms ? alarms(c, pf) : [];
    return { c, pf: Math.round(pf * 100) / 100, t: targets(), rhythm: S.rhythm, probe: Object.assign({}, S.probe), nibp: { mode: S.nibp.mode, last: S.nibp.last, meas: S.nibp.meas ? 1 : 0 }, alarms: S.alarms, sound: S.sound, beep: S.beep, a: A.map(x => x[1]), pri: A.length ? A[0][0] : 0, label: S.label, stage: S.stage, trend: P.some(k => S.tr[k].dur && now() - S.tr[k].t0 < S.tr[k].dur) };
  }

  // ── monitoriaus piešimas ──
  let run = 0, raf = 0, lastT = 0, ch = [], numEl = null, lastNum = 0, lastAlarm = 0, alarmShown = '';
  const CH = [['ecg', 'II', '#3ee06a', 25], ['pleth', 'Pleth', '#38d5f2', 25], ['resp', 'Resp', '#f4d54a', 6.25]];
  function mount(root) {
    stop(); run = 1;
    root.innerHTML = `<div class="mon" id="mon"><div class="mtop"><span class="mlb" id="mlb"></span><span class="mal" id="mal" role="status" aria-live="assertive"></span><span class="mclk" id="mclk"></span></div>` +
      `<div class="mwav">${CH.map(([k, l, col]) => `<div class="mch"><span class="mchl" style="color:${col}">${l}</span><canvas data-ch="${k}"></canvas></div>`).join('')}</div>` +
      `<div class="mnum" id="mnum"></div></div>`;
    ch = CH.map(([k, l, col, mm]) => { const cv = root.querySelector(`canvas[data-ch="${k}"]`); return { k, col, mm, cv, cx: cv.getContext('2d'), x: 0, py: null, w: 0, h: 0, dpr: 1 }; });
    numEl = root.querySelector('#mnum'); size(); lastT = now();
    window.addEventListener('resize', size);
    raf = requestAnimationFrame(frame);
  }
  function size() {
    ch.forEach(c => { const r = c.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; c.dpr = d; c.w = Math.max(10, Math.round(r.width * d)); c.h = Math.max(10, Math.round(r.height * d)); c.cv.width = c.w; c.cv.height = c.h; c.x = 0; c.py = null; c.cx.fillStyle = '#000'; c.cx.fillRect(0, 0, c.w, c.h); });
  }
  function stop() { run = 0; if (raf) cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', size); }
  const PXMM = () => (window.devicePixelRatio || 1) * 3.78 * 0.62; // ~25 mm/s telefono ekrane (sumažinta, kad tilptų ≥ 4 s)
  function frame() {
    if (!run) return;
    const t = now(); let dt = Math.min(0.1, t - lastT); lastT = t;
    schedule(t);
    const c = cur(), pf = perf(c);
    // pulso pyptelėjimas
    if (S.beep && S.probe.spo2 && pf > 0 && ac) { for (const b of beats) { if (b > lastBeepBeat && b <= t) { lastBeepBeat = b; tone(beepF(c.spo2), 0.07, 0, 0.12); } } }
    ch.forEach(C => {
      const step = C.mm * PXMM() * dt; let n = Math.max(1, Math.round(step)); if (!isFinite(n) || C.w < 20) return;
      const cx = C.cx, gap = Math.round(14 * C.dpr), mid = C.h / 2, amp = C.h * 0.36;
      for (let i = 0; i < n; i++) {
        const ts = t - dt + dt * (i + 1) / n; let v;
        if (C.k === 'ecg') v = mid - ecg(ts) * amp * 0.95 + amp * 0.15;
        else if (C.k === 'pleth') v = C.h * 0.85 - pleth(ts, pf) * C.h * 0.62;
        else v = C.h * 0.82 - resp(ts) * C.h * 0.6;
        cx.fillStyle = '#000'; cx.fillRect(C.x, 0, gap, C.h);
        cx.strokeStyle = C.col; cx.lineWidth = 2 * C.dpr; cx.lineJoin = 'round';
        if (C.py != null && C.x > 0) { cx.beginPath(); cx.moveTo(C.x - 1, C.py); cx.lineTo(C.x, v); cx.stroke(); }
        C.py = v; C.x += 1; if (C.x >= C.w) { C.x = 0; C.py = null; }
      }
    });
    nibpTick(c);
    if (t - lastNum > 0.5) { lastNum = t; nums(c, pf); }
    raf = requestAnimationFrame(frame);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
  function nums(c, pf) {
    if (!numEl) return;
    const A = S.alarms ? alarms(c, pf) : [], hot = new Set(A.map(a => a[1].split(' ')[0]));
    const box = (k, lbl, col, big, unit, sub, warn) => `<div class="mbx${warn ? ' w' + warn : ''}" data-k="${k}"><span class="mbl" style="color:${col}">${lbl}</span><b style="color:${col}">${big}</b><span class="mbu">${unit}${sub ? '<br>' + sub : ''}</span></div>`;
    const pri = (k, v) => { const L = ALIM[k]; if (!S.alarms || v == null || !L) return 0; return (L[2] != null && v < L[2]) || (L[3] != null && v > L[3]) ? 2 : (L[0] != null && v < L[0]) || (L[1] != null && v > L[1]) ? 1 : 0; };
    const hr = !S.probe.ecg ? '---' : S.rhythm === 'vf' ? '---' : S.rhythm === 'asys' ? '0' : String(S.rhythm === 'vt' ? Math.max(140, c.hr) : c.hr);
    const sp = !S.probe.spo2 || pf <= 0 ? '--' : String(c.spo2);
    const N = S.nibp, L = N.last;
    let bp = '---/---', bsub = N.mode ? 'auto ' + N.mode + ' min' : 'rankinis', bw = 0;
    if (N.meas) { bp = '<small>' + cuff() + '</small>'; bsub = 'Matuojama…'; }
    else if (L && L.ok) { bp = L.sys + '/' + L.dia; bsub = '(' + L.map + ') · ' + hhmm(L.t) + (N.mode ? ' · auto ' + N.mode : ''); bw = pri('sys', L.sys); }
    else if (L) { bsub = L.why + ' · ' + hhmm(L.t); bw = 1; }
    const hrw = S.rhythm === 'asys' || S.rhythm === 'vf' || S.rhythm === 'vt' ? 2 : NOPULSE[S.rhythm] ? 0 : pri('hr', c.hr);
    numEl.innerHTML = box('hr', 'ŠSD', '#3ee06a', hr, 'k./min', rhName(), hrw) + box('spo2', 'SpO₂', '#38d5f2', sp, '%', S.probe.spo2 && pf > 0 ? bar(pf) : '', sp === '--' ? 1 : pri('spo2', c.spo2)) +
      box('nibp', 'AKS', '#f2f2f2', bp, 'mm Hg', bsub, bw) + box('rr', 'KD', '#f4d54a', String(c.rr), 'k./min', '', pri('rr', c.rr)) + box('temp', 'T', '#f6a35b', fmt('temp', c.temp), '°C', '', pri('temp', c.temp));
    const mal = document.getElementById('mal'), mlb = document.getElementById('mlb'), clk = document.getElementById('mclk');
    if (mlb) mlb.textContent = [S.label, S.stage].filter(Boolean).join(' · ');
    if (clk) clk.textContent = hhmm(Date.now());
    const muted = S.mute && Date.now() < S.mute;
    const msg = A.length ? A[0][1] + (A.length > 1 ? '  +' + (A.length - 1) : '') : '';
    if (mal) { mal.textContent = msg + (muted && msg ? '  🔕' : ''); mal.className = 'mal' + (A.length ? ' p' + A[0][0] : ''); }
    if (A.length && !muted && ac) { const per = A[0][0] === 2 ? 5 : 15; if (Date.now() - lastAlarm > per * 1000 || alarmShown !== A[0][1] && Date.now() - lastAlarm > 2500) { lastAlarm = Date.now(); alarmShown = A[0][1]; alarmTone(A[0][0]); } }
  }
  const bar = pf => '<i class="pfb"><i style="width:' + Math.round(Math.max(0.08, pf) * 100) + '%"></i></i>';
  const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const rhName = () => (RH.find(r => r[0] === S.rhythm) || [0, ''])[1];
  function muteAlarms(min) { S.mute = Date.now() + (min || 2) * 60000; fire(); }

  return { P, DEF, LIM, RH, apply, setRhythm, setProbe, setOpt, setLabel, setNibpMode, nibpStart, reset, snapshot, targets, on, mount, stop, audio, muteAlarms, cur, perf: () => perf(cur()), state: () => S, _ecg: ecg, _alarms: () => alarms(cur(), perf(cur())) };
})();
