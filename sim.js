'use strict';
// ───────── SIM – paciento monitoriaus simuliatorius (variklis, kreivės, garsas, aliarmai, žurnalas) ─────────
// Parametrai: ŠSD (EKG), SpO₂ (pletizmograma), AKS (neinvazinis, MAP), KD (kvėpavimo kreivė), T. EtCO₂ – nenaudojamas.
// Instruktorius keičia tikslines reikšmes; monitorius jas pasiekia per pasirinktą laiką (tendencija).
const SIM = (() => {
  const KEY = 'sim-busena', KCFG = 'sim-cfg', KLOG = 'sim-zurnalas';
  const P = ['hr', 'spo2', 'sys', 'dia', 'rr', 'temp'];
  const LIM = { hr: [0, 250], spo2: [40, 100], sys: [0, 260], dia: [0, 180], rr: [0, 60], temp: [25, 43] };
  const DEF = { hr: 80, spo2: 98, sys: 122, dia: 78, rr: 14, temp: 36.6 };
  const RH = [['sinus', 'Sinusinis'], ['af', 'Prieširdžių virpėjimas'], ['svt', 'SVT'], ['jun', 'Mazginis ritmas'], ['avb3', 'AV blokada III°'], ['hyk', 'Hiperkalemija (platūs QRS)'], ['vt', 'Skilvelinė tachikardija'], ['vf', 'Skilvelių virpėjimas'], ['asys', 'Asistolija'], ['pea', 'BEA (be pulso)']];
  const NOPULSE = { vf: 1, asys: 1, pea: 1 };
  const RMIN = { vt: 140, svt: 150 };
  const clamp = (k, v) => Math.max(LIM[k][0], Math.min(LIM[k][1], +v));
  const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const NMODES = [0, 3, 5, 10, 15];

  // ── nustatymai (sinchronizuojami su nuotoliniu instruktoriumi) ──
  // aliarmų ribos: [žema (vid.), aukšta (vid.), žema (aukšto prior.), aukšta (aukšto prior.)]; null – išjungta
  const LIM0 = { hr: [50, 120, 40, 150], spo2: [90, null, 85, null], sys: [90, 180, 70, null], rr: [8, 30, 5, 40], temp: [35, 38.5, 32, 40] };
  const SPEEDS = [12.5, 25, 50], GAINS = [0.5, 1, 1.5, 2], NOISES = [0, 1, 2], SCHEMES = ['classic', 'hc'];
  const CFG0 = () => ({ lim: JSON.parse(JSON.stringify(LIM0)), avol: 70, bvol: 60, speed: 25, gain: 1, pgain: 1, rgain: 1, noise: 1, show: { pleth: 1, resp: 1, rr: 1, temp: 1 }, big: 0, scheme: 'classic', clock: 0, scen: 0, rhy: 0, pat: '', wake: 1 });
  function mergeCfg(o, b) {
    if (!o || typeof o !== 'object') return b;
    if (o.lim === 'def') b.lim = JSON.parse(JSON.stringify(LIM0));
    else if (o.lim && typeof o.lim === 'object') Object.keys(LIM0).forEach(k => {
      const a = o.lim[k]; if (!Array.isArray(a) || a.length !== 4) return;
      b.lim[k] = a.map((x, i) => x === null || x === '' ? null : isFinite(x) ? Math.round(clamp(k, x) * 10) / 10 : b.lim[k][i]);
    });
    ['avol', 'bvol'].forEach(k => { if (k in o && isFinite(o[k])) b[k] = Math.max(0, Math.min(100, Math.round(+o[k]))); });
    if (SPEEDS.indexOf(+o.speed) >= 0) b.speed = +o.speed;
    if (GAINS.indexOf(+o.gain) >= 0) b.gain = +o.gain;
    if (GAINS.indexOf(+o.pgain) >= 0) b.pgain = +o.pgain;
    if (GAINS.indexOf(+o.rgain) >= 0) b.rgain = +o.rgain;
    if (NOISES.indexOf(+o.noise) >= 0) b.noise = +o.noise;
    if (o.show && typeof o.show === 'object') Object.keys(b.show).forEach(k => { if (k in o.show) b.show[k] = o.show[k] ? 1 : 0; });
    ['big', 'clock', 'scen', 'rhy', 'wake'].forEach(k => { if (k in o) b[k] = o[k] ? 1 : 0; });
    if (SCHEMES.indexOf(o.scheme) >= 0) b.scheme = o.scheme;
    if (typeof o.pat === 'string') b.pat = o.pat.slice(0, 40);
    return b;
  }
  let CFG = (() => { try { return mergeCfg(JSON.parse(localStorage.getItem(KCFG) || 'null'), CFG0()); } catch (e) { return CFG0(); } })();
  function setCfg(o) {
    const old = JSON.stringify([CFG.show, CFG.big, CFG.scheme]);
    CFG = mergeCfg(o === 'def' ? CFG0() : o, o === 'def' ? CFG0() : CFG);
    try { localStorage.setItem(KCFG, JSON.stringify(CFG)); } catch (e) {}
    if (run && mroot && JSON.stringify([CFG.show, CFG.big, CFG.scheme]) !== old) { build(); size(); }
    if (run) { chLabel(); lastNumKey = ''; Object.keys(boxes).forEach(k => { boxes[k]._b = boxes[k]._s = boxes[k]._c = null; }); }
    fire();
  }

  // ── būsena ──
  let S = load();
  function base() {
    const tr = {}; P.forEach(k => { tr[k] = { from: DEF[k], to: DEF[k], t0: 0, dur: 0 }; });
    return { tr, rhythm: 'sinus', probe: { ecg: 1, spo2: 1, nibp: 1 }, nibp: { mode: 0, last: null, meas: 0, next: 0, stat: 0 }, alarms: 1, sound: 1, beep: 1, label: '', stage: '', mute: 0,
      art: { motion: 0, cpr: 0 }, pace: { on: 0, rate: 70, ma: 70 }, pause: 0, pauseAt: 0, shk: -99, shkJ: 0 };
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
        if (NMODES.indexOf(+o.nmode) >= 0) b.nibp.mode = +o.nmode;
        if (o.art) ['motion', 'cpr'].forEach(k => { b.art[k] = o.art[k] ? 1 : 0; });
        if (o.pace) { b.pace.on = o.pace.on ? 1 : 0; if (isFinite(o.pace.rate)) b.pace.rate = +o.pace.rate; if (isFinite(o.pace.ma)) b.pace.ma = +o.pace.ma; }
        b.label = typeof o.label === 'string' ? o.label.slice(0, 80) : ''; b.stage = typeof o.stage === 'string' ? o.stage.slice(0, 80) : '';
      }
    } catch (e) {}
    return b;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: targets(), rhythm: S.rhythm, alarms: S.alarms, sound: S.sound, beep: S.beep, probe: S.probe, nmode: S.nibp.mode, label: S.label, stage: S.stage, art: S.art, pace: S.pace })); } catch (e) {}
  }
  // simuliacijos laikas (s) – sustoja per pauzę
  const rnow = () => performance.now() / 1000;
  let pAcc = 0, pAt = 0;
  const now = () => (pAt || rnow()) - pAcc;
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
  function resetBeats() { beats.length = 0; nextBeat = 0; spikes.length = 0; nextSpike = 0; }
  function setRhythm(r) { if (!RH.some(x => x[0] === r) || r === S.rhythm) return; S.rhythm = r; resetBeats(); save(); fire(); }
  function setProbe(k, on) { if (k in S.probe) { S.probe[k] = on ? 1 : 0; save(); fire(); } }
  function setArt(k, on) { if (k in S.art) { S.art[k] = on ? 1 : 0; save(); fire(); } }
  function setOpt(k, v) { if (['alarms', 'sound', 'beep'].indexOf(k) >= 0) { S[k] = v ? 1 : 0; save(); fire(); } }
  function setLabel(label, stage) { if (label != null) S.label = String(label).slice(0, 80); if (stage != null) S.stage = String(stage).slice(0, 80); save(); fire(); }
  function setNibpMode(m) { if (NMODES.indexOf(+m) < 0) return; S.nibp.mode = +m; S.nibp.stat = 0; S.nibp.next = m ? Date.now() + m * 60000 : 0; save(); fire(); }
  function setPace(o) {
    const p = S.pace; if (!o) return;
    if ('on' in o) p.on = o.on ? 1 : 0;
    if (o.rate != null && isFinite(o.rate)) p.rate = Math.max(30, Math.min(180, Math.round(+o.rate)));
    if (o.ma != null && isFinite(o.ma)) p.ma = Math.max(0, Math.min(200, Math.round(+o.ma)));
    resetBeats(); save(); fire();
  }
  function reset() { const keep = { sound: S.sound, beep: S.beep, alarms: S.alarms, pause: S.pause, pauseAt: S.pauseAt }; S = base(); Object.assign(S, keep); resetBeats(); save(); fire(); }
  // ── klausytojai (UI, nuotolinis valdymas) ──
  const subs = [];
  function on(f) { subs.push(f); }
  function fire() { subs.forEach(f => { try { f(); } catch (e) {} }); }

  // ── sesija, laikmatis, įvykių žurnalas, tendencijų įrašas ──
  const J0 = () => ({ log: [], tr: [], ses: { on: 0, t0: 0, acc: 0, run: 0, start: 0 }, n: 0 });
  let J = (() => {
    const b = J0();
    try {
      const o = JSON.parse(localStorage.getItem(KLOG) || 'null');
      if (o && Array.isArray(o.log)) {
        const last = o.log.length ? o.log[o.log.length - 1].t : (o.ses && o.ses.start) || 0;
        if (Date.now() - last < 6 * 3600e3) { b.log = o.log.slice(-500); b.tr = Array.isArray(o.tr) ? o.tr.slice(-3000) : []; if (o.ses) Object.assign(b.ses, o.ses); b.n = +o.n || b.log.length; }
      }
    } catch (e) {}
    if (b.ses.on && !b.ses.run) { b.ses.run = 1; b.ses.t0 = Date.now(); }
    return b;
  })();
  let jDirty = 0;
  function saveJ(force) { jDirty = 1; if (force) flushJ(); }
  function flushJ() { if (!jDirty) return; jDirty = 0; try { localStorage.setItem(KLOG, JSON.stringify(J)); } catch (e) {} }
  setInterval(flushJ, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushJ(); });
  function elapsed() { const s = J.ses; return s.on ? s.acc + (s.run ? Date.now() - s.t0 : 0) : 0; }
  function sesStart() { if (J.ses.on) return; J.ses = { on: 1, t0: Date.now(), acc: 0, run: S.pause ? 0 : 1, start: Date.now() }; saveJ(1); fire(); }
  function sesNew() { J = J0(); lastAlarmKeys = new Set(); saveJ(1); fire(); }
  function log(k, x) {
    J.n++; J.log.push({ i: J.n, t: Date.now(), e: elapsed(), k: String(k), x: String(x).slice(0, 160) });
    if (J.log.length > 500) J.log.shift();
    saveJ(1); fire();
  }
  function setPause(on) {
    on = on ? 1 : 0; if (on === S.pause) return;
    const ms = Date.now();
    if (on) { pAt = rnow(); S.pauseAt = ms; if (J.ses.on && J.ses.run) { J.ses.acc += ms - J.ses.t0; J.ses.run = 0; } }
    else {
      pAcc += rnow() - pAt; pAt = 0; const d = ms - (S.pauseAt || ms);
      ['meas', 'next', 'stat'].forEach(k => { if (S.nibp[k]) S.nibp[k] += d; });
      if (S.mute) S.mute += d;
      if (J.ses.on) { J.ses.run = 1; J.ses.t0 = ms; }
    }
    S.pause = on; saveJ(1); fire();
  }

  // ── dabartinės (rodomos) reikšmės su natūraliu svyravimu ──
  let jit = { hr: 0, spo2: 0, rr: 0 }, jitT = 0;
  function cur() {
    const t = now();
    if (t - jitT > 2.5 || t < jitT) { jitT = t; jit = { hr: Math.round((Math.random() - 0.5) * 4), spo2: Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0, rr: Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0 }; }
    const o = {}; P.forEach(k => { o[k] = val(k, t); });
    o.hr = Math.max(0, Math.round(o.hr + (o.hr > 20 ? jit.hr : 0)));
    o.spo2 = Math.min(100, Math.round(o.spo2 + (o.spo2 < 100 ? jit.spo2 : 0)));
    o.rr = Math.max(0, Math.round(o.rr + (o.rr > 4 ? jit.rr : 0)));
    o.sys = Math.round(o.sys); o.dia = Math.round(o.dia); o.temp = Math.round(o.temp * 10) / 10;
    return o;
  }
  const PTHR = 60; // stimuliacijos pagavimo slenkstis, mA
  const cap = () => !!(S.pace.on && S.pace.ma >= PTHR && S.rhythm !== 'vf');
  // perfuzija 0–1 – pletizmogramos amplitudė ir SpO₂ signalo kokybė
  function perf(c) {
    if (!cap()) { if (NOPULSE[S.rhythm]) return 0; if (S.rhythm === 'vt' && c.sys < 60) return 0; }
    const a = Math.max(0, Math.min(1, (c.sys - 45) / 65)), pp = Math.max(0.25, Math.min(1, (c.sys - c.dia) / 40));
    return a * pp;
  }
  // monitoriaus rodomas ŠSD (null – „---“)
  function hrShown(c) {
    if (!S.probe.ecg) return null; if (cap()) return S.pace.rate;
    if (S.rhythm === 'vf') return null; if (S.rhythm === 'asys') return 0;
    return RMIN[S.rhythm] ? Math.max(RMIN[S.rhythm], c.hr) : c.hr;
  }

  // ── širdies ciklų (dūžių) ir stimuliatoriaus impulsų tvarkaraštis ──
  const beats = [], spikes = []; let nextBeat = 0, nextSpike = 0;
  function rate() { const c = val('hr'); return RMIN[S.rhythm] ? Math.max(RMIN[S.rhythm], c) : c; }
  function schedule(t) {
    const blank = S.shk + 1.4;
    if (S.pace.on) {
      if (!nextSpike || nextSpike < t - 2) nextSpike = Math.max(t + 0.05, blank);
      const c = cap();
      while (nextSpike <= t + 0.6) { spikes.push(nextSpike); if (c) beats.push(nextSpike + 0.02); nextSpike += 60 / S.pace.rate; }
      while (spikes.length > 12) spikes.shift();
      if (c) { while (beats.length > 12) beats.shift(); return; }
    }
    if (S.rhythm === 'vf' || S.rhythm === 'asys') { nextBeat = 0; return; }
    const hr = rate(); if (hr < 5) { nextBeat = 0; return; }
    if (!nextBeat || nextBeat < t - 2) nextBeat = Math.max(t + 0.05, blank);
    while (nextBeat <= t + 0.6) {
      beats.push(nextBeat);
      let rr = 60 / hr;
      if (S.rhythm === 'af') rr *= 0.6 + Math.random() * 0.8;
      else if (NZ() && !S.pace.on) rr *= 1 + NZ() * (0.012 * (hsh(nextBeat) * 2 - 1) + (hr < 100 ? 0.02 : 0.008) * rsp(nextBeat));   // ŠSD kintamumas ir kvėpavimo aritmija
      nextBeat += rr;
    }
    while (beats.length > 12) beats.shift();
  }
  const g = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
  // tikroviškumas: 0 – idealios kreivės, 1 – nedidelis triukšmas ir kintamumas, 2 – daugiau
  const NZ = () => CFG.noise == null ? 1 : +CFG.noise || 0;
  const hsh = x => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };   // pastovus „atsitiktinis“ dūžiui
  let rrHz = 0.25;
  const rsp = t => Math.sin(2 * Math.PI * t * rrHz);   // kvėpavimo fazė (moduliacijoms)
  function ecgBeat(d, rr) {
    if (cap()) return 0.95 * g(d, 0.04, 0.04) - 0.35 * g(d, 0.12, 0.05) - 0.4 * g(d, 0.32, 0.075);
    const r = S.rhythm;
    if (r === 'vt') return -0.5 * g(d, -0.02, 0.035) + 1.25 * g(d, 0.05, 0.045) - 0.55 * g(d, 0.16, 0.06);
    if (r === 'avb3') return 0.85 * g(d, 0, 0.03) - 0.32 * g(d, 0.07, 0.03) + 0.3 * g(d, 0.36, 0.08);
    if (r === 'hyk') return 0.75 * g(d, 0.01, 0.03) - 0.28 * g(d, 0.075, 0.032) + 0.62 * g(d, 0.3, 0.042);
    if (r === 'pea') return 0.7 * g(d, 0, 0.022) - 0.2 * g(d, 0.05, 0.02) + 0.18 * g(d, 0.32, 0.07);
    const qt = Math.min(0.42, 0.36 * Math.sqrt(Math.max(0.25, rr)));
    let v = 1.05 * g(d, 0, 0.011) - 0.12 * g(d, -0.028, 0.009) - 0.26 * g(d, 0.03, 0.011) + 0.28 * g(d, qt * 0.78, 0.05);
    if (r === 'sinus') v += 0.13 * g(d, -0.16 * Math.min(1, rr / 0.6 + 0.2), 0.024);
    return v;
  }
  const cprW = t => { const ph = (t * 110 / 60) % 1; return ph < 0.45 ? Math.sin(ph / 0.45 * Math.PI) : 0; };
  const motW = t => 0.5 * Math.sin(t * 5.3 + 2 * Math.sin(t * 0.37)) * (0.5 + 0.5 * Math.sin(t * 0.9)) + 0.25 * Math.sin(t * 17.1) * (Math.sin(t * 1.7) > 0.3 ? 1 : 0);
  // dt – mėginio intervalas: siauri impulsai (stimuliatorius, iškrova) nepraleidžiami
  function ecg(t, dt) {
    dt = dt || 0.01;
    if (!S.probe.ecg) return 0.03 * Math.sin(t * 2.1) + (Math.random() - 0.5) * 0.04;
    const nz = NZ(), noise = (Math.random() - 0.5) * (0.025 + 0.03 * nz) + 0.03 * Math.sin(t * 0.7) + nz * (0.045 * rsp(t + 0.3) + 0.03 * Math.sin(t * 0.31 + 1.7)) + (nz > 1 && Math.sin(t * 0.47) > 0.85 ? (Math.random() - 0.5) * 0.09 : 0);
    const ds = t - S.shk;
    if (ds >= 0 && ds < 1.4) return ds < dt + 0.02 ? 4 : 1.1 * Math.exp(-ds / 0.22) + noise;
    let v = noise;
    if (S.art.motion) v += 0.55 * motW(t) + (Math.random() - 0.5) * 0.12;
    if (S.art.cpr) v += 0.9 * cprW(t);
    for (let i = 0; i < spikes.length; i++) { const d = t - spikes[i]; if (d >= 0 && d < dt) v += 1.7; }
    if (S.rhythm === 'asys' && !cap()) return v - noise * 0.4;
    if (S.rhythm === 'vf') return v + 0.45 * Math.sin(t * 2 * Math.PI * 5.2 + 0.8 * Math.sin(t * 1.3)) * (0.6 + 0.4 * Math.sin(t * 0.9)) + 0.18 * Math.sin(t * 2 * Math.PI * 7.4);
    if (S.rhythm === 'af' && !cap()) v += 0.05 * Math.sin(t * 2 * Math.PI * 6.3) + 0.03 * Math.sin(t * 2 * Math.PI * 8.9);
    if (S.rhythm === 'avb3' && !cap()) { const d = ((t + 0.375) % 0.75) - 0.375; v += 0.13 * g(d, 0, 0.024); }
    const am = 1 + nz * 0.04 * rsp(t);
    for (let i = 0; i < beats.length; i++) { const d = t - beats[i]; if (d > -0.3 && d < 0.6) v += ecgBeat(d, i ? beats[i] - beats[i - 1] : 60 / Math.max(30, rate())) * am * (1 + nz * 0.05 * (hsh(beats[i]) * 2 - 1)); }
    return v;
  }
  function pleth(t, pf) {
    if (!S.probe.spo2) return 0;
    let v = 0;
    const nz = NZ();
    if (pf > 0) for (let i = 0; i < beats.length; i++) { const d = t - beats[i] - 0.22; if (d > 0 && d < 0.9) { const a = 1 + nz * 0.06 * (hsh(beats[i] + 3) * 2 - 1); v += a * (g(d, 0.11, 0.055) + (0.32 + nz * 0.05 * (hsh(beats[i] + 5) - 0.5)) * g(d, 0.3, 0.07)); } }
    // kvėpavimo sukelti svyravimai – didesni esant hipovolemijai (žemas AKS)
    if (nz) { const sys = val('sys'), ppv = 0.05 + 0.12 * Math.max(0, Math.min(1, (105 - sys) / 40)); v *= 1 + nz * ppv * rsp(t - 0.4); v += pf > 0 ? nz * (0.035 * rsp(t + 1) + (Math.random() - 0.5) * 0.012) : 0; }
    v *= pf;
    if (S.art.cpr) v += 0.45 * cprW(t - 0.12);
    if (S.art.motion) v += 0.35 * Math.abs(motW(t * 0.8));
    return v;
  }
  let rph = 0, rT = 0, rbi = 0;
  function resp(t) {
    const r = val('rr'); const dt = rT ? Math.max(0, Math.min(0.2, t - rT)) : 0; rT = t;
    if (r < 2) return S.art.motion ? 0.15 * Math.abs(motW(t)) : 0;
    const nz = NZ(), j = 1 + nz * 0.07 * (hsh(rbi + 11) * 2 - 1);   // įkvėpimų trukmės ir gylio kintamumas
    const np = rph + dt * r / 60 * j; if (np >= 1) rbi++; rph = np % 1; const ph = rph; // fazė kaupiama – keičiant KD kreivė nešokinėja
    const a = 1 + nz * 0.09 * (hsh(rbi + 17) * 2 - 1);
    return a * (ph < 0.4 ? Math.sin(ph / 0.4 * Math.PI / 2) : Math.cos((ph - 0.4) / 0.6 * Math.PI / 2) ** 2) + (S.art.motion ? 0.15 * motW(t) : 0) +
      (nz ? nz * (0.022 * Math.sin(2 * Math.PI * t * Math.max(0.5, val('hr')) / 60) + (Math.random() - 0.5) * 0.01) : 0);   // širdies artefaktas impedansinėje kreivėje
  }

  // ── garsas (WebAudio) ──
  let ac = null, lastBeepBeat = 0;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function tone(f, d, at, vol, type) {
    if (!ac || !S.sound || !(vol > 0.0005)) return;
    const o = ac.createOscillator(), gn = ac.createGain(), t = at || ac.currentTime;
    o.type = type || 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const AV = () => CFG.avol / 70, BV = () => CFG.bvol / 60;
  const beepF = sp => 440 * Math.pow(2, (Math.max(60, Math.min(100, sp)) - 85) / 24); // mažesnis SpO₂ – žemesnis tonas
  // IEC 60601-1-8 primena: aukšto prioriteto – 3 + 2 impulsai, vidutinio – 3 impulsai
  function alarmTone(pri) {
    if (!ac || !S.sound) return; const t = ac.currentTime + 0.02, v = AV();
    if (pri === 2) { [0, 0.2, 0.4, 1.0, 1.2].forEach(dt => tone(988, 0.15, t + dt, 0.22 * v)); }
    else { [0, 0.25, 0.5].forEach(dt => tone(660, 0.2, t + dt, 0.16 * v)); }
  }
  function testSound() { audio(); alarmTone(2); if (ac) setTimeout(() => tone(beepF(98), 0.07, 0, 0.12 * BV()), 1700); }

  // ── aliarmai ──
  function alarms(c, pf) {
    const out = [], L0 = CFG.lim;
    if (S.probe.ecg) {
      if (S.rhythm === 'asys' && !cap()) out.push([2, 'ASISTOLIJA']);
      else if (S.rhythm === 'vf') out.push([2, 'SKILVELIŲ VIRPĖJIMAS']);
      else if (S.rhythm === 'vt' && !cap()) out.push([2, 'SKILVELINĖ TACHIKARDIJA']);
    } else out.push([1, 'EKG elektrodai atjungti']);
    const chk = (k, v, nm) => { const L = L0[k]; if (v == null || !L) return; if (L[2] != null && v < L[2]) out.push([2, nm + ' ' + fmt(k, v) + ' ↓']); else if (L[3] != null && v > L[3]) out.push([2, nm + ' ' + fmt(k, v) + ' ↑']); else if (L[0] != null && v < L[0]) out.push([1, nm + ' ' + fmt(k, v) + ' ↓']); else if (L[1] != null && v > L[1]) out.push([1, nm + ' ' + fmt(k, v) + ' ↑']); };
    // ŠSD ribos tikrinamos ir BEA metu (elektrinis dažnis); SkV, asistolija, SkT – savi aliarmai
    if (S.probe.ecg && (cap() || ['vf', 'asys', 'vt'].indexOf(S.rhythm) < 0)) chk('hr', hrShown(c), 'ŠSD');
    if (!S.probe.spo2) out.push([1, 'SpO₂ zondas nuimtas']);
    else if (pf <= 0) out.push([1, 'SpO₂ – nėra pulso signalo']);
    else { if (pf < 0.15) out.push([1, 'SpO₂ – silpnas signalas']); chk('spo2', c.spo2, 'SpO₂'); }
    if (S.nibp.last && S.nibp.last.ok && Date.now() - S.nibp.last.t < 20 * 60000) chk('sys', S.nibp.last.sys, 'AKS sist.');
    if (CFG.show.rr) { if (c.rr === 0) out.push([2, 'APNĖJA']); else chk('rr', c.rr, 'KD'); }
    if (CFG.show.temp) chk('temp', c.temp, 'T');
    return out.sort((a, b) => b[0] - a[0]);
  }
  function fmt(k, v) { return k === 'temp' ? String((+v).toFixed(1)).replace('.', ',') : String(v); }
  function limPri(k, v) { const L = CFG.lim[k]; if (!S.alarms || v == null || !L) return 0; return (L[2] != null && v < L[2]) || (L[3] != null && v > L[3]) ? 2 : (L[0] != null && v < L[0]) || (L[1] != null && v > L[1]) ? 1 : 0; }

  // ── AKS matavimas ──
  function nibpStart() { if (S.nibp.meas || S.pause) return; S.nibp.meas = Date.now(); S.nibp.peak = Math.max(180, cur().sys + 30); fire(); }
  function nibpStat() { S.nibp.stat = Date.now() + 5 * 60000; if (!S.nibp.meas) nibpStart(); fire(); }
  function nibpTick(c) {
    const N = S.nibp;
    if (!N.meas && N.next && Date.now() >= N.next) nibpStart();
    if (N.meas) {
      const dur = 16000 + (c.sys > 0 ? Math.min(12000, c.sys * 40) : 8000);
      if (Date.now() - N.meas >= dur) {
        const ok = S.probe.nibp && (cap() || (!NOPULSE[S.rhythm] && !(S.rhythm === 'vt' && c.sys < 60))) && c.sys >= 40;
        N.last = ok ? { ok: 1, sys: c.sys, dia: c.dia, map: Math.round(c.dia + (c.sys - c.dia) / 3), t: Date.now() } : { ok: 0, t: Date.now(), why: S.probe.nibp ? 'Nepavyko išmatuoti' : 'Manžetė neuždėta' };
        N.meas = 0;
        if (N.stat && Date.now() < N.stat) N.next = Date.now() + 5000; else { N.stat = 0; N.next = N.mode ? Date.now() + N.mode * 60000 : 0; }
        log('nibp', ok ? 'AKS ' + N.last.sys + '/' + N.last.dia + ' (' + N.last.map + ')' : 'AKS – ' + N.last.why.toLowerCase());
      }
    }
  }
  function cuff() { const N = S.nibp, pk = N.peak || 180; if (!N.meas) return 0; const e = (Date.now() - N.meas) / 1000; return e < 6 ? Math.round(e / 6 * pk) : Math.max(0, Math.round(pk - (e - 6) * 9)); }

  // ── defibriliacija ──
  function shock(j, r, v, sync) {
    S.shk = now(); S.shkJ = Math.max(1, Math.min(400, Math.round(+j || 200))); S.shkS = sync ? 1 : 0;
    if (r && RH.some(x => x[0] === r)) S.rhythm = r;
    resetBeats();
    if (v && typeof v === 'object') apply(v, 0);
    if (ac && S.sound) { tone(90, 0.35, 0, 0.35 * AV(), 'triangle'); tone(55, 0.5, ac.currentTime + 0.02, 0.3 * AV()); }
    save(); fire();
  }

  // ── būsenos santrauka (instruktoriui, nuotoliniam ryšiui) ──
  const muted = () => S.mute && Date.now() < S.mute;
  function snapshot() {
    const c = cur(), pf = perf(c), A = S.alarms ? alarms(c, pf) : [];
    return { c, pf: Math.round(pf * 100) / 100, t: targets(), rhythm: S.rhythm, probe: Object.assign({}, S.probe), nibp: { mode: S.nibp.mode, last: S.nibp.last, meas: S.nibp.meas ? 1 : 0, stat: S.nibp.stat && Date.now() < S.nibp.stat ? 1 : 0 },
      alarms: S.alarms, sound: S.sound, beep: S.beep, a: A.map(x => x[1]), ap: A.map(x => x[0]), pri: A.length ? A[0][0] : 0, label: S.label, stage: S.stage,
      trend: P.some(k => S.tr[k].dur && now() - S.tr[k].t0 < S.tr[k].dur), hrs: hrShown(c), cfg: JSON.parse(JSON.stringify(CFG)), art: Object.assign({}, S.art),
      pace: { on: S.pace.on, rate: S.pace.rate, ma: S.pace.ma, cap: cap() ? 1 : 0 }, pause: S.pause, mute: muted() ? Math.ceil((S.mute - Date.now()) / 1000) : 0,
      el: elapsed(), son: J.ses.on, ln: J.n, lg: J.log.slice(-4), au: ac && ac.state === 'running' ? 1 : 0 };
  }
  function journal() { return { log: J.log.slice(), tr: J.tr.slice(), ses: { on: J.ses.on, el: elapsed(), start: J.ses.start }, n: J.n }; }

  // ── monitoriaus piešimas ──
  let run = 0, raf = 0, lastT = 0, ch = [], boxes = {}, lastNum = 0, lastAlarm = 0, alarmShown = '', mroot = null, lastNumKey = '', lastAlarmKeys = new Set(), alarmLogT = {};
  const COL = { classic: { ecg: '#3ee06a', pleth: '#38d5f2', resp: '#f4d54a', nibp: '#f2f2f2', temp: '#f6a35b', lw: 2 }, hc: { ecg: '#00ff44', pleth: '#00eeff', resp: '#ffff00', nibp: '#ffffff', temp: '#ffa31a', lw: 3 } };
  function mount(root) {
    stop(); run = 1; mroot = root; build(); size(); lastT = now();
    window.addEventListener('resize', size);
    raf = requestAnimationFrame(frame);
  }
  function build() {
    const K = COL[CFG.scheme] || COL.classic, sh = CFG.show;
    const CH = [['ecg', 'II', K.ecg, 1.25]].concat(sh.pleth ? [['pleth', 'Pleth', K.pleth, 1]] : [], sh.resp ? [['resp', 'Resp', K.resp, 0.8]] : []);
    const BX = [['hr', 'ŠSD', K.ecg, 'k./min'], ['spo2', 'SpO₂', K.pleth, '%'], ['nibp', 'AKS', K.nibp, 'mm Hg']].concat(sh.rr ? [['rr', 'KD', K.resp, 'k./min']] : [], sh.temp ? [['temp', 'T', K.temp, '°C']] : []);
    mroot.innerHTML = `<div class="mon${CFG.big ? ' big' : ''}${CFG.scheme === 'hc' ? ' hc' : ''}" id="mon"><div class="mtop"><span class="mlb" id="mlb"></span><span class="mal" id="mal" data-act="alist" role="status" aria-live="assertive"></span><span class="mtm" id="mtm"></span><span class="mclk" id="mclk"></span></div>` +
      `<div class="mwav" style="--wr:${CH.map(c => c[3] + 'fr').join(' ')}">${CH.map(([k, l, col]) => `<div class="mch"><span class="mchl" style="color:${col}" id="chl-${k}" data-act="mon-ch" data-k="${k}" role="button" aria-label="${l}: greitis ir amplitudė">${l}</span><canvas data-ch="${k}"></canvas></div>`).join('')}</div>` +
      `<div class="mnum" id="mnum" style="--n:${BX.length}">${BX.map(([k, l, col, u]) => `<div class="mbx" data-k="${k}"${k === 'nibp' ? ' data-act="mon-nibp"' : ''}><span class="mbl" style="color:${col}">${l}</span><b style="color:${col}"></b><span class="mbu"></span><span class="mbn">${u}</span></div>`).join('')}</div></div>`;
    ch = CH.map(([k, l, col]) => { const cv = mroot.querySelector(`canvas[data-ch="${k}"]`); return { k, col, cv, cx: cv.getContext('2d', { alpha: false }), x: 0, py: null, w: 0, h: 0, dpr: 1, frac: 0 }; });
    boxes = {}; BX.forEach(([k]) => { const el = mroot.querySelector(`.mbx[data-k="${k}"]`); boxes[k] = { el, b: el.querySelector('b'), u: el.querySelector('.mbu') }; });
    chLabel(); lastNum = 0;
  }
  function chLabel() {
    const f = x => String(x).replace('.', ','), e = document.getElementById('chl-ecg'), p = document.getElementById('chl-pleth'), r = document.getElementById('chl-resp');
    if (e) e.textContent = 'II  ×' + f(CFG.gain) + '  ' + f(CFG.speed) + ' mm/s';
    if (p) p.textContent = 'Pleth' + ((CFG.pgain || 1) !== 1 ? '  ×' + f(CFG.pgain) : '');
    if (r) r.textContent = 'Resp' + ((CFG.rgain || 1) !== 1 ? '  ×' + f(CFG.rgain) : '');
  }
  function size() {
    ch.forEach(c => { const r = c.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; c.dpr = d; c.w = Math.max(10, Math.round(r.width * d)); c.h = Math.max(10, Math.round(r.height * d)); c.cv.width = c.w; c.cv.height = c.h; c.x = 0; c.py = null; c.cx.fillStyle = '#000'; c.cx.fillRect(0, 0, c.w, c.h); });
  }
  function stop() { run = 0; if (raf) cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', size); }
  const PXMM = () => (window.devicePixelRatio || 1) * 3.78 * 0.62; // ~25 mm/s telefono ekrane (sumažinta, kad tilptų ≥ 4 s)
  function frame() {
    if (!run) return;
    raf = requestAnimationFrame(frame);
    const t = now(), rt = rnow(); const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
    if (!S.pause && dt > 0) {
      rrHz = Math.max(0.05, val('rr') / 60);
      schedule(t);
      const c = cur(), pf = perf(c);
      // pulso pyptelėjimas
      if (S.beep && S.probe.spo2 && pf > 0 && ac) { for (const b of beats) { if (b > lastBeepBeat && b <= t) { lastBeepBeat = b; tone(beepF(c.spo2), 0.07, 0, 0.12 * BV()); } } }
      const K = COL[CFG.scheme] || COL.classic;
      ch.forEach(C => draw(C, t, dt, pf, K.lw));
      nibpTick(c);
      sample(c, pf);
    }
    if (rt - lastNum > 0.5) { lastNum = rt; const c = cur(); nums(c, perf(c)); }
  }
  function draw(C, t, dt, pf, lw) {
    if (C.w < 20) return;
    const mm = C.k === 'resp' ? CFG.speed / 4 : CFG.speed;
    const px = mm * PXMM() * dt + C.frac; let n = Math.floor(px); C.frac = px - n; if (n < 1) return; n = Math.min(n, C.w);
    const cx = C.cx, gap = Math.round(14 * C.dpr), amp = C.h * 0.36, sdt = dt / n, gain = CFG.gain;
    // išvalyti priekį (su tarpu)
    cx.fillStyle = '#000';
    const x0 = C.x, w0 = n + gap;
    cx.fillRect(x0, 0, Math.min(w0, C.w - x0), C.h); if (x0 + w0 > C.w) cx.fillRect(0, 0, x0 + w0 - C.w, C.h);
    cx.strokeStyle = C.col; cx.lineWidth = lw * C.dpr; cx.lineJoin = 'round'; cx.beginPath();
    let open = false;
    for (let i = 0; i < n; i++) {
      const ts = t - dt + sdt * (i + 1); let v;
      if (C.k === 'ecg') v = C.h * 0.62 - ecg(ts, sdt) * amp * 0.95 * gain;
      else if (C.k === 'pleth') v = C.h * 0.85 - pleth(ts, pf) * C.h * 0.62 * (CFG.pgain || 1);
      else v = C.h * 0.82 - resp(ts) * C.h * 0.6 * (CFG.rgain || 1);
      v = Math.max(lw * C.dpr, Math.min(C.h - lw * C.dpr, v));
      if (C.py != null && C.x > 0) { if (!open) { cx.moveTo(C.x - 1, C.py); open = true; } cx.lineTo(C.x, v); }
      C.py = v; C.x += 1;
      if (C.x >= C.w) { if (open) cx.stroke(); cx.beginPath(); open = false; C.x = 0; C.py = null; }
    }
    if (open) cx.stroke();
  }
  function sample(c, pf) {
    if (!J.ses.on || !J.ses.run) return;
    const e = Math.round(elapsed() / 1000), L = J.tr[J.tr.length - 1];
    if (L && e - L[0] < 5) return;
    const h = hrShown(c), noP = !cap() && (NOPULSE[S.rhythm] || (S.rhythm === 'vt' && c.sys < 60));
    J.tr.push([e, h, S.probe.spo2 && pf > 0 ? c.spo2 : null, noP ? 0 : c.sys, c.rr]);
    if (J.tr.length > 3000) J.tr.shift();
    saveJ();
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
  function setBox(k, big, sub, warn) {
    const e = boxes[k]; if (!e) return;
    if (e._b !== big) { e.b.innerHTML = big; e._b = big; }
    if (e._s !== sub) { e.u.innerHTML = sub; e._s = sub; }
    const cls = 'mbx' + (warn ? ' w' + warn : ''); if (e._c !== cls) { e.el.className = cls; e._c = cls; }
  }
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s % 60).padStart(2, '0'); };
  function nums(c, pf) {
    if (!boxes.hr) return;
    const A = S.alarms ? alarms(c, pf) : [];
    const h = hrShown(c), hr = h == null ? '---' : String(h);
    const sp = !S.probe.spo2 || pf <= 0 ? '--' : String(c.spo2);
    const N = S.nibp, L = N.last, auto = N.stat && Date.now() < N.stat ? 'STAT' : N.mode ? 'auto ' + N.mode + ' min' : 'rankinis';
    let bp = '---/---', bsub = auto + ' · palieskite', bw = 0;
    if (N.meas) { bp = '<small>' + cuff() + '</small>'; bsub = 'Matuojama…'; }
    else if (L && L.ok) { bp = L.sys + '/' + L.dia; bsub = '(' + L.map + ') · ' + hhmm(L.t) + ' · ' + auto; bw = limPri('sys', L.sys); }
    else if (L) { bsub = L.why + ' · ' + hhmm(L.t); bw = 1; }
    const hrw = !S.probe.ecg ? 0 : cap() ? limPri('hr', h) : S.rhythm === 'asys' || S.rhythm === 'vf' || S.rhythm === 'vt' ? 2 : limPri('hr', h);
    const hsub = cap() ? 'Stimuliacija ' + S.pace.ma + ' mA' : S.pace.on ? 'Stim. – nėra pagavimo' : CFG.rhy ? rhName() : '';
    setBox('hr', hr, hsub, hrw);
    setBox('spo2', sp, S.probe.spo2 && pf > 0 ? bar(pf) : S.probe.spo2 ? '' : 'Zondas nuimtas', sp === '--' ? 1 : limPri('spo2', c.spo2));
    setBox('nibp', bp, bsub, bw);
    setBox('rr', String(c.rr), '', limPri('rr', c.rr));
    setBox('temp', fmt('temp', c.temp), '', limPri('temp', c.temp));
    const mal = document.getElementById('mal'), mlb = document.getElementById('mlb'), clk = document.getElementById('mclk'), mtm = document.getElementById('mtm');
    if (mlb) { const t = [CFG.pat, CFG.scen ? [S.label, S.stage].filter(Boolean).join(' · ') : ''].filter(Boolean).join(' · '); if (mlb.textContent !== t) mlb.textContent = t; }
    if (clk) clk.textContent = hhmm(Date.now());
    if (mtm) { const t = CFG.clock && J.ses.on ? '⏱ ' + mmss(elapsed()) : ''; if (mtm.textContent !== t) mtm.textContent = t; }
    const mu = muted(), shk = now() - S.shk < 3;
    let msg = '', cls = 'mal';
    if (S.pause) { msg = 'PAUZĖ'; cls += ' p0'; }
    else if (shk) { msg = '⚡ ' + (S.shkS ? 'KARDIOVERSIJA ' : 'IŠKROVA ') + S.shkJ + ' J'; cls += ' p1'; }
    else if (A.length) { const G = A.filter(a => a[0] === A[0][0]), i = Math.floor(Date.now() / 2500) % G.length; msg = G[i][1] + (G.length > 1 ? '  ' + (i + 1) + '/' + G.length : '') + (A.length > G.length ? '  +' + (A.length - G.length) : ''); cls += ' p' + G[i][0]; }
    if (mu && A.length && !S.pause) msg += '  🔕 ' + mmss(S.mute - Date.now());
    if (mal) { if (mal.textContent !== msg) mal.textContent = msg; if (mal.className !== cls) mal.className = cls; }
    if (A.length && !mu && !S.pause && ac) { const per = A[0][0] === 2 ? 5 : 15; if (Date.now() - lastAlarm > per * 1000 || alarmShown !== A[0][1] && Date.now() - lastAlarm > 2500) { lastAlarm = Date.now(); alarmShown = A[0][1]; alarmTone(A[0][0]); } }
    // naujų aliarmų įrašas žurnale
    if (!S.pause && J.ses.on) {
      const keys = new Set();
      A.forEach(a => { const k = a[0] + a[1].replace(/[\d,]+/g, '#'); keys.add(k); if (!lastAlarmKeys.has(k) && Date.now() - (alarmLogT[k] || 0) > 60000) { alarmLogT[k] = Date.now(); log('alarm', (a[0] === 2 ? '‼ ' : '! ') + a[1]); } });
      lastAlarmKeys = keys;
    }
  }
  const bar = pf => '<i class="pfb"><i style="width:' + Math.round(Math.max(0.08, pf) * 100) + '%"></i></i>';
  const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const rhName = r => (RH.find(x => x[0] === (r || S.rhythm)) || [0, ''])[1];
  function muteAlarms(min) { S.mute = Date.now() + (min || 2) * 60000; fire(); }
  function unmute() { S.mute = 0; fire(); }
  function alarmList() { const c = cur(); return S.alarms ? alarms(c, perf(c)) : []; }
  // testams: „pasukti“ laiką į priekį (tendencijos, laikmatis, AKS)
  function ff(sec) {
    const ms = sec * 1000; P.forEach(k => { S.tr[k].t0 -= sec; });
    if (J.ses.on) { if (J.ses.run) J.ses.t0 -= ms; else J.ses.acc += ms; }
    if (S.nibp.meas) S.nibp.meas -= ms; if (S.nibp.next) S.nibp.next -= ms;
  }

  return { P, DEF, LIM, RH, LIM0, SPEEDS, GAINS, NOISES, CFG0, apply, setRhythm, setProbe, setArt, setOpt, setLabel, setNibpMode, setPace, nibpStart, nibpStat, reset, shock, snapshot, targets, on, mount, stop, audio, testSound,
    muteAlarms, unmute, cur, perf: () => perf(cur()), state: () => S, cfg: () => CFG, setCfg, alarmList, rhName, mmss,
    log, journal, elapsed, sesStart, sesNew, setPause,
    _ecg: ecg, _alarms: () => alarms(cur(), perf(cur())), _ff: ff, _beats: () => beats.slice() };
})();
