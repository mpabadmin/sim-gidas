'use strict';
// ───────── SIM – programėlės eiga: pradžia, monitorius, instruktoriaus valdymas, scenarijai ─────────
const VER = 'v3 · 2026-10-28';
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
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M3 3l18 18"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
};

// ── komandos monitoriui (vietinės ir nuotolinės) ──
function exec(o) {
  if (!o || typeof o !== 'object') return;
  switch (o.c) {
    case 'apply': if (o.r) SIM.setRhythm(o.r); SIM.apply(o.v || {}, o.d || 0); if (o.l != null || o.s != null) SIM.setLabel(o.l, o.s); break;
    case 'rh': SIM.setRhythm(o.r); break;
    case 'probe': SIM.setProbe(o.k, o.on); break;
    case 'opt': SIM.setOpt(o.k, o.v); break;
    case 'nibp': SIM.nibpStart(); break;
    case 'nmode': SIM.setNibpMode(o.m); break;
    case 'label': SIM.setLabel(o.l, o.s); break;
    case 'mute': SIM.muteAlarms(2); break;
    case 'reset': SIM.reset(); break;
  }
}
const sig = s => s ? JSON.stringify([s.rhythm, s.probe, s.nibp.mode, s.sound, s.beep, s.alarms, s.label, s.stage, s.t]) : '';
function onLinkMsg(host, o) {
  if (host) { exec(o); return; }
  if (o.c !== 'snap') return;
  const old = sig(remoteSnap); remoteSnap = o.s; remoteT = Date.now(); mirror();
  const ae = document.activeElement;
  if (route() === 'instruktorius' && sig(remoteSnap) !== old && !(ae && ae.classList && (ae.classList.contains('pv') || ae.id === 'scq'))) rerenderPanel();
}
RTC.onMsg = o => onLinkMsg(RTC.role() === 'host', o);
RELAY.onMsg = o => onLinkMsg(RELAY.role() === 'host', o);
let remoteSnap = null, remoteT = 0, rtcState = 'off', relState = 'off';
const isHost = () => RELAY.role() === 'host' || RTC.role() === 'host';
const linkOn = () => RTC.open() || RELAY.open();
RTC.onState = s => { rtcState = s; if (s === 'on') toast(RTC.role() === 'host' ? 'Instruktorius prijungtas' : 'Prijungta prie monitoriaus'); if (s === 'lost' || s === 'off') { if (RTC.role()) toast('Ryšys nutrūko'); } refresh(); };
RELAY.onState = s => {
  const prev = relState; relState = s;
  if (s === 'on' && prev !== 'on') toast(RELAY.role() === 'host' ? 'Instruktorius prijungtas' : 'Prijungta prie monitoriaus');
  if (prev === 'on' && s !== 'on' && RELAY.role()) toast(RELAY.role() === 'host' ? 'Instruktorius neprisijungęs' : 'Ryšys su monitoriumi nutrūko – jungiamasi iš naujo');
  refresh();
};
function refresh() { if (route() === 'monitorius') { if ($('#drawer.on')) rerenderPanel(); } else if (route() === 'instruktorius') { const ae = document.activeElement; if (!(ae && ae.classList && ae.classList.contains('pv'))) render(); } }
setInterval(() => {
  if (route() !== 'monitorius') return;
  const sn = { c: 'snap', s: SIM.snapshot() };
  if (RTC.role() === 'host' && RTC.open()) RTC.send(sn);
  if (RELAY.role() === 'host' && RELAY.up()) RELAY.send(sn);
}, 1000);
const joinUrl = code => location.origin + location.pathname + '#/instruktorius?k=' + code;
const fmtRoom = c => c.slice(0, 3) + '-' + c.slice(3);
const isHostRoute = () => route() === 'monitorius';

// ── instruktoriaus pultas (bendras: vietinis ir nuotolinis) ──
const LB = { hr: ['ŠSD', 'k./min', 5], spo2: ['SpO₂', '%', 1], sys: ['AKS sist.', 'mm Hg', 5], dia: ['AKS diast.', 'mm Hg', 5], rr: ['KD', 'k./min', 2], temp: ['T', '°C', 0.1] };
const DUR = [[0, 'Iš karto'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min']];
let draft = {}, dur = LSg('sim-dur', 30), scen = LSg('sim-scen', null), scenList = false, scenQ = '';
const mode = () => route() === 'monitorius' ? 'local' : 'remote';
const snap = () => mode() === 'local' ? SIM.snapshot() : remoteSnap;
const send = o => { if (mode() === 'local') { exec(o); setTimeout(mirror, 30); return true; } if ((RTC.open() && RTC.send(o)) || (RELAY.role() === 'ctrl' && RELAY.send(o))) return true; toast('Nėra ryšio su monitoriumi'); return false; };
const allScen = () => (window.SIMS || []).map(s => Object.assign({ src: 'SIM' }, s)).concat(window.SIMX || []);
const findScen = () => scen ? allScen().find(s => s.id === scen.id && s.src === scen.src) : null;
const f1 = (k, v) => k === 'temp' ? (+v).toFixed(1).replace('.', ',') : String(Math.round(v));
function mirrorHtml() {
  const s = snap();
  if (!s) return '<p class="muted">Laukiama duomenų iš monitoriaus…</p>';
  const c = s.c, L = s.nibp.last, nop = { vf: 1, asys: 1, pea: 1 }[s.rhythm];
  const cell = (l, v, u) => `<div><small>${l}</small><b>${v}</b><small>${u}</small></div>`;
  return `<div class="mir">${cell('ŠSD', !s.probe.ecg || s.rhythm === 'vf' ? '---' : s.rhythm === 'asys' ? 0 : s.rhythm === 'vt' ? Math.max(140, c.hr) : c.hr, 'k./min')}${cell('SpO₂', s.probe.spo2 && s.pf > 0 ? c.spo2 : '--', '%')}` +
    `${cell('AKS', s.nibp.meas ? '…' : L && L.ok ? L.sys + '/' + L.dia : '---', L && L.ok ? 'išm. ' + new Date(L.t).toTimeString().slice(0, 5) : 'mm Hg')}${cell('KD', c.rr, 'k./min')}${cell('T', f1('temp', c.temp), '°C')}</div>` +
    `<div class="mirs">${esc((SIM.RH.find(r => r[0] === s.rhythm) || [0, ''])[1])}${nop ? ' · <b>be pulso</b>' : ''}${s.trend ? ' · <span class="trd">kinta…</span>' : ''}${s.label ? ' · ' + esc(s.label) + (s.stage ? ' – ' + esc(s.stage) : '') : ''}</div>` +
    (s.a && s.a.length ? `<div class="mira p${s.pri}">${s.a.map(esc).join(' · ')}</div>` : '');
}
function mirror() { const el = $('#mirror'); if (el) el.innerHTML = mirrorHtml(); }
setInterval(() => { if (route() === 'instruktorius' || $('#drawer.on')) mirror(); }, 1000);
function chip(act, k, on, t, extra) { return `<button class="chip${on ? ' on' : ''}" data-act="${act}" data-k="${esc(k)}" aria-pressed="${on ? 'true' : 'false'}"${extra || ''}>${t}</button>`; }
function panel() {
  const s = snap(), T = s ? s.t : SIM.targets(), sc = findScen();
  let h = '<section class="pnl"><h2>Monitorius rodo</h2><div id="mirror">' + mirrorHtml() + '</div></section>';
  // scenarijus
  h += '<section class="pnl"><h2>Scenarijus</h2>';
  if (scenList) {
    const q = scenQ.trim().toLowerCase(), L = allScen().filter(x => !q || (x.pav + ' ' + x.id + ' ' + x.src).toLowerCase().includes(q));
    h += `<input class="inp" id="scq" placeholder="Paieška (pvz. šokas, m12, ETC)" value="${esc(scenQ)}" autocomplete="off" aria-label="Scenarijų paieška">`;
    const grp = [['SIM', 'Monitoriaus scenarijai'], ['ETC', 'ETC gido scenarijai'], ['March', 'March gido scenarijai']];
    grp.forEach(([src, t]) => { const a = L.filter(x => x.src === src); if (a.length) h += `<h3>${t}</h3>` + a.map(x => `<button class="row" data-act="sc-pick" data-k="${esc(x.src + '|' + x.id)}"><span>${esc(x.pav)}<small>${esc(x.src === 'SIM' ? x.st.length + ' etapai' : x.id + (x.lygis ? ' · ' + x.lygis : '') + ' · ' + x.st.length + ' klausimai')}</small></span><i>›</i></button>`).join(''); });
    h += '<button class="btn" data-act="sc-close">Uždaryti sąrašą</button>';
  } else if (sc) {
    h += `<div class="sch"><b>${esc(sc.pav)}</b><small>${esc(sc.src === 'SIM' ? 'SIM' : sc.src + ' ' + sc.id)}</small></div><div class="stg">` +
      sc.st.map((x, i) => `<button class="stb${s && s.stage === x.n && s.label === sc.pav ? ' on' : ''}" data-act="sc-st" data-k="${i}"><b>${i + 1}</b>${esc(x.n)}</button>`).join('') + '</div>';
    const cur = sc.st.find(x => s && s.stage === x.n && s.label === sc.pav);
    if (cur) h += `<p class="note">${esc(cur.p)}${cur.k ? '<br><b>Klausimas:</b> ' + esc(cur.k) : ''}</p>`;
    h += '<div class="acts">' + '<button class="btn" data-act="sc-list">Kitas scenarijus</button><button class="btn" data-act="sc-none">Be scenarijaus</button></div>';
  } else h += '<button class="btn pri" data-act="sc-list">Pasirinkti scenarijų</button><p class="muted">Arba keiskite rodiklius žemiau.</p>';
  h += '</section>';
  // tendencija ir rodikliai
  const n = Object.keys(draft).length;
  h += '<section class="pnl"><h2>Pokytis per</h2><div class="chips">' + DUR.map(([d, t]) => chip('dur', d, dur === d, t)).join('') + '</div>';
  h += '<h2>Rodikliai</h2><div class="prm">' + SIM.P.map(k => { const [l, u, st] = LB[k], v = k in draft ? draft[k] : T[k]; return `<div class="pr${k in draft ? ' ch' : ''}"><span class="prl">${l}<small>${u}</small></span><button class="pb" data-act="d-" data-k="${k}" aria-label="${l} mažiau">−</button><input class="inp pv" data-k="${k}" inputmode="decimal" value="${f1(k, v)}" aria-label="${l}"><button class="pb" data-act="d+" data-k="${k}" aria-label="${l} daugiau">+</button></div>`; }).join('') + '</div>';
  h += `<div class="acts"><button class="btn pri" data-act="apply"${n ? '' : ' disabled'}>Taikyti${n ? ' (' + n + ')' : ''}</button><button class="btn" data-act="undo"${n ? '' : ' disabled'}>Atšaukti</button></div></section>`;
  // ritmas, signalai, AKS
  const rh = s ? s.rhythm : 'sinus', pr = s ? s.probe : { ecg: 1, spo2: 1, nibp: 1 }, nm = s ? s.nibp.mode : 0;
  h += '<section class="pnl"><h2>Ritmas</h2><div class="chips">' + SIM.RH.map(([k, t]) => chip('rh', k, rh === k, t)).join('') + '</div>';
  h += '<h2>Jutikliai</h2><div class="chips">' + [['ecg', 'EKG elektrodai'], ['spo2', 'SpO₂ zondas'], ['nibp', 'AKS manžetė']].map(([k, t]) => chip('probe', k, !!pr[k], (pr[k] ? '✓ ' : '✕ ') + t)).join('') + '</div>';
  h += '<h2>AKS matavimas</h2><div class="chips">' + chip('nibp', '1', false, 'Matuoti dabar') + [0, 3, 5, 10, 15].map(m => chip('nmode', m, nm === m, m ? 'Auto ' + m + ' min' : 'Rankinis')).join('') + '</div></section>';
  // monitoriaus nustatymai
  const o = s || { sound: 1, beep: 1, alarms: 1 };
  h += '<section class="pnl"><h2>Monitorius</h2><div class="chips">' + chip('opt', 'sound', !!o.sound, (o.sound ? '✓ ' : '') + 'Garsas') + chip('opt', 'beep', !!o.beep, (o.beep ? '✓ ' : '') + 'Pulso pyptelėjimas') + chip('opt', 'alarms', !!o.alarms, (o.alarms ? '✓ ' : '') + 'Aliarmai') + '</div>' +
    '<div class="acts"><button class="btn" data-act="mute">Nutildyti 2 min</button><button class="btn" data-act="reset">Atstatyti normą</button></div></section>';
  return h;
}
function stagePayload(sc, i) {
  const x = sc.st[i]; if (!x) return null; const v = {}; SIM.P.forEach(k => { if (x.v[k] != null) v[k] = x.v[k]; });
  return { c: 'apply', v, d: dur, r: x.v.r || (sc.src !== 'SIM' ? null : null), l: sc.pav, s: x.n };
}

// ── vaizdai ──
function home() {
  return `<div class="hero"><img src="img/logo-balt.png" alt="1040 medkuopa" class="lg"><h1>SIM</h1><p class="muted">Paciento monitoriaus simuliatorius treniruotėms</p></div>` +
    `<div class="tiles"><a class="tile" href="#/monitorius">${ICO.mon}<b>Monitorius</b><small>Šis telefonas – paciento monitorius</small></a>` +
    `<a class="tile" href="#/instruktorius">${ICO.ctrl}<b>Instruktorius</b><small>Valdyti kitą telefoną</small></a></div>` +
    `<details class="hlp"><summary>Kaip naudoti</summary><ol>` +
    `<li><b>Vienas telefonas:</b> Monitorius → <span class="ki">${ICO.gear}</span> (kairėje viršuje) – pultas virš monitoriaus.</li>` +
    `<li><b>Du telefonai</b> (abiem reikia interneto, bendro Wi-Fi nereikia): monitoriuje pultas → <b>Prijungti instruktorių</b>. Instruktoriaus telefono kamera nuskaitykite QR kodą arba SIM → <b>Instruktorius</b> ir įveskite kodą.</li>` +
    `<li>Pasirinkite scenarijų ir etapą arba keiskite rodiklius. <b>Pokytis per</b> – per kiek laiko monitorius pasieks naujas reikšmes.</li>` +
    `<li>Garsas įsijungia palietus monitoriaus ekraną. Ekranas neužgęsta, kol monitorius atidarytas.</li></ol></details>` +
    `<details class="hlp"><summary>Apie</summary><p>Versija ${VER}. Parengė 1040 medkuopa. Mokymo priemonė – ne medicinos prietaisas; rodikliai ir kreivės sugeneruoti.</p>` +
    `<p class="muted">Rodomi: EKG (II), ŠSD, SpO₂ su pletizmograma, neinvazinis AKS (sist./diast., vidutinis), kvėpavimo dažnis ir kreivė, temperatūra. Aliarmų ribos – tipinės suaugusiųjų monitoriaus numatytosios; garsiniai signalai primena IEC 60601-1-8 prioritetus. Scenarijai – SIM, ETC gido ir March gido treniruočių scenarijai.</p>` +
    `<p class="muted">Kiti gidai: <a href="https://etc.1040medkuopa.lt" target="_blank" rel="noopener">ETC gidas</a> · <a href="https://march.1040medkuopa.lt" target="_blank" rel="noopener">March gidas</a></p></details>`;
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
  let h = `<div class="bar"><a class="ib" href="#/" aria-label="Atgal">${ICO.back}</a><h1>Instruktorius</h1><span class="cst ${on ? 'on' : ''}">${on ? '● Prijungta' : '○ Neprijungta'}</span></div>`;
  if (on) return h + panel() + `<div class="acts"><button class="btn" data-act="${RTC.open() ? 'rtc-close' : 'rel-stop'}">Atjungti</button></div>`;
  h += '<section class="pnl">';
  if (RELAY.role() === 'ctrl') {
    h += `<p class="mt0"><b>Kodas ${fmtRoom(RELAY.room())}</b> – ${relState === 'conn' ? 'jungiamasi prie interneto…' : 'laukiama monitoriaus…'}</p>` +
      '<p class="muted">Monitoriuje turi būti atidarytas pultas su šiuo kodu. Patikrinkite, ar abu telefonai turi internetą.</p><button class="btn" data-act="rel-stop">Atšaukti</button>';
  } else if (RTC.role() === 'ctrl' || ctrlCode) {
    h += '<p class="mt0"><b>2.</b> Parodykite šį kodą monitoriaus kamerai:</p><div class="qr" id="qrc"></div>' +
      `<details class="hlp"><summary>Be kameros – kopijuoti kodą</summary><textarea class="inp code" readonly>${esc(ctrlCode)}</textarea><button class="btn" data-act="copy" data-k="${esc(ctrlCode)}">Kopijuoti</button></details>` +
      '<p class="muted">Jungiamasi…</p><button class="btn" data-act="rtc-close">Pradėti iš naujo</button>';
  } else {
    h += '<p class="mt0">Monitoriuje: pultas → <b>Prijungti instruktorių</b>. Nuskaitykite jo QR kodą telefono kamera arba įveskite kodą:</p>' +
      '<div class="paste"><input class="inp roomin" id="room" placeholder="ABC-123" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Monitoriaus kodas"><button class="btn pri" data-act="rel-join">Jungtis</button></div>' +
      '<p class="muted">Reikia interneto abiem telefonams; bendro Wi-Fi nereikia.</p>' +
      '<details class="hlp"><summary>Be interneto (tas pats Wi-Fi) – bandomasis</summary><p class="muted">Monitoriuje: pultas → Be interneto → Jungti be interneto. Tada nuskaitykite jo kodą:</p>' + scanBox('cs') + '</details>';
  }
  return h + '</section>';
}
function monitor() {
  return `<div id="monroot"></div><button class="mbtn mg" data-act="drawer" aria-label="Instruktoriaus pultas">${ICO.gear}</button><button class="mbtn mm" data-act="mute" aria-label="Nutildyti aliarmus 2 min">${ICO.mute}</button>` +
    `<div class="drawer" id="drawer"><div class="dhd"><b>Pultas</b><button class="ib" data-act="drawer" aria-label="Uždaryti">${ICO.x}</button></div><div class="dbd" id="dbd"></div><div class="dft"><a class="btn" href="#/">Išeiti iš monitoriaus</a></div></div>` +
    `<div class="tapsound" id="tapsound" data-act="sound-on">Palieskite – įjungti garsą</div>`;
}
let wl = null;
async function wake() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && route() === 'monitorius') wake(); });

let lastRoute = null;
function render() {
  const r = route(), app = $('#app');
  if (r !== lastRoute) { if (lastRoute === 'monitorius') { SIM.stop(); if (RELAY.role() === 'host') { RELAY.stop(true); relState = 'off'; } if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); if (wl) { try { wl.release(); } catch (e) {} wl = null; } } RTC.scanStop(); }
  document.body.classList.toggle('monmode', r === 'monitorius');
  if (r === 'monitorius') {
    if (lastRoute !== 'monitorius') { app.innerHTML = monitor(); SIM.mount($('#monroot')); wake(); const hr = LSg('sim-room-host', ''); if (hr && !RELAY.role() && RELAY.valid(hr)) RELAY.host(hr); }
    const d = $('#dbd'); if (d && $('#drawer.on')) d.innerHTML = panel() + pairHost();
    qrHost();
  } else if (r === 'instruktorius') {
    autoJoin(); app.innerHTML = instructor(); if (ctrlCode && rtcState !== 'on') drawQr('qrc', ctrlCode);
  } else app.innerHTML = home();
  lastRoute = r;
}
function qrHost() { if (RELAY.role() === 'host' && relState !== 'on') drawQr('qrh', joinUrl(RELAY.room())); else if (hostCode && rtcState !== 'on') drawQr('qrh', hostCode); }
function autoJoin() {
  const m = /[?&]k=([A-Za-z0-9-]+)/.exec(location.hash);
  if (m) { const c = RELAY.norm(m[1]); history.replaceState(null, '', '#/instruktorius'); if (RELAY.valid(c)) { RTC.close(); ctrlCode = ''; RELAY.join(c); LSs('sim-room-ctrl', c); } return; }
  const saved = LSg('sim-room-ctrl', ''); if (saved && !RELAY.role() && !RTC.role() && RELAY.valid(saved)) RELAY.join(saved);
}
async function drawQr(id, code) { const el = document.getElementById(id); if (!el) return; try { el.innerHTML = await RTC.qrSvg(code); } catch (e) { el.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; } }
function rerenderPanel() { if (route() === 'monitorius') { const d = $('#dbd'); if (d) { const y = d.scrollTop; d.innerHTML = panel() + pairHost(); d.scrollTop = y; qrHost(); } } else { const y = scrollY; render(); scrollTo(0, y); } }

async function onCode(id, code) {
  try {
    if (id === 'hs') { await RTC.hostAccept(code); toast('Jungiamasi…'); }
    else { ctrlCode = await RTC.join(code); render(); }
  } catch (e) { toast(e.message || 'Klaida'); }
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, k = el.dataset.k;
  SIM.audio();
  switch (a) {
    case 'sound-on': el.remove(); try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement && !matchMedia('(display-mode: standalone)').matches) d.requestFullscreen().catch(() => {}); } catch (x) {} return;
    case 'drawer': { const d = $('#drawer'); d.classList.toggle('on'); if (d.classList.contains('on')) { $('#dbd').innerHTML = panel() + pairHost(); qrHost(); } const ts = $('#tapsound'); if (ts) ts.remove(); return; }
    case 'mute': send({ c: 'mute' }); toast('Aliarmai nutildyti 2 min'); return;
    case 'dur': dur = +k; LSs('sim-dur', dur); break;
    case 'd-': case 'd+': { const T = (snap() || {}).t || SIM.targets(), st = LB[k][2], v0 = k in draft ? draft[k] : T[k]; let v = Math.round((v0 + (a === 'd+' ? st : -st)) * 10) / 10; v = Math.max(SIM.LIM[k][0], Math.min(SIM.LIM[k][1], v)); if (v === T[k]) delete draft[k]; else draft[k] = v; break; }
    case 'apply': if (!Object.keys(draft).length) return; if (send({ c: 'apply', v: draft, d: dur })) { toast(dur ? 'Keičiasi per ' + DUR.find(x => x[0] === dur)[1] : 'Pritaikyta'); draft = {}; } break;
    case 'undo': draft = {}; break;
    case 'rh': send({ c: 'rh', r: k }); break;
    case 'probe': { const s = snap(); send({ c: 'probe', k, on: !(s && s.probe[k]) }); break; }
    case 'nibp': send({ c: 'nibp' }); toast('AKS matuojamas'); break;
    case 'nmode': send({ c: 'nmode', m: +k }); break;
    case 'opt': { const s = snap() || {}; send({ c: 'opt', k, v: !s[k] }); break; }
    case 'reset': if (!confirm('Atstatyti normalius rodiklius?')) return; send({ c: 'reset' }); draft = {}; break;
    case 'sc-list': scenList = true; break;
    case 'sc-close': scenList = false; break;
    case 'sc-none': scen = null; LSs('sim-scen', null); send({ c: 'label', l: '', s: '' }); break;
    case 'sc-pick': { const [src, id] = k.split('|'); scen = { src, id }; LSs('sim-scen', scen); scenList = false; const sc = findScen(); if (sc) { const p = stagePayload(sc, 0); p.d = 0; if (sc.src === 'SIM') p.r = sc.st[0].v.r || 'sinus'; else p.r = 'sinus'; send(p); toast(sc.st[0].n + ' – nustatyta'); } draft = {}; break; }
    case 'sc-st': { const sc = findScen(); if (!sc) return; const p = stagePayload(sc, +k); if (sc.src === 'SIM') { let r = null; for (let i = +k; i >= 0 && !r; i--) r = sc.st[i].v.r; p.r = r || 'sinus'; } if (send(p)) toast(sc.st[+k].n + (dur ? ' – per ' + DUR.find(x => x[0] === dur)[1] : '')); draft = {}; break; }
    case 'rel-host': RTC.close(); hostCode = ''; LSs('sim-room-host', RELAY.host()); break;
    case 'rel-join': { const c = RELAY.norm(($('#room') || {}).value); if (!RELAY.valid(c)) { toast('Kodas – 6 raidės ar skaitmenys'); return; } RTC.close(); ctrlCode = ''; RELAY.join(c); LSs('sim-room-ctrl', c); render(); return; }
    case 'rel-stop': RELAY.stop(); LSs(isHostRoute() ? 'sim-room-host' : 'sim-room-ctrl', ''); if (route() === 'instruktorius') { remoteSnap = null; render(); return; } break;
    case 'rtc-host': RELAY.stop(); LSs('sim-room-host', ''); try { el.disabled = true; el.textContent = 'Ruošiama…'; hostCode = await RTC.host(); } catch (x) { toast('Nepavyko: ' + (x.message || x)); } break;
    case 'rtc-close': RTC.close(); hostCode = ''; ctrlCode = ''; render(); return;
    case 'copy': try { await navigator.clipboard.writeText(k); toast('Nukopijuota'); } catch (x) { toast('Nepavyko nukopijuoti – pažymėkite tekstą'); } return;
    case 'paste': { const v = (document.getElementById('paste-' + k) || {}).value || ''; if (v.trim()) onCode(k, v.trim()); return; }
    case 'scan': { const box = document.getElementById('cam-' + k); if (!box) return; box.hidden = false; const stEl = box.querySelector('.camst'); RTC.scan(box.querySelector('video'), code => { box.hidden = true; onCode(k, code); }, msg => { stEl.textContent = msg; }); return; }
    default: return;
  }
  rerenderPanel();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'scq') { scenQ = t.value; const pos = t.selectionStart; rerenderPanel(); const n = $('#scq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.classList.contains('pv')) {
    const k = t.dataset.k, v = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(v)) return;
    const T = (snap() || {}).t || SIM.targets(), c = Math.max(SIM.LIM[k][0], Math.min(SIM.LIM[k][1], v));
    if (c === T[k]) delete draft[k]; else draft[k] = c;
    t.closest('.pr').classList.toggle('ch', k in draft);
    const b = document.querySelector('[data-act="apply"]'), u = document.querySelector('[data-act="undo"]'), n = Object.keys(draft).length;
    if (b) { b.disabled = !n; b.textContent = 'Taikyti' + (n ? ' (' + n + ')' : ''); } if (u) u.disabled = !n;
  }
});
window.addEventListener('hashchange', render);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const d = $('#drawer.on'); if (d) d.classList.remove('on'); } });
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
