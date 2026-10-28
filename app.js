'use strict';
// ───────── SIM – programėlės eiga: pradžia, monitorius, instruktoriaus pultas, scenarijai, žurnalas, nustatymai ─────────
const VER = 'v6 · 2026-10-28';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
const ICO = {
  mon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M5 11h3l1.5-3 2.5 6 2-4h5"/><path d="M8 21h8M12 17v4"/></svg>',
  ctrl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M3 3l18 18"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5v14l9-7zM15.5 5h3v14h-3z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5v14l-9-7zM5.5 5h3v14h-3z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>'
};

// ───────── scenarijai ─────────
const allScen = () => (window.SIMS || []).map(s => Object.assign({ src: 'SIM' }, s)).concat(window.SIMX || []);
const scenBy = (src, id) => allScen().find(s => s.src === src && s.id === id) || null;
const durTxt = d => { d = Math.round(+d || 0); return d >= 60 ? (d % 60 ? Math.floor(d / 60) + ' min ' + (d % 60) + ' s' : d / 60 + ' min') : d + ' s'; };
// etapo komanda: tikslinės reikšmės, ritmas (SIM scenarijuose paveldimas iš ankstesnio etapo), trukmė
function stageCmd(sc, i, d, useD) {
  const x = sc && sc.st[i]; if (!x) return null;
  const v = {}; SIM.P.forEach(k => { if (x.v && x.v[k] != null) v[k] = x.v[k]; });
  let r = null;
  if (sc.src === 'SIM') { for (let j = i; j >= 0 && !r; j--) r = sc.st[j].v && sc.st[j].v.r; r = r || 'sinus'; } else r = (x.v && x.v.r) || (i === 0 ? 'sinus' : null);
  const dd = useD && x.d != null && isFinite(x.d) ? Math.max(0, +x.d) : (+d || 0);
  return { c: 'apply', v, d: dd, td: +d || 0, r, l: sc.pav, s: x.n, sc: { src: sc.src, id: sc.id, i } };
}

// ───────── monitoriaus pusė: komandų vykdymas, žurnalas, scenarijaus eiga ─────────
const LB = { hr: ['ŠSD', 'k./min', 5, 0, 220, 1], spo2: ['SpO₂', '%', 1, 50, 100, 1], sys: ['AKS sist.', 'mm Hg', 5, 0, 240, 1], dia: ['AKS diast.', 'mm Hg', 5, 0, 160, 1], rr: ['KD', 'k./min', 2, 0, 50, 1], temp: ['T', '°C', 0.1, 30, 42, 0.1] };
const f1 = (k, v) => k === 'temp' ? (+v).toFixed(1).replace('.', ',') : String(Math.round(v));
const PRB = { ecg: ['EKG elektrodai prijungti', 'EKG elektrodai atjungti'], spo2: ['SpO₂ zondas uždėtas', 'SpO₂ zondas nuimtas'], nibp: ['AKS manžetė uždėta', 'AKS manžetė nuimta'] };
const OPTN = { sound: 'Garsas', beep: 'Pulso pyptelėjimas', alarms: 'Aliarmai' };
let PLAY = LSg('sim-play', null), PREF = Object.assign({ auto: 0, useD: 1 }, LSg('sim-playpref6', {}));
function setPlay(p) { PLAY = p; LSs('sim-play', p); }
function diffTxt(a, b) { return SIM.P.filter(k => Math.abs(a[k] - b[k]) > 0.05).map(k => LB[k][0] + ' ' + f1(k, a[k]) + '→' + f1(k, b[k])).join(', '); }
function exec(o) {
  if (!o || typeof o !== 'object' || typeof o.c !== 'string') return;
  const T0 = SIM.targets(), st = SIM.state(), r0 = st.rhythm, L = SIM.log, per = o.d ? ' (per ' + durTxt(o.d) + ')' : '';
  const okR = r => SIM.RH.some(x => x[0] === r);
  switch (o.c) {
    case 'apply': {
      SIM.sesStart();
      if (o.r && okR(o.r)) SIM.setRhythm(o.r);
      SIM.apply(o.v || {}, o.d || 0);
      if (o.l != null || o.s != null) SIM.setLabel(o.l, o.s);
      const what = [diffTxt(T0, SIM.targets()), o.r && o.r !== r0 && okR(o.r) ? 'ritmas – ' + SIM.rhName(o.r) : ''].filter(Boolean).join('; ');
      if (o.ev) L('mark', String(o.ev).slice(0, 80));
      if (o.sc && typeof o.sc === 'object') {
        const i = Math.max(0, +o.sc.i || 0);
        setPlay({ src: String(o.sc.src), id: String(o.sc.id), i, at: SIM.elapsed(), dur: +o.d || 0, td: o.td != null ? +o.td : +o.d || 0 });
        L('stage', (o.auto ? 'Automatiškai → ' : '') + 'Etapas ' + (i + 1) + ': ' + (o.s || '') + per);
      } else if (o.mk) L('macro', String(o.mk).slice(0, 40) + (what ? ': ' + what : '') + per);
      else if (what) L('set', what + per);
      break;
    }
    case 'rh': if (okR(o.r) && o.r !== r0) { SIM.sesStart(); SIM.setRhythm(o.r); L('rh', 'Ritmas: ' + SIM.rhName(o.r)); } break;
    case 'probe': if (PRB[o.k]) { SIM.setProbe(o.k, o.on); L('set', PRB[o.k][o.on ? 0 : 1]); } break;
    case 'art': if (o.k === 'cpr' || o.k === 'motion') { SIM.setArt(o.k, o.on); L('set', (o.k === 'cpr' ? 'KPR kompresijų artefaktas' : 'Judesio artefaktas') + (o.on ? ' įjungtas' : ' išjungtas')); } break;
    case 'opt': if (OPTN[o.k]) { SIM.setOpt(o.k, o.v); L('cfg', OPTN[o.k] + ': ' + (o.v ? 'įj.' : 'išj.')); } break;
    case 'nibp': if (o.stat) { SIM.nibpStat(); L('set', 'AKS STAT (5 min)'); } else { SIM.nibpStart(); L('set', 'AKS matavimas'); } break;
    case 'nmode': SIM.setNibpMode(o.m); L('cfg', 'AKS: ' + (+o.m ? 'auto ' + (+o.m) + ' min' : 'rankinis')); break;
    case 'label': SIM.setLabel(o.l, o.s); if (o.l === '') { if (PLAY) L('stage', 'Scenarijus baigtas'); setPlay(null); } break;
    case 'mute': if (o.off) { SIM.unmute(); L('sys', 'Aliarmų garsas grąžintas'); } else { const m = Math.max(1, Math.min(10, +o.m || 2)); SIM.muteAlarms(m); L('sys', 'Aliarmai nutildyti ' + m + ' min'); } break;
    case 'reset': SIM.reset(); setPlay(null); L('set', 'Atkurta norma'); break;
    case 'cfg': SIM.setCfg(o.v === 'def' ? 'def' : o.v); if (route() === 'monitorius') wake(); break;
    case 'mark': { const x = String(o.x || '').trim().slice(0, 80); if (x) { SIM.sesStart(); L('mark', x); } break; }
    case 'shock':
      if (o.sync && ['vf', 'asys', 'pea'].indexOf(r0) >= 0) { L('shock', 'Kardioversija neįvyko – nėra R bangų (' + SIM.rhName(r0) + ')'); break; }
      SIM.sesStart(); SIM.shock(o.j, okR(o.r) ? o.r : null, o.v, o.sync); L('shock', (o.sync ? 'Kardioversija ' : 'Defibriliacija ') + SIM.state().shkJ + ' J' + (okR(o.r) && o.r !== r0 ? ' → ' + SIM.rhName(o.r) : '')); break;
    case 'pace': { const a = JSON.stringify(st.pace); SIM.setPace(o); const p = SIM.state().pace; if (JSON.stringify(p) !== a) L('set', p.on ? 'Stimuliacija ' + p.rate + '/min, ' + p.ma + ' mA' : 'Stimuliacija išjungta'); break; }
    case 'pause': if (!!o.on !== !!st.pause) { SIM.setPause(o.on); L('sys', o.on ? 'Pauzė' : 'Tęsiama'); } break;
    case 'ses':
      if (o.a === 'new') { SIM.sesNew(); SIM.sesStart(); if (PLAY) { PLAY.at = 0; PLAY.dur = 0; setPlay(PLAY); } L('sys', 'Nauja sesija'); }
      else if (!SIM.journal().ses.on) { SIM.sesStart(); L('sys', 'Sesija pradėta'); }
      break;
    case 'play':
      if ('auto' in o) { PREF.auto = o.auto ? 1 : 0; if (PLAY && PREF.auto) { PLAY.at = SIM.elapsed(); PLAY.dur = 0; setPlay(PLAY); } L('sys', 'Automatinis etapų keitimas ' + (PREF.auto ? 'įjungtas' : 'išjungtas')); }
      if ('useD' in o) PREF.useD = o.useD ? 1 : 0;
      LSs('sim-playpref6', PREF); break;
    case 'test': SIM.testSound(); break;
  }
}
// kitas automatinis etapas: st.nx (jei nurodytas) arba i + 1
function nextIdx(sc, i) { const st = sc && sc.st[i]; if (!st) return -1; const n = st.nx != null && isFinite(st.nx) ? +st.nx : i + 1; return n >= 0 && n < sc.st.length && n !== i ? n : -1; }
function playLeft() {
  if (!PLAY || !PREF.auto) return null;
  const sc = scenBy(PLAY.src, PLAY.id), st = sc && sc.st[PLAY.i];
  if (!st || st.auto == null || !isFinite(st.auto) || nextIdx(sc, PLAY.i) < 0) return null;
  return (PLAY.at + (PLAY.dur + (+st.auto)) * 1000 - SIM.elapsed()) / 1000;
}
function playInfo() {
  const o = { auto: PREF.auto, useD: PREF.useD };
  if (PLAY) { const l = playLeft(); Object.assign(o, { src: PLAY.src, id: PLAY.id, i: PLAY.i, left: l == null ? null : Math.max(0, Math.ceil(l)) }); }
  return o;
}
function playTick() {
  if (route() !== 'monitorius' || SIM.state().pause) return;
  const l = playLeft(); if (l == null || l > 0) return;
  const sc = scenBy(PLAY.src, PLAY.id), o = stageCmd(sc, nextIdx(sc, PLAY.i), PLAY.td || 0, PREF.useD); if (!o) return;
  o.auto = 1; exec(o); pushSnap();
  if ($('#drawer.on') && !inputBusy()) rerenderPanel();
}
setInterval(playTick, 500);
function hostSnap() { const s = SIM.snapshot(); s.pl = playInfo(); return s; }
function hostSend(o) { let n = 0; if (RTC.role() === 'host' && RTC.open() && RTC.send(o)) n++; if (RELAY.role() === 'host' && RELAY.up() && RELAY.send(o)) n++; return n > 0; }
function pushSnap() { if (route() === 'monitorius') hostSend({ c: 'snap', s: hostSnap() }); }
setInterval(pushSnap, 1000);

// ───────── ryšys ─────────
let remoteSnap = null, remoteT = 0, rtcState = 'off', relState = 'off', rtt = 0, remoteDump = null, dumpReqT = 0, pushT = 0;
const sig = s => s ? JSON.stringify([s.rhythm, s.probe, s.nibp && s.nibp.mode, s.nibp && s.nibp.stat, s.sound, s.beep, s.alarms, s.label, s.stage, s.t, s.cfg, s.art, s.pace, s.pause, !!s.mute, s.son, s.pl && [s.pl.src, s.pl.id, s.pl.i, s.pl.auto, s.pl.useD]]) : '';
function onLinkMsg(host, o) {
  if (!o || typeof o !== 'object') return;
  if (host) {
    if (o.c === 'ping') { hostSend({ c: 'pong', id: o.id, t: o.t }); return; }
    if (o.c === 'dump') { const j = SIM.journal(); if (j.tr.length > 720) { const k = Math.ceil(j.tr.length / 720); j.tr = j.tr.filter((x, i) => i % k === 0 || i === j.tr.length - 1); } j.log = j.log.slice(-300); hostSend({ c: 'dump', j }); return; }
    exec(o); clearTimeout(pushT); pushT = setTimeout(pushSnap, 60);
    if ($('#drawer.on') && !inputBusy()) rerenderPanel();
    return;
  }
  if (o.c === 'pong') { if (o.t) rtt = Math.max(1, Date.now() - o.t); return; }
  if (o.c === 'dump') { remoteDump = o.j; if (UI.tab === 'log' && !inputBusy()) rerenderTab(); return; }
  if (o.c !== 'snap' || !o.s) return;
  const old = sig(remoteSnap); remoteSnap = o.s; remoteT = Date.now(); mirror();
  if ((route() === 'instruktorius' || route() === 'nustatymai') && sig(remoteSnap) !== old && !inputBusy()) rerenderPanel();
}
RTC.onMsg = o => onLinkMsg(RTC.role() === 'host', o);
RELAY.onMsg = o => onLinkMsg(RELAY.role() === 'host', o);
const isHost = () => RELAY.role() === 'host' || RTC.role() === 'host';
const linkOn = () => RTC.open() || RELAY.open();
const ctrlOn = () => linkOn() && !isHost();
const rsend = o => !!((RTC.open() && RTC.role() === 'ctrl' && RTC.send(o)) || (RELAY.role() === 'ctrl' && RELAY.send(o)));
RTC.onState = s => { rtcState = s; if (s === 'on') toast(RTC.role() === 'host' ? 'Instruktorius prijungtas' : 'Prijungta prie monitoriaus'); if (s === 'lost' || s === 'off') { if (RTC.role()) toast('Ryšys nutrūko'); } refresh(); };
RELAY.onState = s => {
  const prev = relState; relState = s;
  if (s === 'on' && prev !== 'on') toast(RELAY.role() === 'host' ? 'Instruktorius prijungtas' : 'Prijungta prie monitoriaus');
  if (prev === 'on' && s !== 'on' && RELAY.role()) toast(RELAY.role() === 'host' ? 'Instruktorius neprisijungęs' : 'Ryšys su monitoriumi nutrūko – jungiamasi iš naujo');
  refresh();
};
function refresh() { if (route() === 'monitorius') { if ($('#drawer.on') && !inputBusy()) rerenderPanel(); } else if (route() === 'instruktorius' || route() === 'nustatymai') { if (!inputBusy()) { const y = scrollY; render(); scrollTo(0, y); } } }
// atsako laikas (ping) – instruktoriaus pusėje
let pingN = 0;
setInterval(() => { if (ctrlOn() && route() !== 'monitorius') rsend({ c: 'ping', id: ++pingN, t: Date.now() }); }, 3000);
const joinUrl = code => location.origin + location.pathname + '#/instruktorius?k=' + code;
const fmtRoom = c => c.slice(0, 3) + '-' + c.slice(3);
const isHostRoute = () => route() === 'monitorius';

// ───────── instruktoriaus pultas (bendras: monitoriaus stalčius ir nuotolinis telefonas) ─────────
const DUR = [[0, 'Iš karto'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min']];
const MAC = [['worse', 'Blogėja'], ['better', 'Gerėja'], ['shock', 'Šokas ↑'], ['hypox', 'Hipoksija ↑'], ['stab', 'Stabilizuoti']];
const MARKS = ['Turniketas', 'Tamponada / tvarstis', 'Dekompresija', 'Kvėpavimo takai', 'Intubacija', 'Krikotiroidotomija', 'Deguonis', 'IV / IO prieiga', 'TXA', 'Kraujas', 'Skysčiai', 'Kalcis', 'Adrenalinas', 'Analgezija', 'Šildymas', 'KPR pradėtas', 'KPR baigtas', 'Evakuacija'];
const TABS = [['ctl', 'Rodikliai', 'Rodikl.'], ['sc', 'Scenarijus', 'Scen.'], ['act', 'Veiksmai', 'Veiksm.'], ['log', 'Žurnalas', 'Žurn.'], ['set', 'Nustatymai', 'Nust.'], ['link', 'Ryšys', 'Ryšys']];
const TICO = {
  ctl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2.5-6 4 12 2.5-6H22"/></svg>',
  sc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/></svg>',
  act: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19V5M4 19h16"/><path d="M7 15l4-5 3 3 5-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
};
const SHR = [['', 'Nekinta'], ['sinus', 'Sinusinis'], ['vf', 'Skilv. virpėjimas'], ['asys', 'Asistolija'], ['pea', 'BEA']];
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
let draft = {}, dur = LSg('sim-dur', 30), scen = LSg('sim-scen', null), scenList = false, scenQ = '', favs = LSg('sim-fav', []), markTxt = '';
let UI = Object.assign({ live: 0, sl: 1, tab: 'ctl', alm: 0, favEdit: 0, shJ: 200, shR: '', sync: 0, so: {}, ssrc: '', stema: '' }, LSg('sim-ui', {}));
const saveUI = () => LSs('sim-ui', UI);
// kur siunčiamos komandos: monitoriuje ir neprisijungus nustatymuose – vietoje, kitaip – nuotoliniam monitoriui
const tgt = () => route() === 'monitorius' ? 'local' : route() === 'nustatymai' && !ctrlOn() ? 'local' : 'remote';
const mode = tgt;
const snap = () => tgt() === 'local' ? hostSnap() : remoteSnap;
const send = o => { if (tgt() === 'local') { exec(o); pushSnap(); setTimeout(mirror, 30); return true; } if (rsend(o)) return true; toast('Nėra ryšio su monitoriumi'); return false; };
const findScen = () => scen ? scenBy(scen.src, scen.id) : null;
function curScen(s) { if (s && s.pl && s.pl.src) { const x = scenBy(s.pl.src, s.pl.id); if (x) return x; } return findScen(); }
function curIdx(sc, s) { if (!sc || !s) return -1; if (s.pl && s.pl.src === sc.src && s.pl.id === sc.id) return +s.pl.i; return sc.st.findIndex(x => s.stage === x.n && s.label === sc.pav); }
let slDrag = 0;
function inputBusy() { const ae = document.activeElement; return slDrag || !!(ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && ae.type !== 'range' && ae.type !== 'checkbox'))); }
const T = () => (snap() || {}).t || SIM.targets();
const hrOf = s => s.hrs !== undefined ? (s.hrs == null ? '---' : s.hrs) : !s.probe.ecg || s.rhythm === 'vf' ? '---' : s.rhythm === 'asys' ? 0 : s.rhythm === 'vt' ? Math.max(140, s.c.hr) : s.c.hr;
function mirrorHtml() {
  const s = snap();
  if (!s) return '<p class="muted">Laukiama duomenų iš monitoriaus…</p>';
  const c = s.c, L = s.nibp.last, nop = { vf: 1, asys: 1, pea: 1 }[s.rhythm] && !(s.pace && s.pace.cap);
  const cell = (l, v, u) => `<div><small>${l}</small><b>${v}</b><small>${u}</small></div>`;
  const ex = [];
  if (s.pause) ex.push('<b class="trd">PAUZĖ</b>');
  if (nop) ex.push('<b>be pulso</b>');
  if (s.trend) ex.push('<span class="trd">kinta…</span>');
  if (s.pace && s.pace.on) ex.push('stim. ' + s.pace.rate + '/' + s.pace.ma + ' mA' + (s.pace.cap ? '' : ' – nėra pagavimo'));
  if (s.art && (s.art.cpr || s.art.motion)) ex.push('artefaktas');
  return `<div class="mir">${cell('ŠSD', hrOf(s), 'k./min')}${cell('SpO₂', s.probe.spo2 && s.pf > 0 ? c.spo2 : '--', '%')}` +
    `${cell('AKS', s.nibp.meas ? '…' : L && L.ok ? L.sys + '/' + L.dia : '---', L && L.ok ? 'išm. ' + new Date(L.t).toTimeString().slice(0, 5) : 'mm Hg')}${cell('KD', c.rr, 'k./min')}${cell('T', f1('temp', c.temp), '°C')}</div>` +
    `<div class="mirs">${esc(SIM.rhName(s.rhythm))}${ex.length ? ' · ' + ex.join(' · ') : ''}</div>` +
    (s.a && s.a.length ? `<div class="mira p${s.pri}">${s.a.map(esc).join(' · ')}</div>` : '') +
    (s.au === 0 && s.sound ? '<div class="mira p1">⚠ Monitoriaus garsas neįjungtas – palieskite monitoriaus ekraną</div>' : '');
}
function mirror() { const el = $('#mirror'); if (el) el.innerHTML = mirrorHtml(); }
function cstHtml() {
  if (!linkOn() || isHost()) return '<span class="cst" id="cst">○ Neprijungta</span>';
  const age = remoteT ? Math.round((Date.now() - remoteT) / 1000) : null, stale = age == null || age > 3;
  return `<span class="cst ${stale ? 'warn' : 'on'}" id="cst">● Prijungta<small>${stale ? (age == null ? 'laukiama duomenų' : 'duomenys prieš ' + age + ' s') : rtt ? rtt + ' ms' : ''}</small></span>`;
}
function chip(act, k, on, t, extra) { return `<button class="chip${on ? ' on' : ''}" data-act="${act}" data-k="${esc(k)}" aria-pressed="${on ? 'true' : 'false'}"${extra || ''}>${t}</button>`; }
const tog = (act, k, on, t) => chip(act, k, on, (on ? '✓ ' : '') + t);
const tabs = () => TABS.filter(t => t[0] !== 'link' || tgt() === 'local' && route() === 'monitorius');
function tabsHtml() {
  if (!tabs().some(t => t[0] === UI.tab)) UI.tab = 'ctl';
  const L = tabs();
  return `<nav class="tabs n${L.length}" role="tablist">` + L.map(([k, t, sh]) => `<button class="tab${UI.tab === k ? ' on' : ''}" data-act="tab" data-k="${k}" role="tab" aria-selected="${UI.tab === k}" aria-label="${t}">${TICO[k] || ICO.cog}<span class="tl">${t}</span><span class="ts">${sh}</span></button>`).join('') + '</nav>';
}
function stripHtml(compact) {
  const s = snap() || {};
  if (compact) return `<span class="tmr">${ICO.clock}<b id="tmrv">${s.son ? SIM.mmss(s.el) : '--:--'}</b></span>` +
    `<button class="sb ic${s.pause ? ' on' : ''}" data-act="pause" aria-label="${s.pause ? 'Tęsti' : 'Pauzė'}">${s.pause ? ICO.play : ICO.pause}</button>` +
    `<button class="sb ic${s.mute ? ' on' : ''}" data-act="${s.mute ? 'unmute' : 'mute'}" aria-label="Aliarmų nutildymas">${ICO.mute}<span id="mutv">${s.mute ? SIM.mmss(s.mute * 1000) : ''}</span></button>`;
  return `<div class="strip"><span class="tmr">${ICO.clock}<b id="tmrv">${s.son ? SIM.mmss(s.el) : '--:--'}</b></span>` +
    `<button class="sb${s.pause ? ' on' : ''}" data-act="pause" aria-label="${s.pause ? 'Tęsti' : 'Pauzė'}">${s.pause ? ICO.play + 'Tęsti' : ICO.pause + 'Pauzė'}</button>` +
    `<button class="sb${s.mute ? ' on' : ''}" data-act="${s.mute ? 'unmute' : 'mute'}" aria-label="Aliarmų nutildymas">${ICO.mute}<span id="mutv">${s.mute ? SIM.mmss(s.mute * 1000) : '2 min'}</span></button></div>`;
}
function headHtml() { return `<div id="mirror" class="mirw">${mirrorHtml()}</div>` + stripHtml(); }
function tabBody() {
  switch (UI.tab) { case 'sc': return scTab(); case 'act': return actTab(); case 'log': return logTab(); case 'set': return setTab(); case 'link': return linkTab(); default: return ctlTab(); }
}
const durChips = () => '<div class="chips">' + DUR.map(([d, t]) => chip('dur', d, dur === d, t)).join('') + '</div>';

// ── Rodikliai ──
function prRow(k, Tv) {
  const [l, u, , mn, mx, stp] = LB[k], v = k in draft ? draft[k] : Tv[k];
  return `<div class="pr${k in draft ? ' ch' : ''}" data-k="${k}"><span class="prl">${l}<small>${u}</small></span>` +
    `<button class="pb" data-act="d-" data-k="${k}" aria-label="${l} mažiau">−</button><input class="inp pv" data-k="${k}" inputmode="decimal" value="${f1(k, v)}" aria-label="${l}"><button class="pb" data-act="d+" data-k="${k}" aria-label="${l} daugiau">+</button>` +
    (UI.sl ? `<input type="range" class="sl" data-k="${k}" min="${mn}" max="${mx}" step="${stp}" value="${v}" aria-label="${l} slankiklis">` : '') + '</div>';
}
function ctlTab() {
  const s = snap(), Tv = T(), n = Object.keys(draft).length, rh = s ? s.rhythm : 'sinus';
  let h = '<section class="pnl"><h2>Greitos komandos</h2><div class="mac">' + MAC.map(([k, t]) => `<button class="btn mb" data-act="mac" data-k="${k}">${t}</button>`).join('') + '</div>';
  h += '<h2>Pokytis per</h2>' + durChips();
  h += `<h2>Rodikliai${UI.live ? ' <span class="tag">keičiama iš karto</span>' : ''}</h2><div class="prm${UI.sl ? ' wsl' : ''}">` + SIM.P.map(k => prRow(k, Tv)).join('') + '</div>';
  if (!UI.live) h += `<div class="acts"><button class="btn pri" data-act="apply"${n ? '' : ' disabled'}>Taikyti${n ? ' (' + n + ')' : ''}</button><button class="btn" data-act="undo"${n ? '' : ' disabled'}>Atšaukti</button></div>`;
  h += '</section>';
  h += '<section class="pnl"><h2>Ritmas</h2><div class="chips">' + SIM.RH.map(([k, t]) => chip('rh', k, rh === k, t)).join('') + '</div>';
  h += '<h2>Defibriliacija / kardioversija</h2><div class="chips">' + [50, 100, 120, 150, 200, 360].map(j => chip('shj', j, UI.shJ === j, j + ' J')).join('') + tog('sync', 1, !!UI.sync, 'Sinchronizuota') + '</div>' +
    '<p class="lbl">Ritmas po iškrovos</p><div class="chips">' + SHR.map(([k, t]) => chip('shr', k, UI.shR === k, t)).join('') + '</div>' +
    `<div class="acts"><button class="btn shk" data-act="shock">${ICO.bolt}${UI.sync ? 'Kardioversija' : 'Iškrova'} ${UI.shJ} J</button></div>` + (UI.sync ? '<p class="muted">Sinchronizuota iškrova – SkT, SVT, PV (su pulsu). Skilvelių virpėjimo metu neįvyksta.</p>' : '') + '</section>';
  h += '<section class="pnl"><h2>Mėgstami</h2>' + (favs.length ? '<div class="chips">' + favs.map((f, i) => `<span class="fav">${chip('fav-go', i, false, esc(f.n))}${UI.favEdit ? `<button class="fx" data-act="fav-del" data-k="${i}" aria-label="Ištrinti ${esc(f.n)}">${ICO.x}</button>` : ''}</span>`).join('') + '</div>' : '<p class="muted mt0">Įsiminkite dabartines reikšmes ir ritmą – vėliau pritaikysite vienu paspaudimu.</p>') +
    `<div class="acts"><button class="btn" data-act="fav-add">＋ Įsiminti</button>${favs.length ? `<button class="btn" data-act="fav-edit">${UI.favEdit ? 'Baigti' : 'Tvarkyti'}</button>` : ''}</div></section>`;
  return h;
}
const R1 = (k, v) => { v = Math.max(SIM.LIM[k][0], Math.min(SIM.LIM[k][1], v)); return k === 'temp' ? Math.round(v * 10) / 10 : Math.round(v); };
function macro(k, t) {
  let v;
  if (k === 'worse') v = { hr: t.hr < 60 ? t.hr - 6 : t.hr * 1.1 + 2, spo2: t.spo2 - 3, sys: t.sys * 0.9, dia: t.dia * 0.9, rr: t.rr < 10 ? t.rr - 2 : t.rr + 3 };
  else if (k === 'better') { v = {}; SIM.P.forEach(p => { const d = SIM.DEF[p] - t[p]; v[p] = Math.abs(d) < (p === 'temp' ? 0.2 : 2) ? SIM.DEF[p] : t[p] + d * 0.35; }); }
  else if (k === 'shock') v = { hr: t.hr + 15, sys: t.sys - 15, dia: t.dia - 10, rr: t.rr + 4, spo2: t.spo2 - 1 };
  else if (k === 'hypox') v = { spo2: t.spo2 - 6, rr: t.rr + 4, hr: t.hr + 8 };
  else v = Object.assign({}, SIM.DEF);
  Object.keys(v).forEach(p => { v[p] = R1(p, v[p]); });
  return v;
}

// ── Scenarijus ──
function scTab() {
  const s = snap(), sc = curScen(s), idx = curIdx(sc, s), pl = (s && s.pl) || {};
  let h = '<section class="pnl"><h2>Scenarijus</h2>';
  if (scenList) {
    const q = scenQ.trim().toLowerCase(), A = allScen().filter(x => !UI.ssrc || x.src === UI.ssrc);
    const TM = { A: 'A – kvėp. takai', B: 'B – kvėpavimas', C: 'C – kraujotaka', D: 'D – neurologija', E: 'E – aplinka', PCC: 'PCC' };
    const tms = [...new Set(A.map(x => x.tema).filter(t => t && t !== '–'))];
    if (UI.stema && tms.indexOf(UI.stema) < 0) UI.stema = '';
    const L = A.filter(x => (!UI.stema || x.tema === UI.stema) && (!q || (x.pav + ' ' + x.id + ' ' + x.src + ' ' + (x.tema || '') + ' ' + (x.sal || '') + ' ' + (x.aprasas || '')).toLowerCase().includes(q)));
    h += `<input class="inp" id="scq" placeholder="Paieška (pvz. šokas, m12, kraujavimas)" value="${esc(scenQ)}" autocomplete="off" aria-label="Scenarijų paieška">`;
    h += '<div class="chips mt">' + [['', 'Visi'], ['SIM', 'SIM'], ['ETC', 'ETC'], ['March', 'March']].map(([k, t]) => chip('sc-src', k, UI.ssrc === k, t)).join('') + '</div>';
    if (tms.length > 1 && tms.length <= 16) h += '<div class="chips mt">' + chip('sc-tema', '', !UI.stema, 'Visos temos') + tms.sort().map(t => chip('sc-tema', t, UI.stema === t, esc(TM[t] || t))).join('') + '</div>';
    const grp = [['SIM', 'Monitoriaus scenarijai'], ['ETC', 'ETC gido scenarijai'], ['March', 'March gido scenarijai']];
    grp.forEach(([src, t]) => { const a = L.filter(x => x.src === src); if (a.length) h += `<h3>${t} (${a.length})</h3>` + a.map(x => `<button class="row" data-act="sc-pick" data-k="${esc(x.src + '|' + x.id)}"><span>${esc(x.pav)}<small>${esc(x.src === 'SIM' ? [x.st.length + ' ' + plural(x.st.length, 'etapas', 'etapai', 'etapų'), x.tema && x.tema !== '–' ? x.tema : '', x.sal].filter(Boolean).join(' · ') : x.id + (x.tema ? ' · ' + x.tema : '') + (x.lygis ? ' · ' + x.lygis : '') + ' · ' + x.st.length + ' ' + plural(x.st.length, 'klausimas', 'klausimai', 'klausimų'))}</small></span><i>›</i></button>`).join(''); });
    if (!L.length) h += '<p class="muted">Nieko nerasta.</p>';
    h += '<div class="acts"><button class="btn" data-act="sc-close">Uždaryti sąrašą</button></div>';
  } else if (sc) {
    const meta = [sc.src === 'SIM' ? 'SIM' : sc.src + ' ' + sc.id, sc.tema && sc.tema !== '–' ? sc.tema : ''].filter(Boolean).map(esc).join(' · ');
    const sal = sc.sal ? (sc.url && /^https?:\/\//.test(sc.url) ? `<a href="${esc(sc.url)}" target="_blank" rel="noopener">${esc(sc.sal)}</a>` : esc(sc.sal)) : sc.url && /^https?:\/\//.test(sc.url) ? `<a href="${esc(sc.url)}" target="_blank" rel="noopener">Šaltinis</a>` : '';
    h += `<div class="sch"><b>${esc(sc.pav)}</b><small>${meta}${sal ? ' · Šaltinis: ' + sal : ''}</small></div>`;
    if (sc.aprasas) h += `<details class="hlp ap"><summary>Aprašymas instruktoriui</summary><p>${esc(sc.aprasas)}</p></details>`;
    const hasAuto = sc.st.some(x => x.auto != null), hasD = sc.st.some(x => x.d != null);
    h += `<div class="tl"><button class="btn tlb" data-act="sc-prev" aria-label="Ankstesnis etapas"${idx <= 0 ? ' disabled' : ''}>${ICO.prev}</button>` +
      (hasAuto ? `<button class="btn tlb${pl.auto ? ' pri' : ''}" data-act="sc-auto" aria-pressed="${pl.auto ? 'true' : 'false'}">${pl.auto ? ICO.pause + 'Auto' : ICO.play + 'Auto'}</button>` : '') +
      `<button class="btn tlb pri2" data-act="sc-next"${idx >= sc.st.length - 1 ? ' disabled' : ''}>${ICO.next}Kitas etapas</button></div>`;
    h += `<p class="plc" id="plc">${plcTxt(s, sc)}</p>`;
    if (hasD) h += '<div class="chips">' + tog('sc-used', 1, !!pl.useD, 'Scenarijaus tempas (etapų laikai)') + '</div>';
    h += '<h2>Pokytis per</h2>' + durChips();
    h += '<div class="stg">' + sc.st.map((x, i) => { const m = [x.d != null && pl.useD ? 'per ' + durTxt(x.d) : '', x.auto != null ? 'auto ' + durTxt(x.auto) + (x.nx != null && +x.nx !== i + 1 ? ' → ' + (+x.nx + 1) : '') : ''].filter(Boolean).join(' · '); return `<button class="stb${i === idx ? ' on' : ''}" data-act="sc-st" data-k="${i}"><b>${i + 1}</b><span>${esc(x.n)}${m ? '<small>' + m + '</small>' : ''}</span></button>`; }).join('') + '</div>';
    const cur = sc.st[idx];
    if (cur) h += `<p class="note">${esc(cur.p)}${cur.k ? '<br><b>Klausimas:</b> ' + esc(cur.k) : ''}</p>`;
    if (Array.isArray(sc.ev) && sc.ev.length) h += '<h2>Intervencijos</h2><div class="chips">' + sc.ev.map((e, i) => chip('sc-ev', i, false, esc(e.n))).join('') + '</div>';
    h += '<div class="acts"><button class="btn" data-act="sc-list">Kitas scenarijus</button><button class="btn" data-act="sc-none">Be scenarijaus</button></div>';
  } else h += '<button class="btn pri wide" data-act="sc-list">Pasirinkti scenarijų</button><p class="muted">Arba keiskite rodiklius skiltyje „Rodikliai“.</p>';
  return h + '</section>';
}
function plcTxt(s, sc) {
  if (!s || !s.pl) return '';
  sc = sc || curScen(s); if (!sc) return '';
  if (s.pl.auto && s.pl.left != null) { const n = nextIdx(sc, curIdx(sc, s)); return (s.pause ? 'Pauzė · ' : '') + (n >= 0 ? 'Etapas ' + (n + 1) + ' po ' : 'Kitas etapas po ') + '<b>' + SIM.mmss(s.pl.left * 1000) + '</b>'; }
  if (s.pl.auto) return nextIdx(sc, curIdx(sc, s)) < 0 ? 'Paskutinis etapas' : 'Šis etapas automatiškai nesikeičia';
  return '';
}

// ── Veiksmai ──
function actTab() {
  const s = snap() || {}, pr = s.probe || { ecg: 1, spo2: 1, nibp: 1 }, art = s.art || {}, pc = s.pace || { on: 0, rate: 70, ma: 70 }, nb = s.nibp || {};
  let h = '<section class="pnl"><h2>Pažymėti veiksmą</h2><div class="chips">' + MARKS.map(m => chip('mark', m, false, m)).join('') + '</div>' +
    `<div class="paste"><input class="inp" id="markx" placeholder="Kitas veiksmas…" maxlength="80" value="${esc(markTxt)}" autocomplete="off" aria-label="Kitas veiksmas"><button class="btn" data-act="mark-c">Pažymėti</button></div></section>`;
  h += '<section class="pnl"><h2>AKS matavimas</h2><div class="chips">' + chip('nibp', '1', false, 'Matuoti dabar') + chip('nibp-stat', '1', !!nb.stat, 'STAT 5 min') + [0, 3, 5, 10, 15].map(m => chip('nmode', m, nb.mode === m && !nb.stat, m ? 'Auto ' + m + ' min' : 'Rankinis')).join('') + '</div></section>';
  h += '<section class="pnl"><h2>Jutikliai ir artefaktai</h2><div class="chips">' + [['ecg', 'EKG elektrodai'], ['spo2', 'SpO₂ zondas'], ['nibp', 'AKS manžetė']].map(([k, t]) => chip('probe', k, !!pr[k], (pr[k] ? '✓ ' : '✕ ') + t)).join('') +
    tog('art', 'motion', !!art.motion, 'Judesio artefaktas') + tog('art', 'cpr', !!art.cpr, 'KPR kompresijos') + '</div></section>';
  h += `<section class="pnl"><h2>Stimuliacija (pacing)</h2><div class="chips">${tog('pace-on', 1, !!pc.on, pc.on ? 'Įjungta' : 'Įjungti')}</div>` +
    `<div class="prm"><div class="pr"><span class="prl">Dažnis<small>/min</small></span><button class="pb" data-act="pace-r" data-k="-10" aria-label="Dažnis mažiau">−</button><span class="pv">${pc.rate}</span><button class="pb" data-act="pace-r" data-k="10" aria-label="Dažnis daugiau">+</button></div>` +
    `<div class="pr"><span class="prl">Srovė<small>mA</small></span><button class="pb" data-act="pace-m" data-k="-10" aria-label="Srovė mažiau">−</button><span class="pv">${pc.ma}</span><button class="pb" data-act="pace-m" data-k="10" aria-label="Srovė daugiau">+</button></div></div>` +
    `<p class="muted">${pc.on ? (pc.cap ? '✓ Pagavimas – ŠSD lygus stimuliacijos dažniui.' : 'Nėra pagavimo – didinkite srovę (slenkstis 60 mA).') : 'Pagavimas, kai srovė ≥ 60 mA (ne skilvelių virpėjimo metu).'}</p></section>`;
  h += '<section class="pnl"><h2>Atkūrimas</h2><p class="muted mt0">Normalūs rodikliai, sinusinis ritmas, jutikliai uždėti, artefaktai ir stimuliacija išjungti.</p><div class="acts"><button class="btn" data-act="reset">Atkurti normą</button></div></section>';
  return h;
}

// ── Žurnalas ir aptarimas ──
let chartTr = [];
function journalData() { return tgt() === 'local' ? SIM.journal() : remoteDump; }
function logTab() {
  const s = snap() || {}, J = journalData();
  let h = `<section class="pnl"><h2>Sesija</h2><div class="tbig"><b id="tmrbig">${s.son ? SIM.mmss(s.el) : '00:00'}</b><span>${s.son ? (s.pause ? 'pauzė' : 'vyksta') : 'nepradėta – prasidės nuo pirmo veiksmo'}</span></div><div class="acts">` +
    (s.son ? `<button class="btn" data-act="pause">${s.pause ? ICO.play + 'Tęsti' : ICO.pause + 'Pauzė'}</button>` : `<button class="btn pri" data-act="ses-start">${ICO.play}Pradėti</button>`) +
    '<button class="btn" data-act="ses-new">Nauja sesija</button></div></section>';
  if (!J) { if (tgt() === 'remote' && Date.now() - dumpReqT > 1500) { dumpReqT = Date.now(); setTimeout(() => rsend({ c: 'dump' }), 0); } return h + '<section class="pnl"><p class="muted">Kraunamas žurnalas iš monitoriaus…</p></section>'; }
  h += '<section class="pnl"><h2>Tendencijos</h2>' + chartHtml(J.tr, J.log) + '</section>';
  h += `<section class="pnl"><h2>Įvykiai</h2><div class="chips">${tog('alm', 1, !!UI.alm, 'Rodyti aliarmus ir AKS')}</div>${logList(J.log)}` +
    '<div class="acts"><button class="btn" data-act="log-copy">Kopijuoti</button><button class="btn" data-act="log-share">Dalytis</button></div></section>';
  logTab.n = J.n;
  return h;
}
function logList(log) {
  const L = (log || []).filter(x => UI.alm || (x.k !== 'alarm' && x.k !== 'nibp' && x.k !== 'cfg'));
  if (!L.length) return '<p class="muted">Įvykių dar nėra.</p>';
  return '<div class="lgl" id="lgl">' + L.map(x => `<div class="lgi k-${esc(x.k)}"><b>${SIM.mmss(x.e)}</b><span>${esc(x.x)}</span></div>`).join('') + '</div>';
}
function chartHtml(tr, log) {
  chartTr = tr || [];
  if (chartTr.length < 2) return '<p class="muted mt0">Grafikas atsiras sesijai prasidėjus (įrašoma kas 5 s).</p>';
  const W = 600, H = 64, maxE = Math.max(60, chartTr[chartTr.length - 1][0]), X = e => (e / maxE * W).toFixed(1);
  const mk = (log || []).filter(x => x.k === 'stage' || x.k === 'mark' || x.k === 'shock').map(x => `<line class="mk ${x.k}" x1="${X(x.e / 1000)}" x2="${X(x.e / 1000)}" y1="0" y2="${H}"/>`).join('');
  const S3 = [[1, 'ŠSD', 'k./min', '#3ee06a'], [2, 'SpO₂', '%', '#38d5f2'], [3, 'AKS sist.', 'mm Hg', '#f2f2f2']];
  const figs = S3.map(([i, nm, u, col]) => {
    const vals = chartTr.map(r => r[i]).filter(v => v != null); if (!vals.length) return '';
    const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); let lo = mn, hi = mx; if (hi - lo < 10) { lo -= 5; hi += 5; }
    const Y = v => (5 + (1 - (v - lo) / (hi - lo)) * (H - 10)).toFixed(1);
    let d = '', pen = false; chartTr.forEach(r => { if (r[i] == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(r[0]) + ' ' + Y(r[i]); pen = true; });
    return `<figure class="spk"><figcaption><i style="background:${col}"></i>${nm} <span>${mn}–${mx} ${u}</span></figcaption><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${nm} tendencija">${mk}<path d="${d}" stroke="${col}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg></figure>`;
  }).join('');
  return `<div class="spkw" id="spkw">${figs}<div class="xh" id="xh" hidden></div></div><div class="spkx"><span>00:00</span><span>${SIM.mmss(maxE * 1000)}</span></div>` +
    '<p class="rdo" id="rdo">Palieskite grafiką – reikšmės tuo metu.</p><p class="lgd"><i class="mk stage"></i>etapas <i class="mk mark"></i>veiksmas <i class="mk shock"></i>iškrova</p>';
}
function chartPoint(ev) {
  chartPoint.t = Date.now(); const w = $('#spkw'); if (!w || chartTr.length < 2) return;
  const r = w.getBoundingClientRect(), f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), maxE = Math.max(60, chartTr[chartTr.length - 1][0]), e = f * maxE;
  let best = chartTr[0]; chartTr.forEach(p => { if (Math.abs(p[0] - e) < Math.abs(best[0] - e)) best = p; });
  const xh = $('#xh'); if (xh) { xh.hidden = false; xh.style.left = (best[0] / maxE * 100) + '%'; }
  const v = (x, u) => x == null ? '--' : x + (u || '');
  const o = $('#rdo'); if (o) o.innerHTML = `<b>${SIM.mmss(best[0] * 1000)}</b> · ŠSD ${v(best[1])} · SpO₂ ${v(best[2], '%')} · AKS sist. ${v(best[3])} · KD ${v(best[4])}`;
}
function debriefTxt(J) {
  const st = J.ses && J.ses.start ? new Date(J.ses.start) : null, p2 = n => String(n).padStart(2, '0');
  const out = ['SIM – treniruotės ataskaita (1040 medkuopa)', (st ? 'Pradžia ' + st.getFullYear() + '-' + p2(st.getMonth() + 1) + '-' + p2(st.getDate()) + ' ' + p2(st.getHours()) + ':' + p2(st.getMinutes()) + ' · ' : '') + 'trukmė ' + SIM.mmss((J.ses && J.ses.el) || 0)];
  const rng = (i, nm, u) => { const v = (J.tr || []).map(r => r[i]).filter(x => x != null); return v.length ? nm + ' ' + Math.min.apply(null, v) + '–' + Math.max.apply(null, v) + ' ' + u : ''; };
  const sum = [rng(1, 'ŠSD', 'k./min'), rng(2, 'SpO₂', '%'), rng(3, 'AKS sist.', 'mm Hg'), rng(4, 'KD', 'k./min')].filter(Boolean).join('; ');
  if (sum) out.push('Rodiklių ribos: ' + sum);
  out.push('');
  (J.log || []).filter(x => x.k !== 'cfg').forEach(x => out.push(SIM.mmss(x.e) + '  ' + x.x));
  return out.join('\n');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (x) { return false; }
  }
}

// ── Nustatymai ──
function setTab() {
  const s = snap(), local = tgt() === 'local';
  const c = local ? SIM.cfg() : s && s.cfg;
  const sec = (k, title, sum, body) => `<details class="pnl sec" data-sec="${k}"${UI.so[k] ? ' open' : ''}><summary><span><b>${title}</b><small>${sum}</small></span><i>›</i></summary>${body}</details>`;
  let h = '';
  if (!c) h += `<section class="pnl"><p class="muted">${s ? 'Prijungto monitoriaus programėlė senesnė – atnaujinkite ją, kad galėtumėte keisti nustatymus nuotoliniu būdu.' : 'Laukiama duomenų iš monitoriaus…'}</p></section>`;
  else {
    const lim = c.lim, LN = [['hr', 'ŠSD'], ['spo2', 'SpO₂'], ['sys', 'AKS sist.'], ['rr', 'KD'], ['temp', 'T']], vv = (k, i) => lim[k][i] == null ? '' : f1(k === 'temp' ? 'temp' : 'x', lim[k][i]);
    const rg = k => lim[k][0] != null && lim[k][1] != null ? vv(k, 0) + '–' + vv(k, 1) : lim[k][0] != null ? '≥ ' + vv(k, 0) : lim[k][1] != null ? '≤ ' + vv(k, 1) : 'išj.';
    h += sec('lim', 'Aliarmų ribos', 'ŠSD ' + rg('hr') + ' · SpO₂ ' + rg('spo2') + ' · AKS ' + rg('sys'),
      '<div class="limt"><span></span><b class="r">‼ ↓</b><b class="y">! ↓</b><b class="y">! ↑</b><b class="r">‼ ↑</b>' +
      LN.map(([k, l]) => `<span>${l}</span>` + [2, 0, 1, 3].map(i => `<input class="inp li" data-lim="${k}" data-i="${i}" inputmode="decimal" value="${vv(k, i)}" aria-label="${l} riba ${i}">`).join('')).join('') + '</div>' +
      '<p class="muted">! – vidutinis (geltonas), ‼ – aukštas (raudonas) prioritetas. Tuščias laukelis – riba išjungta.</p><div class="acts"><button class="btn" data-act="lim-def">Numatytosios ribos</button></div>');
    const o = local ? SIM.state() : s;
    h += sec('snd', 'Garsas', !o.sound ? 'išjungtas' : 'aliarmai ' + c.avol + ' % · pyptelėjimas ' + (o.beep ? c.bvol + ' %' : 'išj.') + (o.alarms ? '' : ' · aliarmai išj.'),
      '<div class="chips">' + tog('opt', 'sound', !!o.sound, 'Garsas') + tog('opt', 'beep', !!o.beep, 'Pulso pyptelėjimas') + tog('opt', 'alarms', !!o.alarms, 'Aliarmai') + '</div>' +
      `<label class="rl">Aliarmų garsumas <b id="rv-avol">${c.avol}%</b><input type="range" class="rng" data-cfg="avol" min="0" max="100" step="5" value="${c.avol}"></label>` +
      `<label class="rl">Pyptelėjimo garsumas <b id="rv-bvol">${c.bvol}%</b><input type="range" class="rng" data-cfg="bvol" min="0" max="100" step="5" value="${c.bvol}"></label>` +
      '<div class="acts"><button class="btn" data-act="test-sound">Išbandyti garsą</button></div>');
    h += sec('scr', 'Ekranas', String(c.speed).replace('.', ',') + ' mm/s · EKG ×' + String(c.gain).replace('.', ',') + (c.big ? ' · dideli skaičiai' : '') + (c.scheme === 'hc' ? ' · kontrastingos' : '') + (c.pat ? ' · ' + esc(c.pat) : ''),
      '<p class="lbl mt0">Kreivės greitis</p><div class="chips">' + SIM.SPEEDS.map(v => chip('cfg', 'speed:' + v, c.speed === v, String(v).replace('.', ',') + ' mm/s')).join('') + '</div>' +
      '<p class="lbl">EKG amplitudė</p><div class="chips">' + SIM.GAINS.map(v => chip('cfg', 'gain:' + v, c.gain === v, '×' + String(v).replace('.', ','))).join('') + '</div>' +
      '<p class="lbl">Rodyti</p><div class="chips">' + [['pleth', 'Pleth kreivė'], ['resp', 'Kvėpavimo kreivė'], ['rr', 'KD'], ['temp', 'Temperatūra']].map(([k, t]) => tog('cfgt', 'show.' + k, !!c.show[k], t)).join('') + tog('cfgt', 'rhy', !!c.rhy, 'Ritmo pavadinimas') + '</div>' +
      '<p class="lbl">Išdėstymas ir spalvos</p><div class="chips">' + tog('cfgt', 'big', !!c.big, 'Dideli skaičiai') + chip('cfg', 'scheme:classic', c.scheme === 'classic', 'Klasikinės spalvos') + chip('cfg', 'scheme:hc', c.scheme === 'hc', 'Kontrastingos') + '</div>' +
      '<p class="lbl">Viršutinė juosta</p><div class="chips">' + tog('cfgt', 'clock', !!c.clock, 'Sesijos laikmatis') + tog('cfgt', 'scen', !!c.scen, 'Scenarijaus pavadinimas') + tog('cfgt', 'wake', !!c.wake, 'Ekranas neužgęsta') + '</div>' +
      `<label class="rl">Paciento žymė<input class="inp" data-cfg="pat" maxlength="40" placeholder="pvz. Lova 2 · Karys A" value="${esc(c.pat)}"></label>` +
      '<p class="muted">Ritmo ir scenarijaus pavadinimai monitoriuje numatytai paslėpti, kad neatskleistų diagnozės; instruktorius juos mato visada.</p>');
  }
  h += sec('pul', 'Pultas (šiame telefone)', 'pokytis ' + (DUR.find(x => x[0] === dur) || [0, dur + ' s'])[1].toLowerCase() + (UI.live ? ' · iš karto' : '') + (UI.sl ? ' · slankikliai' : ''),
    '<p class="lbl mt0">Numatytasis pokytis</p>' + durChips() + '<div class="chips mt">' + tog('ui', 'live', !!UI.live, 'Keisti iš karto (be „Taikyti“)') + tog('ui', 'sl', !!UI.sl, 'Slankikliai') + '</div>');
  if (c) h += '<div class="acts"><button class="btn" data-act="cfg-def">Atkurti numatytuosius nustatymus</button></div>';
  return h;
}
function linkTab() { return pairHost() + '<div class="acts"><a class="btn" href="#/">Išeiti iš monitoriaus</a></div>'; }

// ───────── vaizdai ─────────
function home() {
  return `<div class="hero"><img src="img/logo-balt.png" alt="1040 medkuopa" class="lg"><h1>SIM</h1><p class="muted">Paciento monitoriaus simuliatorius treniruotėms</p></div>` +
    `<div class="tiles"><a class="tile" href="#/monitorius">${ICO.mon}<b>Monitorius</b><small>Šis telefonas – paciento monitorius</small></a>` +
    `<a class="tile" href="#/instruktorius">${ICO.ctrl}<b>Instruktorius</b><small>Valdyti kitą telefoną</small></a>` +
    `<a class="tile wide" href="#/nustatymai">${ICO.cog}<b>Nustatymai</b><small>Aliarmų ribos, garsas, ekranas</small></a></div>` +
    `<details class="hlp"><summary>Kaip naudoti</summary><ol>` +
    `<li><b>Vienas telefonas:</b> Monitorius → <span class="ki">${ICO.gear}</span> (kairėje viršuje) arba ilgai palaikykite ekraną – atsidaro pultas.</li>` +
    `<li><b>Du telefonai</b> (abiem reikia interneto, bendro Wi-Fi nereikia): monitoriaus pultas → <b>Ryšys</b> → <b>Prijungti instruktorių</b>. Instruktoriaus telefono kamera nuskaitykite QR kodą arba SIM → <b>Instruktorius</b> ir įveskite kodą.</li>` +
    `<li>Pasirinkite scenarijų ir etapą arba keiskite rodiklius (<b>+/−</b> galima laikyti). <b>Pokytis per</b> – per kiek laiko monitorius pasieks naujas reikšmes. Greitos komandos: Blogėja, Gerėja, Šokas, Hipoksija, Stabilizuoti.</li>` +
    `<li><b>Veiksmai</b> – pažymėkite atliktus veiksmus (turniketas, dekompresija…), jie su laiku patenka į <b>Žurnalą</b>; ten – tendencijų grafikas ir ataskaita aptarimui.</li>` +
    `<li>Monitoriuje: palietus AKS langelį – matuojamas AKS, palietus aliarmo juostą – visų aliarmų sąrašas. Garsas įsijungia palietus ekraną.</li></ol></details>` +
    `<details class="hlp"><summary>Apie</summary><p>Versija ${VER}. Parengė 1040 medkuopa. Mokymo priemonė – ne medicinos prietaisas; rodikliai ir kreivės sugeneruoti.</p>` +
    `<p class="muted">Rodomi: EKG (II), ŠSD, SpO₂ su pletizmograma, neinvazinis AKS (sist./diast., vidutinis), kvėpavimo dažnis ir kreivė, temperatūra. Aliarmų ribos – tipinės suaugusiųjų monitoriaus numatytosios (keičiamos nustatymuose); garsiniai signalai primena IEC 60601-1-8 prioritetus. Scenarijai – SIM, ETC gido ir March gido treniruočių scenarijai.</p>` +
    `<p class="muted">Kiti gidai: <a href="https://etc.1040medkuopa.lt" target="_blank" rel="noopener">ETC gidas</a> · <a href="https://march.1040medkuopa.lt" target="_blank" rel="noopener">March gidas</a></p></details>`;
}
function settingsPage() {
  const remote = tgt() === 'remote';
  return `<div class="bar"><a class="ib" href="#/" aria-label="Atgal">${ICO.back}</a><h1>Nustatymai</h1>${remote ? cstHtml() : ''}</div>` +
    `<p class="muted mt0">${remote ? 'Keičiami <b>prijungto monitoriaus</b> nustatymai.' : 'Šio telefono monitoriaus nustatymai. Prijungus instruktorių, juos galima keisti ir nuotoliniu būdu.'}</p>` + setTab();
}
function pairHost() {
  // monitoriaus pusė – rodomas pultas
  let h = '<section class="pnl"><h2>Nuotolinis valdymas</h2>';
  if (RELAY.role() === 'host') {
    const code = RELAY.room();
    if (relState === 'on') h += '<p class="ok">✓ Instruktorius prijungtas (kodas ' + fmtRoom(code) + ').</p>';
    else h += `<p class="mt0">${relState === 'conn' ? 'Jungiamasi prie interneto…' : 'Laukiama instruktoriaus…'}</p><div class="qr" id="qrh"></div><div class="room">${fmtRoom(code)}</div>` +
      '<p class="muted">Instruktoriaus telefonu nuskaitykite QR kodą (telefono kamera) arba atidarykite SIM → <b>Instruktorius</b> ir įveskite kodą.</p>';
    h += '<button class="btn" data-act="rel-stop">Atjungti</button>';
  } else if (RTC.role() === 'host') {
    if (rtcState === 'on') h += '<p class="ok">✓ Instruktorius prijungtas (be interneto).</p><button class="btn" data-act="rtc-close">Atjungti</button>';
    else h += '<p class="muted mt0">1. Instruktoriaus telefone: <b>Instruktorius</b> → <b>Be interneto</b> → nuskaitykite šį kodą.</p><div class="qr" id="qrh"></div>' +
      `<details class="hlp"><summary>Be kameros – kopijuoti kodą</summary><textarea class="inp code" readonly>${esc(hostCode)}</textarea><button class="btn" data-act="copy" data-k="${esc(hostCode)}">Kopijuoti</button></details>` +
      '<p class="muted">2. Tada nuskaitykite instruktoriaus kodą:</p>' + scanBox('hs') + '<button class="btn" data-act="rtc-close">Atšaukti</button>';
  } else {
    h += '<p class="muted mt0">Kitas telefonas valdys šį monitorių per internetą (mobilieji duomenys ar Wi-Fi) – bendro tinklo nereikia.</p><button class="btn pri" data-act="rel-host">Prijungti instruktorių</button>' +
      '<details class="hlp"><summary>Be interneto (tas pats Wi-Fi) – bandomasis</summary><p class="muted">Veikia ne visuose tinkluose: daugelis Wi-Fi tinklų neleidžia telefonams jungtis tiesiogiai. Patikimiausia – vieno telefono interneto prieigos taškas.</p><button class="btn" data-act="rtc-host">Jungti be interneto</button></details>';
  }
  return h + '</section>';
}
function scanBox(id) {
  return `<div class="scan"><button class="btn" data-act="scan" data-k="${id}">📷 Skenuoti kodą</button><div class="cam" id="cam-${id}" hidden><video playsinline muted></video><span class="camst">Ieškoma kodo…</span></div>` +
    `<div class="paste"><input class="inp" id="paste-${id}" placeholder="arba įklijuokite kodą (SIM1…)" autocomplete="off" aria-label="Kodas"><button class="btn" data-act="paste" data-k="${id}">Gerai</button></div></div>`;
}
let hostCode = '', ctrlCode = '';
function instructor() {
  const on = linkOn();
  if (on) return `<div class="rhead"><div class="bar cbar"><a class="ib" href="#/" aria-label="Atgal">${ICO.back}</a><h1 class="vh">Instruktorius</h1>${stripHtml(true)}${cstHtml()}</div><div id="mirror" class="mirw">${mirrorHtml()}</div>${tabsHtml()}</div>` +
    `<div id="tabc">${tabBody()}</div><div class="acts"><button class="btn" data-act="${RTC.open() ? 'rtc-close' : 'rel-stop'}">Atjungti</button></div>`;
  let h = `<div class="bar"><a class="ib" href="#/" aria-label="Atgal">${ICO.back}</a><h1>Instruktorius</h1><span class="cst" id="cst">○ Neprijungta</span></div>`;
  h += '<section class="pnl">';
  if (RELAY.role() === 'ctrl') {
    h += `<p class="mt0"><b>Kodas ${fmtRoom(RELAY.room())}</b> – ${relState === 'conn' ? 'jungiamasi prie interneto…' : 'laukiama monitoriaus…'}</p>` +
      '<p class="muted">Monitoriuje turi būti atidarytas pultas su šiuo kodu. Patikrinkite, ar abu telefonai turi internetą.</p><button class="btn" data-act="rel-stop">Atšaukti</button>';
  } else if (RTC.role() === 'ctrl' || ctrlCode) {
    h += '<p class="mt0"><b>2.</b> Parodykite šį kodą monitoriaus kamerai:</p><div class="qr" id="qrc"></div>' +
      `<details class="hlp"><summary>Be kameros – kopijuoti kodą</summary><textarea class="inp code" readonly>${esc(ctrlCode)}</textarea><button class="btn" data-act="copy" data-k="${esc(ctrlCode)}">Kopijuoti</button></details>` +
      '<p class="muted">Jungiamasi…</p><button class="btn" data-act="rtc-close">Pradėti iš naujo</button>';
  } else {
    h += '<p class="mt0">Monitoriuje: pultas → <b>Ryšys</b> → <b>Prijungti instruktorių</b>. Nuskaitykite jo QR kodą telefono kamera arba įveskite kodą:</p>' +
      '<div class="paste"><input class="inp roomin" id="room" placeholder="ABC-123" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Monitoriaus kodas"><button class="btn pri" data-act="rel-join">Jungtis</button></div>' +
      '<p class="muted">Reikia interneto abiem telefonams; bendro Wi-Fi nereikia.</p>' +
      '<details class="hlp"><summary>Be interneto (tas pats Wi-Fi) – bandomasis</summary><p class="muted">Monitoriuje: pultas → Ryšys → Be interneto → Jungti be interneto. Tada nuskaitykite jo kodą:</p>' + scanBox('cs') + '</details>';
  }
  return h + '</section>';
}
function monitor() {
  return `<div id="monroot"></div><button class="mbtn mg" data-act="drawer" aria-label="Instruktoriaus pultas">${ICO.gear}</button><button class="mbtn mm" data-act="mmute" aria-label="Nutildyti aliarmus 2 min">${ICO.mute}</button>` +
    `<div class="drawer" id="drawer"><div class="dhd"><div id="dtabs" class="dtabs"></div><button class="ib" data-act="drawer" aria-label="Uždaryti">${ICO.x}</button></div><div class="dbd" id="dbd"></div></div>` +
    `<div class="alist" id="alist" data-act="alist-x" hidden></div>` +
    `<div class="tapsound" id="tapsound" data-act="sound-on">Palieskite – įjungti garsą</div>`;
}
function alistHtml() {
  const A = SIM.alarmList(), s = SIM.state(), mu = s.mute && Date.now() < s.mute;
  return `<div class="alb" data-act="noop"><div class="dhd"><b>Aliarmai</b><button class="ib" data-act="alist-x" aria-label="Uždaryti">${ICO.x}</button></div>` +
    (A.length ? A.map(a => `<div class="ali p${a[0]}">${a[0] === 2 ? '‼' : '!'} ${esc(a[1])}</div>`).join('') : '<p class="muted">Aktyvių aliarmų nėra.</p>') +
    `<div class="acts"><button class="btn" data-act="mmute">${mu ? 'Grąžinti garsą' : 'Nutildyti 2 min'}</button></div></div>`;
}
let wl = null;
async function wake() {
  const want = route() === 'monitorius' && SIM.cfg().wake;
  if (!want) { if (wl) { try { wl.release(); } catch (e) {} wl = null; } return; }
  try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && route() === 'monitorius') wake(); });

let lastRoute = null;
function drawerBody() { return headHtml() + `<div id="tabc">${tabBody()}</div>`; }
function render() {
  const r = route(), app = $('#app');
  if (r !== lastRoute) { if (lastRoute === 'monitorius') { SIM.stop(); if (RELAY.role() === 'host') { RELAY.stop(true); relState = 'off'; } if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); if (wl) { try { wl.release(); } catch (e) {} wl = null; } } RTC.scanStop(); }
  document.body.classList.toggle('monmode', r === 'monitorius');
  if (r === 'monitorius') {
    if (lastRoute !== 'monitorius') { app.innerHTML = monitor(); SIM.mount($('#monroot')); wake(); const hr = LSg('sim-room-host', ''); if (hr && !RELAY.role() && RELAY.valid(hr)) RELAY.host(hr); }
    if ($('#drawer.on')) { $('#dtabs').innerHTML = tabsHtml(); $('#dbd').innerHTML = drawerBody(); }
    qrHost();
  } else if (r === 'instruktorius') {
    autoJoin(); app.innerHTML = instructor(); if (ctrlCode && rtcState !== 'on') drawQr('qrc', ctrlCode); afterTab();
  } else if (r === 'nustatymai') app.innerHTML = settingsPage();
  else app.innerHTML = home();
  lastRoute = r;
}
function qrHost() { if (RELAY.role() === 'host' && relState !== 'on') drawQr('qrh', joinUrl(RELAY.room())); else if (hostCode && rtcState !== 'on') drawQr('qrh', hostCode); }
function autoJoin() {
  const m = /[?&]k=([A-Za-z0-9-]+)/.exec(location.hash);
  if (m) { const c = RELAY.norm(m[1]); history.replaceState(null, '', '#/instruktorius'); if (RELAY.valid(c)) { RTC.close(); ctrlCode = ''; RELAY.join(c); LSs('sim-room-ctrl', c); } return; }
  const saved = LSg('sim-room-ctrl', ''); if (saved && !RELAY.role() && !RTC.role() && RELAY.valid(saved)) RELAY.join(saved);
}
async function drawQr(id, code) { const el = document.getElementById(id); if (!el) return; try { el.innerHTML = await RTC.qrSvg(code); } catch (e) { el.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; } }
function afterTab() { const l = $('#lgl'); if (l) l.scrollTop = l.scrollHeight; }
function rerenderPanel() {
  if (route() === 'monitorius') { const d = $('#dbd'); if (d && $('#drawer.on')) { const y = d.scrollTop; $('#dtabs').innerHTML = tabsHtml(); d.innerHTML = drawerBody(); d.scrollTop = y; qrHost(); afterTab(); } }
  else { const y = scrollY; render(); scrollTo(0, y); }
}
function rerenderTab() { const c = $('#tabc'); if (!c) return; c.innerHTML = tabBody(); afterTab(); }
function openDrawer() { const d = $('#drawer'); if (!d) return; d.classList.add('on'); $('#dtabs').innerHTML = tabsHtml(); $('#dbd').innerHTML = drawerBody(); qrHost(); afterTab(); const ts = $('#tapsound'); if (ts) ts.remove(); }
// kas sekundę – laikmatis, atgalinis skaičiavimas, ryšio būsena, žurnalas
setInterval(() => {
  const r = route(), dr = $('#drawer.on');
  const al = $('#alist'); if (al && !al.hidden) al.innerHTML = alistHtml();
  if (!(r === 'instruktorius' || r === 'nustatymai' || dr)) return;
  mirror();
  const s = snap();
  const tv = $('#tmrv'); if (tv) tv.textContent = s && s.son ? SIM.mmss(s.el) : '--:--';
  const tb = $('#tmrbig'); if (tb) tb.textContent = s && s.son ? SIM.mmss(s.el) : '00:00';
  const mv = $('#mutv'); if (mv && s) mv.textContent = s.mute ? SIM.mmss(s.mute * 1000) : mv.closest('.cbar') ? '' : '2 min';
  const pc = $('#plc'); if (pc) pc.innerHTML = plcTxt(s);
  const cs = $('#cst'); if (cs && r !== 'monitorius') cs.outerHTML = cstHtml();
  if (UI.tab === 'log' && s && !inputBusy() && !(Date.now() - (chartPoint.t || 0) < 15000)) {
    if (tgt() === 'local') { if (s.ln !== logTab.n) rerenderTab(); }
    else if (remoteDump && remoteDump.n !== s.ln && Date.now() - dumpReqT > 2000) { dumpReqT = Date.now(); rsend({ c: 'dump' }); }
  }
}, 1000);

async function onCode(id, code) {
  try {
    if (id === 'hs') { await RTC.hostAccept(code); toast('Jungiamasi…'); }
    else { ctrlCode = await RTC.join(code); render(); }
  } catch (e) { toast(e.message || 'Klaida'); }
}
// ── parametrų keitimas (+/−, laikymas, slankikliai) ──
function stepParam(k, dir) {
  const Tv = T(), st = LB[k][2], v0 = k in draft ? draft[k] : Tv[k];
  let v = Math.round((v0 + dir * st) * 10) / 10; v = Math.max(SIM.LIM[k][0], Math.min(SIM.LIM[k][1], v));
  setDraft(k, v);
}
function setDraft(k, v) {
  const Tv = T(); if (Math.abs(v - Tv[k]) < 0.01) delete draft[k]; else draft[k] = v;
  const row = document.querySelector(`.pr[data-k="${k}"]`);
  if (row) { row.classList.toggle('ch', k in draft); const pv = row.querySelector('.pv'); if (pv && document.activeElement !== pv) pv.value = f1(k, v); const sl = row.querySelector('.sl'); if (sl && !slDrag) sl.value = v; }
  const b = document.querySelector('[data-act="apply"]'), u = document.querySelector('[data-act="undo"]'), n = Object.keys(draft).length;
  if (b) { b.disabled = !n; b.textContent = 'Taikyti' + (n ? ' (' + n + ')' : ''); } if (u) u.disabled = !n;
  if (UI.live) liveApply();
}
let liveT = 0;
function liveApply(now) { clearTimeout(liveT); liveT = setTimeout(applyDraft, now ? 0 : 600); }
function applyDraft() { if (!Object.keys(draft).length) return; if (send({ c: 'apply', v: draft, d: dur })) { if (!UI.live) toast(dur ? 'Keičiasi per ' + DUR.find(x => x[0] === dur)[1] : 'Pritaikyta'); draft = {}; if (!inputBusy() && !hold) rerenderPanel(); } }
let hold = null, lp = null, lpFired = 0;
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (route() === 'monitorius' && t.closest && t.closest('#monroot') && !$('#drawer.on')) {
    lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; lpFired = Date.now(); openDrawer(); if (navigator.vibrate) navigator.vibrate(30); }, 650) };
  }
  const b = t.closest && t.closest('.pb[data-act="d-"], .pb[data-act="d+"]');
  if (b) { const k = b.dataset.k, dir = b.dataset.act === 'd+' ? 1 : -1; hold = { n: 0, t: 0 }; const rep = () => { hold.n++; stepParam(k, dir); hold.t = setTimeout(rep, 110); }; hold.t = setTimeout(rep, 450); }
  if (t.classList && t.classList.contains('sl')) slDrag = 1;
  if (t.closest && t.closest('#spkw')) chartPoint(e);
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) { clearTimeout(lp.t); lp = null; }
  if (e.target.closest && e.target.closest('#spkw') && (e.buttons || e.pointerType === 'mouse')) chartPoint(e);
}, { passive: true });
const endPtr = () => { if (lp) { clearTimeout(lp.t); lp = null; } if (hold) clearTimeout(hold.t); if (slDrag) { slDrag = 0; } };
document.addEventListener('pointerup', endPtr, { passive: true });
document.addEventListener('pointercancel', endPtr, { passive: true });
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('#monroot, .pb')) e.preventDefault(); });

document.addEventListener('click', async e => {
  if (lpFired && Date.now() - lpFired < 900) { lpFired = 0; e.preventDefault(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, k = el.dataset.k;
  SIM.audio();
  const s = snap();
  switch (a) {
    case 'noop': return;
    case 'sound-on': el.remove(); try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement && !matchMedia('(display-mode: standalone)').matches) d.requestFullscreen().catch(() => {}); } catch (x) {} return;
    case 'drawer': { const d = $('#drawer'); if (d.classList.contains('on')) d.classList.remove('on'); else openDrawer(); const ts = $('#tapsound'); if (ts) ts.remove(); return; }
    case 'tab': UI.tab = k; saveUI(); scenList = scenList && k === 'sc'; if (route() === 'monitorius') { $('#dtabs').innerHTML = tabsHtml(); $('#dbd').innerHTML = drawerBody(); $('#dbd').scrollTop = 0; qrHost(); afterTab(); } else { render(); const tb = $('.rhead'); if (tb && scrollY > tb.offsetTop) scrollTo(0, tb.offsetTop); } { const on = document.querySelector('.tab.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } return;
    case 'mmute': { const st = SIM.state(), mu = st.mute && Date.now() > 0 && Date.now() < st.mute; exec(mu ? { c: 'mute', off: 1 } : { c: 'mute' }); pushSnap(); toast(mu ? 'Aliarmų garsas grąžintas' : 'Aliarmai nutildyti 2 min'); const al = $('#alist'); if (al && !al.hidden) al.innerHTML = alistHtml(); if ($('#drawer.on')) rerenderPanel(); return; }
    case 'mon-nibp': exec({ c: 'nibp' }); pushSnap(); toast('AKS matuojamas'); return;
    case 'alist': { const al = $('#alist'); al.innerHTML = alistHtml(); al.hidden = false; return; }
    case 'alist-x': $('#alist').hidden = true; return;
    case 'mute': send({ c: 'mute' }); toast('Aliarmai nutildyti 2 min'); break;
    case 'unmute': send({ c: 'mute', off: 1 }); toast('Aliarmų garsas grąžintas'); break;
    case 'pause': send({ c: 'pause', on: !(s && s.pause) }); toast(s && s.pause ? 'Tęsiama' : 'Pauzė – monitorius ir laikmatis sustabdyti'); break;
    case 'dur': dur = +k; LSs('sim-dur', dur); break;
    case 'd-': case 'd+': if (hold && hold.n) { hold = null; return; } hold = null; stepParam(k, a === 'd+' ? 1 : -1); return;
    case 'apply': applyDraft(); return;
    case 'undo': draft = {}; break;
    case 'mac': { const m = MAC.find(x => x[0] === k); if (!m) return; const o = { c: 'apply', v: macro(k, T()), d: dur, mk: m[1] }; if (k === 'stab') o.r = 'sinus'; if (send(o)) toast(m[1] + (dur ? ' – per ' + DUR.find(x => x[0] === dur)[1] : '')); draft = {}; break; }
    case 'rh': send({ c: 'rh', r: k }); break;
    case 'shj': UI.shJ = +k; saveUI(); break;
    case 'sync': UI.sync = UI.sync ? 0 : 1; saveUI(); break;
    case 'shr': UI.shR = k; saveUI(); break;
    case 'shock': {
      const o = { c: 'shock', j: UI.shJ, r: UI.shR || null }, t = T();
      if (UI.sync) { o.sync = 1; if (s && ['vf', 'asys', 'pea'].indexOf(s.rhythm) >= 0) { toast('Sinchronizuota iškrova neįvyksta – nėra R bangų'); return; } if (UI.shR === 'sinus' && t.hr > 120) o.v = { hr: 96 }; }
      else if (UI.shR === 'sinus' && (t.hr < 40 || t.sys < 60)) o.v = { hr: 104, spo2: Math.max(92, t.spo2), sys: 96, dia: 60, rr: Math.max(12, t.rr) };
      if (send(o)) { toast((UI.sync ? 'Kardioversija ' : 'Iškrova ') + UI.shJ + ' J'); if (navigator.vibrate) navigator.vibrate(80); } break;
    }
    case 'probe': send({ c: 'probe', k, on: !(s && s.probe[k]) }); break;
    case 'art': send({ c: 'art', k, on: !(s && s.art && s.art[k]) }); break;
    case 'nibp': send({ c: 'nibp' }); toast('AKS matuojamas'); break;
    case 'nibp-stat': send({ c: 'nibp', stat: 1 }); toast('AKS STAT – 5 min kartotinai'); break;
    case 'nmode': send({ c: 'nmode', m: +k }); break;
    case 'opt': send({ c: 'opt', k, v: !(s && s[k]) }); break;
    case 'pace-on': send({ c: 'pace', on: !(s && s.pace && s.pace.on) }); break;
    case 'pace-r': { const p = (s && s.pace) || { rate: 70 }; send({ c: 'pace', rate: p.rate + (+k) }); break; }
    case 'pace-m': { const p = (s && s.pace) || { ma: 70 }; send({ c: 'pace', ma: p.ma + (+k) }); break; }
    case 'mark': if (send({ c: 'mark', x: k })) toast('Pažymėta: ' + k); if (navigator.vibrate) navigator.vibrate(20); return;
    case 'mark-c': { const x = (($('#markx') || {}).value || '').trim(); if (!x) { toast('Įrašykite veiksmą'); return; } if (send({ c: 'mark', x })) { toast('Pažymėta: ' + x); markTxt = ''; } break; }
    case 'reset': if (!confirm('Atkurti normalius rodiklius, jutiklius ir artefaktus?')) return; send({ c: 'reset' }); draft = {}; break;
    case 'ses-start': send({ c: 'ses', a: 'start' }); break;
    case 'ses-new': if (!confirm('Pradėti naują sesiją? Žurnalas ir grafikas bus išvalyti.')) return; send({ c: 'ses', a: 'new' }); remoteDump = null; break;
    case 'log-copy': case 'log-share': {
      const J = journalData(); if (!J) return; const txt = debriefTxt(J);
      if (a === 'log-share' && navigator.share) { try { await navigator.share({ title: 'SIM ataskaita', text: txt }); } catch (x) {} return; }
      toast(await copyText(txt) ? 'Ataskaita nukopijuota' : 'Nepavyko nukopijuoti'); return;
    }
    case 'alm': UI.alm = UI.alm ? 0 : 1; saveUI(); break;
    case 'fav-add': {
      const n = (prompt('Pavadinimas (pvz. „Šokas II kl.“):', '') || '').trim().slice(0, 30); if (!n) return;
      favs.push({ n, v: Object.assign({}, T(), draft), r: s ? s.rhythm : 'sinus' }); LSs('sim-fav', favs); toast('Įsiminta: ' + n); break;
    }
    case 'fav-go': { const f = favs[+k]; if (!f) return; if (send({ c: 'apply', v: f.v, d: dur, r: f.r, mk: '★ ' + f.n })) toast(f.n + (dur ? ' – per ' + DUR.find(x => x[0] === dur)[1] : '')); draft = {}; break; }
    case 'fav-del': favs.splice(+k, 1); LSs('sim-fav', favs); if (!favs.length) UI.favEdit = 0; break;
    case 'fav-edit': UI.favEdit = UI.favEdit ? 0 : 1; saveUI(); break;
    case 'sc-list': scenList = true; break;
    case 'sc-close': scenList = false; break;
    case 'sc-src': UI.ssrc = k; UI.stema = ''; saveUI(); break;
    case 'sc-tema': UI.stema = k; saveUI(); break;
    case 'sc-none': scen = null; LSs('sim-scen', null); send({ c: 'label', l: '', s: '' }); break;
    case 'sc-pick': { const [src, id] = k.split('|'); scen = { src, id }; LSs('sim-scen', scen); scenList = false; const sc = findScen(); if (sc) { const p = stageCmd(sc, 0, 0, false); p.r = p.r || 'sinus'; send(p); toast(sc.st[0].n + ' – nustatyta'); } draft = {}; break; }
    case 'sc-st': case 'sc-next': case 'sc-prev': {
      const sc = curScen(s); if (!sc) return; const idx = curIdx(sc, s);
      const i = a === 'sc-st' ? +k : a === 'sc-next' ? Math.min(sc.st.length - 1, idx + 1) : Math.max(0, idx - 1);
      const p = stageCmd(sc, i, dur, s && s.pl && s.pl.useD); if (!p) return;
      if (send(p)) toast(sc.st[i].n + (p.d ? ' – per ' + durTxt(p.d) : '')); draft = {}; break;
    }
    case 'sc-auto': send({ c: 'play', auto: !(s && s.pl && s.pl.auto) }); break;
    case 'sc-used': send({ c: 'play', useD: !(s && s.pl && s.pl.useD) }); break;
    case 'sc-ev': {
      const sc = curScen(s); const ev = sc && sc.ev && sc.ev[+k]; if (!ev) return;
      const p = ev.st != null && sc.st[ev.st] ? stageCmd(sc, +ev.st, dur, s && s.pl && s.pl.useD) : null;
      if (ev.shock) send({ c: 'shock', j: UI.shJ, r: p && p.r ? p.r : null });
      if (p) { p.ev = ev.n; send(p); } else send({ c: 'mark', x: ev.n });
      toast(ev.n); draft = {}; break;
    }
    case 'cfg': { const [ck, cv] = k.split(':'); send({ c: 'cfg', v: { [ck]: ck === 'scheme' ? cv : +cv } }); break; }
    case 'cfgt': { const c = (tgt() === 'local' ? SIM.cfg() : s && s.cfg) || {}; if (k.startsWith('show.')) { const sk = k.slice(5); send({ c: 'cfg', v: { show: { [sk]: !(c.show && c.show[sk]) } } }); } else send({ c: 'cfg', v: { [k]: !c[k] } }); break; }
    case 'lim-def': send({ c: 'cfg', v: { lim: 'def' } }); toast('Numatytosios aliarmų ribos'); break;
    case 'cfg-def': if (!confirm('Atkurti visus monitoriaus nustatymus?')) return; send({ c: 'cfg', v: 'def' }); break;
    case 'test-sound': send({ c: 'test' }); break;
    case 'ui': UI[k] = UI[k] ? 0 : 1; saveUI(); break;
    case 'rel-host': RTC.close(); hostCode = ''; LSs('sim-room-host', RELAY.host()); break;
    case 'rel-join': { const c = RELAY.norm(($('#room') || {}).value); if (!RELAY.valid(c)) { toast('Kodas – 6 raidės ar skaitmenys'); return; } RTC.close(); ctrlCode = ''; RELAY.join(c); LSs('sim-room-ctrl', c); render(); return; }
    case 'rel-stop': if (linkOn() && !confirm('Atjungti nuotolinį ryšį?')) return; RELAY.stop(); LSs(isHostRoute() ? 'sim-room-host' : 'sim-room-ctrl', ''); if (route() === 'instruktorius') { remoteSnap = null; remoteDump = null; render(); return; } break;
    case 'rtc-host': RELAY.stop(); LSs('sim-room-host', ''); try { el.disabled = true; el.textContent = 'Ruošiama…'; hostCode = await RTC.host(); } catch (x) { toast('Nepavyko: ' + (x.message || x)); } break;
    case 'rtc-close': if (linkOn() && !confirm('Atjungti nuotolinį ryšį?')) return; RTC.close(); hostCode = ''; ctrlCode = ''; render(); return;
    case 'copy': toast(await copyText(k) ? 'Nukopijuota' : 'Nepavyko nukopijuoti – pažymėkite tekstą'); return;
    case 'paste': { const v = (document.getElementById('paste-' + k) || {}).value || ''; if (v.trim()) onCode(k, v.trim()); return; }
    case 'scan': { const box = document.getElementById('cam-' + k); if (!box) return; box.hidden = false; const stEl = box.querySelector('.camst'); RTC.scan(box.querySelector('video'), code => { box.hidden = true; onCode(k, code); }, msg => { stEl.textContent = msg; }); return; }
    default: return;
  }
  rerenderPanel();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'scq') { scenQ = t.value; const pos = t.selectionStart; rerenderTab(); const n = $('#scq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.id === 'markx') { markTxt = t.value; return; }
  if (t.classList.contains('sl')) { const k = t.dataset.k, v = +t.value; const row = t.closest('.pr'); const pv = row && row.querySelector('.pv'); if (pv) pv.value = f1(k, v); const Tv = T(); if (Math.abs(v - Tv[k]) < 0.01) delete draft[k]; else draft[k] = v; row.classList.toggle('ch', k in draft); const b = document.querySelector('[data-act="apply"]'), u = document.querySelector('[data-act="undo"]'), n = Object.keys(draft).length; if (b) { b.disabled = !n; b.textContent = 'Taikyti' + (n ? ' (' + n + ')' : ''); } if (u) u.disabled = !n; return; }
  if (t.classList.contains('rng')) { const o = document.getElementById('rv-' + t.dataset.cfg); if (o) o.textContent = t.value + '%'; return; }
  if (t.classList.contains('pv') && t.tagName === 'INPUT') {
    const k = t.dataset.k, v = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(v)) return;
    const Tv = T(), c = Math.max(SIM.LIM[k][0], Math.min(SIM.LIM[k][1], v));
    if (c === Tv[k]) delete draft[k]; else draft[k] = c;
    t.closest('.pr').classList.toggle('ch', k in draft);
    const sl = t.closest('.pr').querySelector('.sl'); if (sl) sl.value = c;
    const b = document.querySelector('[data-act="apply"]'), u = document.querySelector('[data-act="undo"]'), n = Object.keys(draft).length;
    if (b) { b.disabled = !n; b.textContent = 'Taikyti' + (n ? ' (' + n + ')' : ''); } if (u) u.disabled = !n;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.classList.contains('sl') || (t.classList.contains('pv') && t.tagName === 'INPUT')) { slDrag = 0; if (UI.live) liveApply(true); return; }
  if (t.classList.contains('rng')) { send({ c: 'cfg', v: { [t.dataset.cfg]: +t.value } }); return; }
  if (t.classList.contains('li')) {
    const k = t.dataset.lim, row = [0, 1, 2, 3].map(i => { const el = document.querySelector(`.li[data-lim="${k}"][data-i="${i}"]`), v = el ? String(el.value).trim().replace(',', '.') : ''; return v === '' ? null : isFinite(+v) ? +v : null; });
    send({ c: 'cfg', v: { lim: { [k]: row } } }); return;
  }
  if (t.dataset && t.dataset.cfg === 'pat') { send({ c: 'cfg', v: { pat: t.value } }); return; }
});
document.addEventListener('toggle', e => { const d = e.target; if (d && d.classList && d.classList.contains('sec')) { UI.so[d.dataset.sec] = d.open ? 1 : 0; saveUI(); } }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const d = $('#drawer.on'); if (d) d.classList.remove('on'); const al = $('#alist'); if (al) al.hidden = true; }
  if (e.key === 'Enter' && e.target.id === 'markx') { const b = document.querySelector('[data-act="mark-c"]'); if (b) b.click(); }
});
window.addEventListener('hashchange', render);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const had = !!navigator.serviceWorker.controller; let pend = false;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // nauja versija įdiegta – perkrauti (monitoriaus metu – tik išėjus iš jo)
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had) return; if (route() === 'monitorius') { pend = true; toast('Atnaujinta – nauja versija įsijungs išėjus iš monitoriaus'); } else location.reload(); });
  window.addEventListener('hashchange', () => { if (pend && route() !== 'monitorius') location.reload(); });
}
