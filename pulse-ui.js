'use strict';
// ───────── Pulse pultas: pasiruošimas (aplinka → scenarijus → pradėti), eiga (Pacientas · Gydymas · Įvykiai · Ataskaita),
// apatiniai lapai parametrams, atšaukimas, laikymas patvirtinimui, monitoriaus gydymo juosta ir komandos meniu ─────────
const PUI = (() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  const T = s => PULSE.mmss(s);
  const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const num = x => String(x).replace('.', ',');
  const RUN = ['run', 'pause', 'load', 'conn'];
  // pasiruošimo juodraštis (instruktoriaus telefone)
  let SU = Object.assign({ set: 'medevac', mech: 'gswt', inj: null, pat: { state: 'Soldier@0s.json', name: '', age: 25, kg: 80, allergy: '' }, ff: 0, scen: 'vilkas', mode: 'chain', out: 'typ', auto: true, team2: true, eng: 'local' }, LS('sim-pu-su', {}));
  let LOCAL = SU.eng !== 'pulse', Q = '', seenR1 = LS('sim-pu-r1', ''), seenH = LS('sim-pu-h', '');
  const saveSU = () => LSs('sim-pu-su', SU);
  const mechBy = k => PCAT.MECH.find(m => m[0] === k) || PCAT.MECH[0];
  if (!SU.inj) SU.inj = mechBy(SU.mech)[3].map(j => Object.assign({}, j));
  let view = LS('sim-pu-view', 'pt'), cmOpen = false, sheet = null, rerender = () => {}, lastP = null;

  // ── pagalbinės ──
  const supK = a => ({ hem_stop: 'hem', inf_stop: 'inf', o2_off: 'o2', intub: 'intub' })[a.k] || a.k;
  const sup = (P, acts) => !P || !P.sup || !P.sup.length || (acts || []).every(a => P.sup.indexOf(supK(a)) >= 0 || (a.k === 'arrest' && P.sup.indexOf('arrest') >= 0));
const apxB = (key, full) => { const t = LOCAL ? '' : PCAT.apx(key); return t ? (full ? `<small class="apxt">≈ ${E(t)}</small>` : `<span class="apx" title="${E(t)}">≈</span>`) : ''; };
  const btn = (k, x, label, cls, extra) => `<button class="${cls || 'pxb'}" data-act="px" data-k="${k}"${x != null ? ` data-x="${E(x)}"` : ''}${extra || ''}>${label}</button>`;
  const stTxt = { off: 'nevyksta', conn: 'jungiamasi…', load: 'ruošiamas modelis…', run: 'vyksta', pause: 'pauzė', dead: 'pacientas mirė', err: 'klaida' };
  // laukiama vykdymo (atšaukimo lange) – mygtukas pažymimas, kad nebūtų paspausta dukart
  const pend = (P, n) => { const q = (P.q || []).find(x => x.n === n); return q ? q.left : null; };
  const pendS = l => `<small class="pxpend">⏳ vykdoma po ${l} s – atšaukti apačioje</small>`;
  const logB = '<span class="apxl"><span class="apx">≈</span> tik žurnale</span>';
  function bleedLoss(P) { const s = P.sc; return s && P.v && P.v.bv && s.bv0 ? s.bv0 - P.v.bv : 0; }

  // ── apžiūros radiniai (apytiksliai iš rodiklių ir sužalojimų) ──
  function findings(P) {
    const v = P.v || {}, sc = P.sc || { inj: [] }, act = j => PCAT.BAD.indexOf(j.state) >= 0, inj = k => sc.inj.filter(j => j.k === k);
    const arrest = sc.arrest || (v.hr != null && v.hr < 20);
    const tbi = Math.max(0, ...inj('tbi').map(j => j.sev)), aw = inj('aw').find(j => j.state !== 'secured'), br = inj('bronch')[0];
    const recentOp = sc.log && sc.log.some(l => /Morfinas|Fentanilis/.test(l.n) && (P.simt - l.t) < 1800);
    const F = [];
    F.push(['Radialinis pulsas', arrest || v.sys < 50 ? 'nėra (miego arterijoje – ' + (arrest ? 'nėra' : 'silpnas') + ')' : v.sys < 80 ? 'nečiuopiamas, miego a. čiuopiamas' : v.sys < 90 ? 'silpnas' + (v.hr > 110 ? ', dažnas' : '') : 'čiuopiamas' + (v.hr > 120 ? ', dažnas' : ''), arrest || v.sys < 80]);
    const avpu = arrest ? 'U – nereaguoja' : (v.spo2 < 75 || v.sys < 60 || tbi >= 0.9) ? 'P – reaguoja tik į skausmą' : (tbi >= 0.5 || v.spo2 < 85 || v.sys < 75) ? 'V – reaguoja į balsą, sutrikęs' : 'A – sąmoningas';
    F.push(['Sąmonė (AVPU)', avpu, avpu[0] !== 'A']);
    F.push(['Vyzdžiai', arrest ? 'platūs, nereaguoja' : tbi >= 0.75 ? 'anizokorija – vienas vyzdys platesnis, vangiai reaguoja' : recentOp ? 'siauri' : 'vienodi, reaguoja', arrest || tbi >= 0.75]);
    const chest = [];
    sc.inj.filter(j => (j.k === 'ptx' || j.k === 'optx' || j.k === 'htx') && j.state !== 'drained').forEach(j => chest.push((j.side === 'R' ? 'dešinėje' : 'kairėje') + (j.k === 'htx' ? ' susilpnėjęs, duslus perkusijoje' : act(j) ? ' nesigirdi' : ' susilpnėjęs')));
    if (aw && act(aw)) chest.push('stridoras / gargimas');
    if (br) chest.push('švokštimas');
    if (v.rr != null && v.rr < 8) chest.push('retas, paviršinis');
    F.push(['Kvėpavimas', chest.length ? chest.join('; ') : 'girdimas abipus, lygus', chest.length > 0]);
    const tension = sc.inj.some(j => (j.k === 'ptx' || j.k === 'optx') && act(j) && j.sev >= 0.5) || sc.inj.some(j => j.k === 'tam' && j.state !== 'drained');
    F.push(['Kaklo venos', tension && v.sys > 50 ? 'išsipūtusios' : 'neišsipūtusios', tension]);
    const burn = inj('burn')[0], shock = v.sys < 90 || (v.hr > 120 && v.sys < 100);
    F.push(['Oda', (v.spo2 != null && v.spo2 < 85 ? 'cianozė; ' : '') + (shock ? 'blyški, šalta, drėgna; KPL > 2 s' : 'šilta, rausva; KPL < 2 s') + (burn ? '; nudegimai ' + Math.round(burn.sev * 100) + ' %' : ''), shock]);
    return F;
  }

  function prebrief() {
    const m = mechBy(SU.mech), S = PCAT.SETTINGS[SU.set];
    const I = SU.inj.map(j => PCAT.injName(j).name.toLowerCase()).join('; ') || 'nenustatyta';
    return `${S.n === 'MEDEVAC' ? 'Priimate sužeistąjį evakuacijai' : 'Į Role 1 punktą atvežamas sužeistasis'}${SU.ff ? ' praėjus ' + SU.ff / 60 + ' min nuo sužeidimo' : ''}. ` +
      `MIST: M – ${m[1]}; I – ${I}; S – matysite monitoriuje; T – ${SU.ff ? 'suteikta nebuvo (patikrinkite!)' : 'dar nesuteikta'}. ` +
      `Priemonės ir vaistai – pagal ${S.src} gidą${S.n === 'MEDEVAC' ? '; kraujo – ' + S.blood + ' vnt., deguonis – balionas' : ''}. Veiksmus, kurių modelis neskaičiuoja (pvz. TXA, antibiotikai), sakykite garsiai – jie žymimi žurnale.`;
  }

  // ── pasiruošimas ──
  function setupHtml(P, local) {
    LOCAL = SU.eng !== 'pulse';
    const S = PCAT.SETTINGS, mech = mechBy(SU.mech), SC0 = SU.scen ? PSCEN.get(SU.scen) : null;
    let h = '<div class="pxw"><section class="pnl"><h2>Scenarijus</h2><div class="pxcards">' +
      PSCEN.LIST.map(s => `<button class="pxcard${SU.scen === s.id ? ' on' : ''}" data-act="px" data-k="su-scen" data-x="${s.id}"><b>${E(s.n)}</b><small>${E(s.d)}</small></button>`).join('') +
      `<button class="pxcard${!SU.scen ? ' on' : ''}" data-act="px" data-k="su-scen" data-x=""><b>Laisvas scenarijus</b><small>Pasirenkate aplinką, mechanizmą ir sužalojimus patys</small></button></div></section>`;
    if (SC0) {
      h += '<section class="pnl"><h2>Pradžia</h2>' +
        [['chain', 'Visa grandinė', 'MEDEVAC ' + PSCEN.mm(SC0.start.medevac) + ' → MIST → Role 1 → ATMISTER'], ['medevac', 'Tik MEDEVAC', 'baigiasi MIST perdavimu'], ['role1', 'Tik Role 1', 'atvežtas ' + PSCEN.mm(SC0.role1At) + ' po MEDEVAC baigties:']].map(o => `<button class="pxrow${SU.mode === o[0] ? ' on' : ''}" data-act="px" data-k="su-mode" data-x="${o[0]}"><span><b>${SU.mode === o[0] ? '● ' : '○ '}${E(o[1])}</b><small>${E(o[2])}</small></span></button>`).join('') +
        (SU.mode === 'role1' ? '<div class="chips">' + Object.keys(SC0.out).map(k => `<button class="chip pxch${SU.out === k ? ' on' : ''}" data-act="px" data-k="su-out" data-x="${k}">${E(SC0.out[k].n)}</button>`).join('') + `</div><p class="muted">${E(SC0.out[SU.out] ? SC0.out[SU.out].d : '')}</p>` : '') +
        `<button class="pxrow" data-act="px" data-k="su-auto"><span><b>Planuoti įvykiai automatiškai</b><small>${SU.auto ? 'Įjungta – įvykiai (triukšmas, vibracija, užsilenkęs kateteris…) įvyks patys' : 'Išjungta – sukelsite patys skiltyje „Įvykiai“'}</small></span><i>${SU.auto ? 'Taip' : 'Ne'}</i></button>` +
        (SU.mode === 'chain' ? `<button class="pxrow" data-act="px" data-k="su-team2"><span><b>Role 1 – kita komanda</b><small>${SU.team2 ? 'Ties perdavimu keičiasi komanda; vertinimas atskirai' : 'Ta pati komanda tęsia'}</small></span><i>${SU.team2 ? 'Taip' : 'Ne'}</i></button>` : '') +
        '</section>' +
        `<section class="pnl"><h2>Įžanga komandai</h2><p class="pxpre">${E(SC0.brief)}</p><p class="muted">Sužalojimai (instruktoriui): ${E(SC0.inj.filter(j => j.lbl).map(j => j.lbl + (j.note ? ' – ' + j.note : '')).join('; '))}.</p></section>`;
    } else {
      h += '<section class="pnl"><h2>1. Aplinka</h2><div class="pxseg">' + Object.keys(S).map(k => `<button class="pxsg${SU.set === k ? ' on' : ''}" data-act="px" data-k="su-set" data-x="${k}"><b>${S[k].n}</b><small>pagal ${S[k].src} gidą</small></button>`).join('') + '</div>' +
        `<p class="muted">${E(S[SU.set].d)}</p></section>`;
      h += '<section class="pnl"><h2>2. Mechanizmas</h2><div class="pxcards">' + PCAT.MECH.map(m => `<button class="pxcard${SU.mech === m[0] ? ' on' : ''}" data-act="px" data-k="su-mech" data-x="${m[0]}"><b>${E(m[1])}</b><small>${E(m[2])}</small></button>`).join('') + '</div></section>';
      h += '<section class="pnl"><h2>3. Pacientas ir sužalojimai</h2>' +
        `<button class="pxrow" data-act="px" data-k="sh-pat"><span><b>${E(SU.pat.name || (PCAT.PATIENTS.find(p => p[0] === SU.pat.state) || PCAT.PATIENTS[0])[1])}</b><small>${E([SU.pat.age ? SU.pat.age + ' m.' : '', SU.pat.kg ? SU.pat.kg + ' kg' : '', SU.pat.allergy ? 'alergija: ' + SU.pat.allergy : 'alergijų nėra'].filter(Boolean).join(' · '))}</small></span><i>Keisti ›</i></button>` +
        '<div class="pxinj">' + (SU.inj.length ? SU.inj.map((j, i) => { const n = PCAT.injName(j); return `<div class="pxij"><span>${(PCAT.injBy(j.k) || {}).ico || ''} ${E(n.name)}${n.sev ? ` <small>${E(n.sev)}</small>` : ''}${apxB('inj:' + j.k, 1)}</span><button class="pxx" data-act="px" data-k="su-del" data-x="${i}" aria-label="Pašalinti">✕</button></div>`; }).join('') : '<p class="muted">Sužalojimų nėra.</p>') + '</div>' +
        btn('sh-inj', 'setup', '＋ Pridėti sužalojimą', 'pxb wide') +
        '<p class="lbl pxlb">Komanda atvyksta praėjus</p><div class="chips">' + [0, 5, 10, 20, 30].map(m => `<button class="chip pxch${SU.ff === m * 60 ? ' on' : ''}" data-act="px" data-k="su-ff" data-x="${m * 60}">${m ? m + ' min' : 'iš karto'}</button>`).join('') + '</div></section>';
      h += `<section class="pnl"><h2>Įžanga komandai</h2><p class="pxpre">${E(prebrief())}</p></section>`;
    }
    // variklis
    h += '<section class="pnl"><h2>Variklis</h2><div class="pxseg">' +
      `<button class="pxsg${SU.eng !== 'pulse' ? ' on' : ''}" data-act="px" data-k="su-eng" data-x="local"><b>Taisyklių modelis ≈</b><small>telefone · be interneto</small></button>` +
      `<button class="pxsg${SU.eng === 'pulse' ? ' on' : ''}" data-act="px" data-k="su-eng" data-x="pulse"><b>Pulse</b><small>serveris · tikslesnė fiziologija</small></button></div>`;
    if (SU.eng === 'pulse') {
      const w = PULSE.wakeState();
      const wt = w.st === 'ready' ? `<b class="ok">✓ Serveris pabudęs</b> – ${E(w.msg)}${w.ses ? ' · sesijos ' + E(w.ses) : ''}. Budrus dar ${w.left} min.` : w.st === 'waking' ? `<b class="amb">Žadinama… ${w.sec} s</b> (miegantis serveris pasileidžia per 1–2 min.)` : w.st === 'err' ? `<b class="bad">✕ ${E(w.msg)}</b>` : 'Serveris gali miegoti – pažadinkite iš anksto, kad PRADĖTI veiktų be laukimo.';
      h += `<div class="pxwake"><button class="pxb${w.st === 'ready' ? '' : ' pri'}" data-act="px" data-k="wake">${w.st === 'ready' ? 'Laikyti budrų' : w.st === 'waking' ? 'Žadinama…' : 'Pažadinti Pulse serverį'}</button><p class="muted">${wt}</p></div>` +
        `<p class="mt0"><span class="apx">≈</span> – <b>Pulse 4.3.1 tokios funkcijos neturi</b>: rodiklių pokytį apytiksliai sukuria programėlė (pvz. nudegimai, GST, skausmas, intubacija, perikardiocentezė). Visa kita skaičiuoja Pulse.</p>`;
      const tokOk = local ? PULSE.cfg().token : (!P || (P.ptok != null ? P.ptok : P.tok !== false) || String(PULSE.cfg().token || '').trim());
      if (!tokOk) h += `<p class="mira p1">Pulse serverio žetono nėra ${local ? 'šiame telefone' : 'nei šiame, nei monitoriaus telefone'}: įveskite jį Nustatymai → Pulse serveris.</p>`;
    } else h += '<p class="mt0 muted">Rodikliai skaičiuojami telefone paprastomis taisyklėmis (ATLS šoko klasės, TCCC / ETC mokomosios reikšmės). <b>Visas variklis apytikslis (≈)</b> – reikšmės mokomosios, ne klinikinės. Internetas nereikalingas.</p>';
    h += '</section>';
    if (P && (P.msg && P.st === 'off' && !(P.sc && P.sc.lost) || (P.sid && P.st !== 'dead' && P.sc && P.sc.end == null) || (P.sc && P.sc.end != null))) h += '<section class="pnl">' +
      (P.msg && P.st === 'off' && !(P.sc && P.sc.lost) ? `<p class="muted">${E(P.msg)}</p>` : '') +
      (P.sid && P.st !== 'dead' && P.sc && P.sc.end == null ? btn('resume', null, 'Atkurti ankstesnę sesiją', 'pxb wide') : '') +
      (P.sc && P.sc.end != null ? btn('view', 'rep', 'Ankstesnio scenarijaus ataskaita', 'pxb wide') : '') + '</section>';
    const lbl = SC0 ? SC0.n + ' · ' + ({ chain: 'visa grandinė', medevac: 'tik MEDEVAC', role1: 'tik Role 1 (' + (SC0.out[SU.out] || {}).n + ')' })[SU.mode] : PCAT.SETTINGS[SU.set].n + ' · ' + mech[1] + ' · sužalojimų: ' + SU.inj.length;
    h += '<div class="pxbot pxbotsu">' + btn('start', null, '▶ PRADĖTI<small>' + E(lbl + ' · ' + (SU.eng === 'pulse' ? 'Pulse' : 'taisyklių modelis')) + '</small>', 'pxgo') + '</div></div>';
    return h;
  }

  // ── eiga: antraštė su tikrais rodikliais ──
  const PHN = { medevac: ['MEDEVAC · MARCH', 'medevac'], handover: ['PERDAVIMAS', 'hand'], role1: ['ROLE 1 · ETC', 'role1'], prep: ['RUOŠIAMA', 'hand'] };
  function vitCls(k, x, r1) {
    if (x == null) return '';
    const R = { hr: [x > 130 || x < 50, x > 110], sys: [x < (r1 ? 80 : 90), x < 100 || x > 160], spo2: [x < 90, x < 94], rr: [x > 30 || x < 8, x > 24], temp: [x < 35, x < 36], lost: [x > 1500, x > 750] }[k];
    return R ? (R[0] ? 'bad' : R[1] ? 'amb' : 'ok') : '';
  }
  function trend(P, k, idx) {
    const H = (P.sc && P.sc.vh) || [], cur = P.v && P.v[k]; if (cur == null || !H.length) return '';
    let old = null; for (let i = H.length - 1; i >= 0; i--) if (H[i][0] <= P.simt - 60) { old = H[i][idx]; break; }
    if (old == null) return '';
    const th = { hr: 8, sys: 8, spo2: 3, rr: 4 }[k] || 99;
    return cur - old >= th ? '↑' : old - cur >= th ? '↓' : '';
  }
  function headHtml(P) {
    const run = RUN.indexOf(P.st) >= 0, sp = P.speed || 1, sc = P.sc || {}, v = P.v || {}, r1 = sc.set === 'role1';
    const ph = PHN[sc.ph] || PHN[sc.set] || ['', ''];
    const lost = v.lost != null ? v.lost : bleedLoss(P);
    let h = `<div class="pxh"><div class="pxh1"><span class="pxclkw"><b class="pxclk">${T(P.simt)}</b><small class="pxst2 ${P.st}">${P.st === 'off' && sc.end != null ? 'baigta' : stTxt[P.st] || P.st} · nuo sužeidimo</small></span>` +
      `<span class="pxbadges"><span class="pxph ${ph[1]}">${E(ph[0])}</span><span class="pxengb">${P.local ? 'Taisyklių modelis ≈' : 'Pulse'}</span></span>` +
      (run || P.st === 'dead' ? `<button class="pxi pxstop" data-act="px" data-k="stop" data-hold="1" aria-label="Baigti (laikykite 1,5 s)">■<small>laikykite</small></button>` : '') + '</div>';
    if (P.v) {
      const C = [['hr', 'ŠSD', v.hr, 1], ['sys', 'AKS', v.sys != null ? v.sys + '/' + v.dia : null, 2], ['spo2', 'SpO₂', v.spo2, 3], ['rr', 'KD', v.rr, 4], ['temp', 'T', v.temp != null ? num(v.temp) : null], ['lost', 'Netekta', lost ? num(Math.round(lost / 100) / 10) + ' l' : '0 l']];
      h += '<div class="pxvit">' + C.map(c => { const raw = c[0] === 'sys' ? v.sys : c[0] === 'lost' ? lost : v[c[0]], cl = vitCls(c[0], raw, r1), tr = c[3] ? trend(P, c[0], c[3]) : ''; return `<div class="${cl}"><small>${c[1]}</small><b>${c[2] == null ? '–' : E(c[2])}${tr}</b></div>`; }).join('') + '</div>';
    }
    h += chipsHtml(P);
    if (run) h += '<div class="pxh2">' + btn('speed', sp, '×' + sp, 'pxi', ' aria-label="Greitis: ×' + sp + ' (keisti)"') + btn('mark', null, '★', 'pxi', ' aria-label="Pažymėti aptarimui"') + btn('skip', 300, '⏭ +5 min', 'chip pxch') + btn('skip', 900, '⏭ +15 min', 'chip pxch') + (P.skip ? `<span class="muted">praleidžiama… liko ${T(P.skip)}</span>` : '') + (P.msg && P.st !== 'run' ? `<span class="muted">${E(P.msg)}</span>` : '') + '</div>';
    else if (P.msg) h += `<div class="pxh2"><span class="muted">${E(P.msg)}</span></div>`;
    if (P.eng && !P.pulse && !P.local) h += '<div class="pxh2"><span class="mira p1">Serveryje veikia testinis variklis, ne Pulse</span></div>';
    return h + '</div>';
  }
  function chipsHtml(P) {
    const sc = P.sc, C = [], t = P.simt;
    if (!sc || !sc.inj) return '';
    sc.inj.filter(j => j.tq0 != null && j.state !== 'pdress').forEach(j => { const loose = j.tqOn == null; C.push(`<span class="pxchip ${loose ? 'bad' : 'amb'}">TQ ${E(j.lbl ? j.lbl.split(' ')[0].toLowerCase() : (PCAT.locBy(j.loc) || [0, ''])[1].split(' ')[0].toLowerCase())} ${T(t - j.tq0)}${loose ? ' · atsileidęs' : ''}</span>`); });
    const txa = PSCEN.drugT(sc, 'txa'), bleeding = sc.inj.some(j => j.k === 'bleed' || j.k === 'htx');
    if (txa != null) C.push(`<span class="pxchip">TXA ✓ ${PSCEN.mm(txa)}</span>`);
    else if (bleeding && t < 10800) { const lim = sc.set === 'role1' && t < 5400 ? 5400 : 10800; C.push(`<span class="pxchip amb">TXA liko ${Math.round((lim - t) / 60)} min</span>`); }
    (sc.inf || []).forEach(f => { const left = f.tot - Math.max(0, t - f.t0); if (left > 0) C.push(`<span class="pxchip blu">${E(f.n.replace('Pilnas kraujas', 'Kraujas'))} · ${T(left)}</span>`); });
    if (sc.kit) C.push(`<span class="pxchip">Kraujas ${Math.ceil(sc.kit.used)}/${sc.kit.max}</span>`);
    if (sc.o2) C.push(`<span class="pxchip blu">O₂ ${sc.o2.flow} l/min</span>`);
    const bu = (sc.log || []).filter(l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || '')).length, ca = (sc.log || []).filter(l => l.code === 'drug' && l.id === 'ca').length;
    if (bu && !ca) C.push('<span class="pxchip bad">Kalcis – neskirtas</span>');
    if (sc.set === 'role1' && sc.r1t0 != null && t >= sc.r1t0) { const nx = 900 - ((t - sc.r1t0) % 900); C.push(`<span class="pxchip">Vertinimas po ${Math.ceil(nx / 60)}′</span>`); }
    const ne = nextEv(P); if (ne) C.push(`<span class="pxchip dim">Kitas įvykis: ${E(ne)}</span>`);
    return C.length ? '<div class="pxchips">' + C.join('') + '</div>' : '';
  }
  function nextEv(P) {
    const sc = P.sc, S = sc && sc.scen && PSCEN.get(sc.scen.id); if (!S || !sc.scen.auto || !sc.evd) return '';
    const ph = sc.ph, P0 = (sc.phs || [])[sc.phs.length - 1], base = ph === 'role1' && P0 ? P0.t0 : 0;
    const e = S.ev.filter(x => x.ph === ph && sc.evd[x.id] == null && x.at != null && !x.hide).sort((a, b) => a.at - b.at)[0];
    return e ? e.n.split(' – ')[0].split(' (')[0] + ' ' + T(base + e.at) : '';
  }

  // ── būklės centras ──
  let ADV = [];
  function statusHtml(P) {
    const sc = P.sc;
    ADV = P.st === 'dead' ? [] : PSCEN.advise(P).slice(0, 5);
    let h = '';
    const cm = (P.cm || []).filter(c => c.end == null).sort((a, b) => (b.lvl === 'crit') - (a.lvl === 'crit'))[0];
    const top = ADV.find(a => a.lvl === 'crit') || (cm ? ADV[0] : null);
    if (cm || (top && top.lvl === 'crit')) {
      const lvl = cm ? cm.lvl : 'crit';
      h += `<div class="pxalert ${lvl}"><b>${E(cm ? cm.title : top.n)}</b>` +
        `<span>${E(cm ? 'Kodėl: ' + (cm.why[0] || '') : top.why)}</span>` +
        (top ? `<button class="pxalertgo" data-act="px" data-k="adv" data-x="${ADV.indexOf(top)}">Atlikti: ${E(top.n)}</button>` : '') +
        (cm ? `<button class="pxalertmore" data-act="px" data-k="cm">${cmOpen ? 'Mažiau' : 'Daugiau – visos priežastys ir ką daryti'}</button>` : '') +
        (cm && cmOpen ? `<div class="pxcw"><p>Galimos priežastys:</p><ul>${cm.why.map(x => '<li>' + E(x) + '</li>').join('')}</ul>${cm.todo.length ? '<p>Ką daryti:</p><ul>' + cm.todo.map(x => '<li>' + E(x) + '</li>').join('') + '</ul>' : ''}<small>Užuomina pagal modelį ir pažymėtus veiksmus – ne diagnozė.</small></div>` : '') + '</div>';
    }
    if (sc.ph === 'handover') h += `<div class="pxalert hand"><b>Nusileidimas – MIST perdavimas</b><span>Komanda perduoda pacientą. Pažymėkite, ką pasakė, ir perduokite į Role 1.</span>${btn('view', 'hand', 'Atidaryti perdavimą', 'pxalertgo')}</div>`;
    if (sc.evacT != null) h += `<div class="pxalert hand"><b>Evakuacija atvyko – ATMISTER</b><span>Komanda perduoda pacientą Role 2.</span>${btn('view', 'hand', 'ATMISTER įvertinimas', 'pxalertgo')}</div>`;
    h += `<p class="pxlbl">Dabar svarbiausia · ${sc.set === 'role1' ? 'ETC' : 'MARCH'}</p>`;
    h += ADV.length ? ADV.map((a, i) => `<button class="pxadv ${a.lvl}" data-act="px" data-k="adv" data-x="${i}"><span class="pxL">${E(a.L)}</span><span class="pxadvt"><b>${E(a.n)}</b><small>${E(a.why)}</small></span><i>›</i></button>`).join('') : '<p class="muted">Skubių veiksmų pagal rodiklius nėra – stebėkite, vertinkite pakartotinai.</p>';
    h += btn('view', 'all', 'Visi veiksmai ir paieška ›', 'pxb wide');
    const done = (sc.log || []).filter(l => l.kind === 'tx' && l.by !== 'instr' && (!sc.r1t0 || sc.set !== 'role1' || l.t >= sc.r1t0)).slice(-6).reverse();
    if (done.length) h += '<p class="pxlbl">Atlikta</p><div class="pxdone">' + done.map(l => `<span><small>${T(l.t)}</small> ${E(l.n.split(' (')[0])}</span>`).join('') + '</div>';
    h += '<section class="pnl"><h2>Apžiūros radiniai' + (P.local ? '' : ' <span class="apx">≈</span>') + '</h2>' + (P.local ? '' : '<p class="apxt mt0">Pulse šių radinių neskaičiuoja – programėlė juos apytiksliai išveda iš rodiklių ir sužalojimų.</p>') + '<div class="pxf">' + findings(P).map(f => `<div class="${f[2] ? 'bad' : ''}"><small>${E(f[0])}</small><b>${E(f[1])}</b></div>`).join('') + '</div>' +
      htxLine(P) + '</section>';
    return h;
  }
  function htxLine(P) { const H = P.v && P.v.htx; if (!H) return ''; return Object.keys(H).filter(s => H[s].drained).map(s => `<p class="muted">Drenas ${s === 'R' ? 'dešinėje' : 'kairėje'}: išbėgo ${H[s].out} ml</p>`).join(''); }

  // ── visi veiksmai (su paieška) ──
  function allHtml(P) {
    const sc = P.sc, set = sc.set, other = set === 'role1' ? 'medevac' : 'role1';
    const q = Q.trim().toLowerCase();
    let h = `<div class="pxqw"><input class="inp pxq" id="pxq" type="search" placeholder="Paieška: dren, kalc, ketam, turnik…" autocomplete="off" aria-label="Veiksmų paieška" value="${E(Q)}"></div>`;
    const order = j => ['bleed', 'aw', 'ptx', 'optx', 'htx', 'tam', 'tbi', 'burn', 'bronch', 'pain'].indexOf(j.k);
    h += '<section class="pnl" data-q="sužalojimai"><h2>Sužalojimai</h2>' + (sc.inj.length ? sc.inj.slice().sort((a, b) => order(a) - order(b)).filter(j => !q || (PCAT.injName(j).name + ' ' + PCAT.cardActions(j, set).map(a => a[1]).join(' ') + ' ' + PCAT.cardActions(j, other).map(a => a[1]).join(' ')).toLowerCase().indexOf(q) >= 0).map(j => cardHtml(P, j) + offCard(P, j, other)).join('') : '<p class="muted">Sužalojimų nėra.</p>') + btn('sh-inj', 'live', '＋ Naujas sužalojimas', 'pxb wide ins') + '</section>';
    h += txHtml(P, null, q);
    // kitos aplinkos veiksmai – pilki su paaiškinimu (nieko neslepiame)
    const off = PCAT.TX.flatMap(g => g[2].filter(x => x[5] && x[5] !== set).map(x => [g[1], x])).filter(([g, x]) => !q || (x[1] + ' ' + g).toLowerCase().indexOf(q) >= 0);
    if (off.length) h += `<section class="pnl"><h2>Neprieinama ${set === 'role1' ? 'Role 1' : 'MEDEVAC'}</h2>` + off.map(([g, x]) => `<button class="pxrow" disabled data-q="${E((x[1] + ' ' + g).toLowerCase())}"><span><b>${E(x[1])}</b><small>tik ${x[5] === 'role1' ? 'Role 1 (ETC gidas)' : 'MEDEVAC (MARCH gidas)'}</small></span></button>`).join('') + '</section>';
    return h;
  }
  function offCard(P, j, other) {
    const here = PCAT.cardActions(j, P.sc.set).map(a => a[0]), miss = PCAT.cardActions(j, other).filter(a => a[4] === 'team' && here.indexOf(a[0]) < 0);
    if (!miss.length) return '';
    return '<div class="pxoff">' + miss.map(a => `<span data-q="${E(a[1].toLowerCase())}">${E(a[1])} – tik ${other === 'role1' ? 'Role 1 (ETC)' : 'MEDEVAC'}</span>`).join('') + '</div>';
  }

  // ── perdavimas (MIST / ATMISTER) ──
  let HM = LS('sim-pu-hm', {}), HO = Object.assign({ skip: 1, reprobe: 1, team2: 1 }, LS('sim-pu-ho', {}));
  function handHtml(P) {
    const sc = P.sc, kind = sc.set === 'role1' ? 'atm' : 'mist', I = PSCEN.handItems(P, kind), key = (sc.nonce || '') + kind, M = HM[key] || {};
    let h = `<section class="pnl"><h2>${kind === 'mist' ? 'MIST perdavimas (pagal MARCH)' : 'ATMISTER perdavimas (pagal ETC)'}</h2><p class="muted mt0">Komanda sako garsiai. Pažymėkite, kas pasakyta teisingai – žemiau programėlė rodo, kas iš tikrųjų įvyko.</p>`;
    h += I.map((it, i) => { const k = it[0] + i, m = M[k]; return `<div class="pxhand"><span class="pxhL">${E(it[0])}</span><span class="pxht"><small>${E(it[1])}</small>${E(it[2])}</span><span class="pxyn"><button class="${m === 1 ? 'y' : ''}" data-act="px" data-k="hm" data-x="${k}|1" aria-label="Pasakyta">✓</button><button class="${m === 0 ? 'n' : ''}" data-act="px" data-k="hm" data-x="${k}|0" aria-label="Nepasakyta / klaida">✕</button></span></div>`; }).join('');
    const yes = Object.values(M).filter(x => x === 1).length;
    h += `<p class="muted">Įvertinimas: ${yes} / ${I.length}</p></section>`;
    if (kind === 'mist' && RUN.indexOf(P.st) >= 0) {
      h += '<section class="pnl"><h2>Perkėlimas į Role 1</h2>' +
        [['skip', 'Praleisti pervežimą +3 min', 'modelis perskaičiuos greitai'], ['reprobe', 'Monitorius: prijungti daviklius iš naujo', 'Role 1 komanda prijungia EKG, SpO₂, AKS'], ['team2', 'Kita komanda (Role 1)', 'vertinimas atskirai']].map(o => `<button class="pxrow" data-act="px" data-k="ho" data-x="${o[0]}"><span><b>${E(o[1])}</b><small>${E(o[2])}</small></span><i>${HO[o[0]] ? 'Taip' : 'Ne'}</i></button>`).join('') +
        btn('torole1', null, 'Perduoti į Role 1 →', 'pxgo') + '</section>';
    }
    if (kind === 'atm' && RUN.indexOf(P.st) >= 0) h += '<section class="pnl">' + btn('stop', null, '■ Baigti scenarijų – ataskaita<small>laikykite 1,5 s</small>', 'pxgo red', ' data-hold="1"') + '</section>';
    return h;
  }
  // ── Role 1 priėmimas ──
  function recvHtml(P) {
    const sc = P.sc, v = P.v || {}, R = PSCEN.takeover(P);
    let h = '<div class="pxrecv"><b>Kas pasikeitė</b><dl>' +
      `<dt>Gidas</dt><dd>MARCH → ETC (procedūros, vaistai, dozės)</dd><dt>AKS tikslas</dt><dd>sAKS 80–90 (GST – ≥ 110)${v.sys != null ? ' · dabar ' + v.sys + (v.sys > 90 ? ' – virš tikslo' : v.sys < 80 ? ' – žemiau tikslo' : ' – tiksle') : ''}</dd>` +
      `<dt>Priemonės</dt><dd>kraujo bankas ${sc.kit ? sc.kit.max : 6} vnt., pirštinė torakostomija, drenas, RSI, e-FAST, šildymas</dd><dt>Laikmačiai</dt><dd>TXA – geriausia per 90 min; kalcis po 1-ojo ir kas 4 vnt.; vertinimas kas 15 min</dd></dl></div>`;
    h += '<p class="pxlbl">Perimta iš MEDEVAC – patikrinkite</p>' + R.map(r => `<div class="pxtk ${r[0]}"><b>${r[0] === 'ok' ? '✓' : r[0] === 'bad' ? '✕' : '!'}</b><span>${E(r[1])}<small>${E(r[2])}</small></span></div>`).join('');
    if (sc.team2) h += '<p class="muted">Komanda pasikeitė – Role 1 vertinimas skaičiuojamas atskirai.</p>';
    h += btn('recvok', null, 'Pradėti Role 1', 'pxgo');
    return h;
  }
  // ── scenarijaus įvykiai (skiltyje „Įvykiai“) ──
  function scenEvHtml(P) {
    const sc = P.sc, S = sc.scen && PSCEN.get(sc.scen.id); if (!S || !sc.evd) return '';
    const ph = sc.ph === 'handover' ? 'medevac' : sc.ph, P0 = (sc.phs || [])[sc.phs.length - 1], base = ph === 'role1' && P0 ? P0.t0 : 0;
    const L = S.ev.filter(e => e.ph === ph && !e.hide);
    return `<section class="pnl"><h2>Scenarijaus įvykiai</h2>${btn('auto', sc.scen.auto ? 0 : 1, sc.scen.auto ? 'Automatiškai: įjungta' : 'Automatiškai: išjungta', 'chip pxch' + (sc.scen.auto ? ' on' : ''))}` +
      L.map(e => { const f = sc.evd[e.id]; return `<div class="pxsev2${f != null ? ' done' : ''}"><span><b>${E(e.n)}</b><small>${f != null ? '✓ įvyko ' + T(f) : (e.at != null ? 'planuota ' + T(base + e.at) : 'kai įvyks sąlyga') + (e.when ? ' · su sąlyga' : '')}</small></span>${f == null ? btn('sev', e.id, 'Sukelti', 'chip pxch') : ''}</div>`; }).join('') + '</section>';
  }
  // ── sAKS kreivė per visą grandinę ──
  function curveSvg(sc) {
    const H = (sc.vh || []).filter(x => x[2] != null); if (H.length < 3) return '';
    const t0 = H[0][0], t1 = H[H.length - 1][0], W = 340, X = t => 34 + (t - t0) / Math.max(1, t1 - t0) * W, Y = s => 10 + (140 - Math.max(30, Math.min(140, s))) / 110 * 150;
    let g = `<rect x="34" y="${Y(70)}" width="${W}" height="${Y(30) - Y(70)}" fill="#3a1c1c"/>`;
    (sc.phs || []).forEach(p => {
      const a = Math.max(t0, p.t0), b = p.t1 != null ? Math.min(t1, p.t1) : t1; if (b <= a) return;
      if (p.ph === 'medevac') g += `<line x1="${X(a)}" y1="${Y(100)}" x2="${X(b)}" y2="${Y(100)}" stroke="#FAC775" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${X(a) + 3}" y="20" fill="#FAC775" font-size="10">MEDEVAC</text>`;
      if (p.ph === 'role1') g += `<rect x="${X(a)}" y="${Y(90)}" width="${X(b) - X(a)}" height="${Y(80) - Y(90)}" fill="#0C447C" opacity=".6"/><text x="${X(b) - 3}" y="20" fill="#9DC1E6" font-size="10" text-anchor="end">Role 1</text>`;
    });
    const pts = H.map(x => X(x[0]).toFixed(1) + ',' + Y(x[2]).toFixed(1)).join(' ');
    const lo = H.reduce((m, x) => x[2] < m[2] ? x : m, H[0]);
    return `<svg viewBox="0 0 380 180" class="pxcurve" role="img" aria-label="Sistolinis AKS per scenarijų">${g}<polyline points="${pts}" fill="none" stroke="#F1EFE8" stroke-width="2" stroke-linejoin="round"/>` +
      [[100, '100'], [80, '80'], [70, '70']].map(([s, l]) => `<text x="30" y="${Y(s) + 3}" fill="#B4B2A9" font-size="10" text-anchor="end">${l}</text>`).join('') +
      `<text x="${X(lo[0])}" y="${Math.min(172, Y(lo[2]) + 12)}" fill="#ff9a9a" font-size="10" text-anchor="middle">${lo[2]} (${T(lo[0])})</text><text x="34" y="176" fill="#B4B2A9" font-size="10">${T(t0)}</text><text x="374" y="176" fill="#B4B2A9" font-size="10" text-anchor="end">${T(t1)}</text></svg>`;
  }
  function evalHtml(P) {
    const sc = P.sc; if (!sc.scen) return '';
    const ST = { ok: ['✓', 'ok'], late: ['~', 'amb'], bad: ['✕', 'bad'], wait: ['…', ''] };
    return (sc.phs || []).filter(p => p.ph === 'medevac' || p.ph === 'role1').map(p => {
      const L = PSCEN.evaluate(sc, p.ph, P.simt), kc = L.filter(x => x.c === 'K'), ko = kc.filter(x => x.st === 'ok').length;
      return `<section class="pnl"><h2>${p.ph === 'medevac' ? 'MEDEVAC (MARCH)' : 'Role 1 (ETC)'}${p.pre ? ' <small class="tag pxtag">atkartota</small>' : ''}</h2><p class="muted mt0">Kritiniai laiku ${ko} / ${kc.length} · langai – juodraštis, tvirtina instruktoriai</p><div class="pxev2">` +
        L.map(x => `<div class="${ST[x.st][1]}"><b>${ST[x.st][0]}</b><span>${E(x.n)}<small>${x.c === 'K' ? 'kritinis' : x.c === 'S' ? 'svarbus' : 'pageidautinas'}${x.win ? ' · ' + E(x.win) : ''}</small></span><i>${E(x.txt)}</i></div>`).join('') + '</div></section>';
    }).join('');
  }

  function runningHtml(P) {
    const sc = P.sc, R = [];
    sc.inf.forEach(f => { const done = Math.max(0, Math.min(f.tot, P.simt - f.t0)), left = f.tot - done; R.push(`<div class="pxrun"><span>🩸 <b>${E(f.n)}</b> <small>${left > 0 ? 'liko ' + T(left) : 'sulašėjo'}</small></span><i class="pfb2"><i style="width:${Math.round(done / Math.max(1, f.tot) * 100)}%"></i></i>${left > 0 ? btn('istop', f.cmp, 'Stabdyti', 'chip pxch') : ''}</div>`); });
    if (sc.o2) R.push(`<div class="pxrun"><span>O₂ <b>${E(sc.o2.n)} ${sc.o2.flow} l/min</b> <small>nuo ${T(sc.o2.t)}</small></span>${btn('tx', 'o2off', 'Nuimti', 'chip pxch')}</div>`);
    sc.inj.filter(j => j.tq0 != null && j.state !== 'pdress').forEach(j => { const d = P.simt - j.tq0, loose = j.tqOn == null; R.push(`<div class="pxrun${d > 7200 || loose ? ' warn' : ''}"><span>⏱ <b>Turniketas – ${E((PCAT.locBy(j.loc) || [0, ''])[1].toLowerCase())}</b> <small>${T(d)} nuo pirmo uždėjimo${loose ? ' · ATSILEIDĘS' : j.tqOn > j.tq0 + 1 ? ' · vėl užveržtas ' + T(j.tqOn) : ''}</small></span></div>`); });
    if (sc.kit && sc.set === 'medevac') R.push(`<div class="pxrun"><span>Kraujo atsargos: <b>${Math.max(0, sc.kit.max - Math.ceil(sc.kit.used))} / ${sc.kit.max} vnt.</b></span></div>`);
    return R.length ? '<section class="pnl"><h2>Vykdoma</h2>' + R.join('') + '</section>' : '';
  }
  function actBtn(P, j, a, by) {
    const ok = !a[3] || sup(P, a[3]), ap = LOCAL ? '' : PCAT.apx('act:' + a[0]), pl = pend(P, a[1] + ' – ' + PCAT.injName(j).name);
    return `<button class="pxa${a[4] === 'instr' ? ' ins' : ''}${ap ? ' isapx' : ''}${pl != null ? ' pend' : ''}" data-act="px" data-k="card" data-x="${j.id}|${a[0]}"${by ? ` data-by="${by}"` : ''}${ok && pl == null ? '' : ' disabled'}${ap ? ` title="${E(ap)}"` : ''}><b>${E(a[1])}${ap ? '<span class="apx">≈</span>' : ''}</b>${pl != null ? pendS(pl) : (a[5] ? `<small>⏱ ${E(a[5])}</small>` : '') + (ap ? '<small class="apxs">Pulse neturi – apytiksliai</small>' : '') + (ok ? '' : '<small>nepalaikoma</small>')}</button>`;
  }
  function cardHtml(P, j) {
    const n = PCAT.injName(j), A = PCAT.cardActions(j, P.sc.set), bad = PCAT.BAD.indexOf(j.state) >= 0, ico = (PCAT.injBy(j.k) || {}).ico || '';
    const team = A.filter(a => a[4] === 'team'), ins = A.filter(a => a[4] === 'instr' && a[0] !== 'sevup' && a[0] !== 'sevdn'), sev = A.some(a => a[0] === 'sevup');
    const ab = a => actBtn(P, j, a);
    return `<div class="pxcd${bad ? ' bad' : ''}"><div class="pxcdh"><span class="pxcdn">${ico} <b>${E(n.name)}</b>${n.sev ? ` <small>${E(n.sev)}</small>` : ''}${apxB('inj:' + j.k, 1)}</span>` +
      (sev ? `<span class="pxsev">${btn('card', j.id + '|sevdn', '−', 'pxi', ' aria-label="Silpninti"')}${btn('card', j.id + '|sevup', '＋', 'pxi', ' aria-label="Stiprinti"')}</span>` : '') + '</div>' +
      `<div class="pxst ${bad ? 'bad' : 'ok'}">${bad ? '● ' : '✓ '}${E(PCAT.STATES[j.state] || j.state)} <small>· ${j.h.length ? E(j.h[j.h.length - 1][1]) + ' ' + T(j.h[j.h.length - 1][0]) : ''}</small></div>` +
      (team.length ? '<div class="pxacts">' + team.map(ab).join('') + '</div>' : '') +
      (ins.length ? '<div class="pxacts">' + ins.map(ab).join('') + '</div>' : '') + '</div>';
  }
  function ptHtml(P) {
    const sc = P.sc;
    let h = runningHtml(P);
    const order = j => ['bleed', 'aw', 'ptx', 'optx', 'htx', 'tam', 'tbi', 'burn', 'bronch', 'pain'].indexOf(j.k);   // pastovi tvarka (mygtukai nešokinėja)
    h += '<section class="pnl"><h2>Sužalojimai</h2>' + (sc.inj.length ? sc.inj.slice().sort((a, b) => order(a) - order(b)).map(j => cardHtml(P, j)).join('') : '<p class="muted">Sužalojimų nėra.</p>') + btn('sh-inj', 'live', '＋ Naujas sužalojimas', 'pxb wide ins') + '</section>';
    h += '<section class="pnl"><h2>Apžiūros radiniai <span class="apx">≈</span></h2><p class="apxt mt0">Pulse šių radinių neskaičiuoja – programėlė juos apytiksliai išveda iš rodiklių ir sužalojimų.</p><div class="pxf">' + findings(P).map(f => `<div class="${f[2] ? 'bad' : ''}"><small>${E(f[0])}</small><b>${E(f[1])}</b></div>`).join('') + '</div>' +
      (P.v && P.v.bv && sc.bv0 ? `<p class="muted">Kraujo tūris ${P.v.bv} ml (netekta apie ${Math.max(0, Math.round((sc.bv0 - P.v.bv) / 50) * 50)} ml)</p>` : '') + '</section>';
    return h;
  }
  function txHtml(P, by, q) {
    const G = PCAT.txFor(P.sc.set);
    let h = '';
    G.forEach(([L, n, items0]) => {
      const items = q ? items0.filter(it => (it[1] + ' ' + n).toLowerCase().indexOf(q) >= 0) : items0;
      if (!items.length) return;
      h += `<section class="pnl" id="pxg-${L}"><h2>${E(L.replace('A2', 'AB').replace('Mon', '♥'))} · ${E(n)}</h2>`;
      items.forEach(it => {
        const ok = it[0] !== 'o2' || sup(P, [{ k: 'o2' }]), pl = it[2] ? null : pend(P, it[1]);
        const dr = it[2] && it[2].indexOf('drug:') === 0 && it[2] !== 'drug:abx' ? PCAT.drugBy(it[2].slice(5), P.sc.set) : null, log = !LOCAL && (it[4] === 'log' || it[4] === 'rsi' || it[2] === 'drug:abx' || (dr && !dr.pulse));
        h += `<button class="pxrow${pl != null ? ' pend' : ''}" data-act="px" data-k="tx" data-x="${it[0]}"${by ? ` data-by="${by}"` : ''}${ok && pl == null ? '' : ' disabled'}><span><b>${E(it[1])}</b>${pl != null ? pendS(pl) : it[3] ? `<small>⏱ ${E(it[3])}</small>` : ''}</span><i>${log ? logB : ''}${it[2] ? ' ›' : ''}</i></button>`;
      });
      h += '</section>';
    });
    return h;
  }
  function evHtml(P) {
    // grupės antraštėmis (ne kiekvienoje kortelėje); sustojimas – laikyti 1,5 s; ROSC – paprastas paspaudimas
    const L = PCAT.EVENTS.filter(e => !e[3] || e[3] === P.sc.set), arr = ['vf', 'asys'], G = [], apE = { painup: 'inj:pain' };
    L.filter(e => arr.indexOf(e[0]) < 0 && e[0] !== 'rosc').forEach(e => { if (G.indexOf(e[2]) < 0) G.push(e[2]); });
    const eb = e => { const pl = pend(P, e[1]), ap = !LOCAL && apE[e[0]] && PCAT.apx(apE[e[0]]); return `<button class="pxe${pl != null ? ' pend' : ''}" data-act="px" data-k="ev" data-x="${e[0]}"${pl != null ? ' disabled' : ''}><b>${E(e[1])}${ap ? '<span class="apx">≈</span>' : ''}</b>${pl != null ? pendS(pl) : ap ? '<small class="apxs">Pulse neturi – apytiksliai</small>' : ''}</button>`; };
    return '<section class="pnl"><h2>Įvykiai <small class="tag pxtag">sukelia instruktorius</small></h2>' + G.map(g => `<p class="lbl pxlb">${E(g[0].toUpperCase() + g.slice(1))}</p><div class="pxev">` + L.filter(e => e[2] === g && arr.indexOf(e[0]) < 0 && e[0] !== 'rosc').map(eb).join('') + '</div>').join('') + '</section>' +
      '<section class="pnl"><h2>Širdies sustojimas</h2><p class="muted mt0">Sustojimą sukelti – laikykite paspaudę 1,5 s.</p><div class="pxev">' + L.filter(e => arr.indexOf(e[0]) >= 0).map(e => `<button class="pxe red" data-act="px" data-k="ev" data-x="${e[0]}" data-hold="1"><b>${E(e[1])}</b><small>laikykite 1,5 s</small></button>`).join('') +
      L.filter(e => e[0] === 'rosc').map(e => { const pl = pend(P, e[1]); return `<button class="pxe grn" data-act="px" data-k="ev" data-x="rosc"${pl != null ? ' disabled' : ''}><b>${E(e[1])}</b>${pl != null ? pendS(pl) : ''}</button>`; }).join('') + '</div></section>';
  }
  // ── ataskaita ──
  function metrics(P) {
    const sc = P.sc, t0 = sc.ff || 0, M = [];
    const d = (t, goal) => t == null ? '<b class="bad">neatlikta</b>' : `<b class="${goal && t - t0 > goal ? 'bad' : 'ok'}">${T(Math.max(0, t - t0))}</b>`;
    sc.inj.forEach(j => {
      const nm = PCAT.injName(j).name;
      if (j.k === 'bleed') { const g = (PCAT.locBy(j.loc) || [0, 0, 'limb'])[2]; if (g !== 'torso') M.push([nm + ' – kontrolė', d(j.ctl, g === 'limb' ? 60 : 180), g === 'limb' ? 'tikslas ≤ 1 min' : 'tikslas ≤ 3 min']); }
      if (j.k === 'ptx' || j.k === 'optx') M.push([nm + ' – dekompresija / tvarstis', d(j.ctl, 300), 'tikslas ≤ 5 min']);
      if (j.k === 'aw') M.push([nm + ' – atverta / užtikrinta', d(j.ctl, 120), 'tikslas ≤ 2 min']);
    });
    if (sc.inj.some(j => (j.k === 'bleed' && j.sev >= 0.45) || j.k === 'htx')) {
      M.push(['Pirmas kraujo vienetas', d(sc.tBlood, 900), 'tikslas ≤ 15 min']);
      const lim = sc.set === 'role1' ? 5400 : 10800;
      M.push(['TXA', sc.tTxa == null ? '<b class="bad">neskirta</b>' : `<b class="${sc.tTxa > lim ? 'bad' : 'ok'}">${T(sc.tTxa)} nuo sužeidimo</b>`, sc.set === 'role1' ? 'geriausia per 90 min' : 'ne vėliau 3 val.']);
    }
    if (sc.min && sc.min.sys < 900) M.push(['Mažiausias sAKS', `<b class="${sc.min.sys < 80 ? 'bad' : 'ok'}">${Math.round(sc.min.sys)} mm Hg</b>`, '']);
    if (sc.min) M.push(['Mažiausias SpO₂', `<b class="${sc.min.spo2 < 90 ? 'bad' : 'ok'}">${Math.round(sc.min.spo2)} %</b>`, '']);
    return M;
  }
  function mist(P) {
    const sc = P.sc, v = P.v || {}, F = findings(P);
    const tx = []; sc.log.filter(l => (l.kind || 'tx') === 'tx' && !l.star && !/^Naujas sužalojimas|komentaras|Atšaukta|Sustabdyta|Jau /.test(l.n)).forEach(l => { const k = l.n.split(' (')[0]; if (tx.indexOf(k) < 0) tx.push(k); });
    sc.inj.filter(j => j.tq0 != null).forEach(j => tx.push('TQ ' + (PCAT.locBy(j.loc) || [0, ''])[1].toLowerCase() + ' uždėtas prieš ' + Math.round((P.simt - j.tq0) / 60) + ' min'));
    const pat = sc.pat || {}, r1 = sc.set === 'role1';
    const need = []; if (sc.inj.some(j => (j.k === 'bleed' && (PCAT.locBy(j.loc) || [0, 0, ''])[2] === 'torso') || j.k === 'htx' || j.k === 'tam')) need.push('chirurgas'); if (sc.inj.some(j => j.k === 'bleed' || j.k === 'htx')) need.push('kraujas'); if (sc.inj.some(j => j.k === 'tbi' && j.sev >= 0.55)) need.push('neurochirurgija / KT'); if (sc.inj.some(j => j.k === 'aw' && j.state !== 'secured')) need.push('kvėpavimo takų užtikrinimas');
    return (r1 ? 'ATMISTER perdavimas (pagal ETC)' : 'MIST perdavimas (pagal MARCH)') + '\n' +
      (r1 ? `A – ${pat.age ? pat.age + ' m.' : 'amžius nežinomas'}${pat.kg ? ', ' + pat.kg + ' kg' : ''}${pat.allergy ? ', alergija: ' + pat.allergy : ''}\nT – sužeistas prieš ${Math.round(P.simt / 60)} min\n` : '') +
      `M – ${sc.mechN || 'nenurodyta'}\n` +
      `I – ${sc.inj.map(j => PCAT.injName(j).name.toLowerCase() + ' (' + (PCAT.STATES[j.state] || j.state).toLowerCase() + ')').join('; ') || 'nėra'}\n` +
      `S – ŠSD ${v.hr != null ? v.hr : '?'}, AKS ${v.sys != null ? v.sys + '/' + v.dia : '?'}, KD ${v.rr != null ? v.rr : '?'}, SpO₂ ${v.spo2 != null ? v.spo2 + ' %' : '?'}, AVPU ${F[1][1].split(' –')[0]}\n` +
      `T – ${tx.join('; ') || 'nesuteikta'}` + (r1 ? `\nE – atvykimas (laikas pagal situaciją)\nR – reikia: ${need.join(', ') || 'stebėjimo'}` : '');
  }
  function repHtml(P) {
    const sc = P.sc;
    const cv = curveSvg(sc);
    let h = (cv ? '<section class="pnl"><h2>sAKS per visą scenarijų</h2>' + cv + '<p class="muted">Geltona brūkšninė – MEDEVAC tikslas ~100; mėlyna juosta – Role 1 tikslas 80–90; raudona – &lt; 70.</p></section>' : '') + evalHtml(P) + handSum(sc) + '<section class="pnl"><h2>Pagrindiniai laikai <small class="tag pxtag">nuo komandos atvykimo</small></h2><div class="pxm">' + metrics(P).map(m => `<div><span>${E(m[0])}</span>${m[1]}<small>${E(m[2])}</small></div>`).join('') + '</div></section>';
    const txt = mist(P);
    h += `<section class="pnl"><h2>Perdavimas – etalonas aptarimui</h2><pre class="pxpre">${E(txt)}</pre>${btn('copy', null, 'Kopijuoti ataskaitą', 'pxb wide')}</section>`;
    const items = sc.log.map(l => ({ t: l.t, n: l.n, c: l.star ? 'star' : l.by === 'team' ? 'team' : 'ins' })).concat((P.cm || []).map(c => ({ t: c.t, n: '⚠ ' + c.title, c: 'cm' }))).sort((a, b) => a.t - b.t);
    h += '<section class="pnl"><h2>Eiga</h2><div class="pxtl">' + items.map(i => `<div class="${i.c}"><small>${T(i.t)}</small><span>${E(i.n)}</span></div>`).join('') + '</div><p class="muted">Rodiklių grafikas – skiltyje „Žurnalas“. Mėlyna – komanda, pilka – instruktorius, ★ – žymės.</p></section>';
    return h;
  }
  function handSum(sc) {
    const H = sc.hand || {}; if (!H.mist && !H.atm) return '';
    const f = (k, n, tot) => H[k] ? `<div><span>${n}</span><b class="${Object.values(H[k].m).filter(x => x === 1).length === tot ? 'ok' : 'bad'}">${Object.values(H[k].m).filter(x => x === 1).length} / ${tot}</b><small>pažymėta ${T(H[k].t)}</small></div>` : '';
    return '<section class="pnl"><h2>Perdavimai</h2><div class="pxm">' + f('mist', 'MIST (MEDEVAC → Role 1)', 4) + f('atm', 'ATMISTER (Role 1 → Role 2)', 8) + '</div></section>';
  }
  // ── apatinis meniu ir atšaukimas ──
  function railHtml(P) {
    return '<div class="pxrail" aria-label="MARCH-PAWS skyriai">' + PCAT.txFor(P.sc.set).map(g => btn('rail', g[0], g[0].replace('A2', 'AB').replace('Mon', '♥'), 'pxl', ` aria-label="${E(g[1])}"`)).join('') + '</div>';
  }
  function navHtml(P) {
    const r1 = P && P.sc && P.sc.set === 'role1';
    const V = [['pt', 'Būklė'], ['all', 'Veiksmai'], ['ev', 'Įvykiai'], ['hand', r1 ? 'ATMISTER' : 'MIST'], ['rep', 'Ataskaita']];
    return '<nav class="pxnav n5">' + V.map(v => `<button class="${view === v[0] || (v[0] === 'hand' && view === 'recv') ? 'on' : ''}" data-act="px" data-k="view" data-x="${v[0]}">${v[1]}</button>`).join('') + '</nav>';
  }
  function undoHtml(P) {
    const q = (P.q || []).slice(-1)[0]; if (!q) return '';
    return `<div class="pxsnack"><span><small>Bus atlikta po ${q.left} s${P.q.length > 1 ? ' · laukia dar ' + (P.q.length - 1) : ''}</small><b>${E(q.n)}</b></span>${btn('undo', q.uid, 'Atšaukti', 'pxb')}</div>`;
  }
  // laukimas: jungiamasi prie serverio / ruošiamas modelis – aiški būsena su laiku ir atšaukimu
  // sent – PRADĖTI išsiųstas, laukiama, kol monitorius patvirtins (scenarijaus nonce momentinėje nuotraukoje)
  let waitT = 0, sent = null, late = '';
  const SENT_S = 15;
  function waitHtml(P) {
    if (!waitT) waitT = (sent && sent.at) || Date.now();
    const sec = Math.round((Date.now() - waitT) / 1000), mon = !P || !P.sc, conn = P && P.st === 'conn', re = !mon && P.sc.on;
    const now = mon ? 0 : conn ? 1 : 2;
    const steps = re ? [['Ryšys su Pulse serveriu nutrūko', true], ['Monitorius jungiasi iš naujo' + (sec > 10 ? ' – serveris gali būti persikrovęs (iki 1–2 min.)' : ''), !conn], ['Sesija atkuriama', false]]
      : P && P.local ? [[mon ? 'Komanda siunčiama monitoriui – laukiama atsakymo' : 'Monitorius gavo komandą', !mon], ['Paleidžiamas taisyklių modelis', now > 1], ['Ruošiama priešistorė' + (P.sc && P.sc.scen && P.sc.scen.mode === 'role1' ? ' ir MEDEVAC dalis' : ''), false]]
      : [[mon ? 'Komanda siunčiama monitoriui – laukiama atsakymo' : 'Monitorius gavo komandą', !mon], ['Monitorius jungiasi prie Pulse serverio' + (conn && sec > 10 ? ' – serveris pabunda (iki 1–2 min.)' : ''), now > 1], ['Pulse ruošia paciento modelį' + (P && P.ff ? ' ir prasuka laiką' : ''), false]];
    return '<section class="pnl pxwait"><h2>' + (re ? (P.local ? 'Atkuriamas modelis' : 'Atkuriamas ryšys su Pulse') : 'Pradedama') + '</h2><div class="pxspin" aria-hidden="true"></div>' +
      '<ol class="pxsteps">' + steps.map((s0, i) => `<li class="${s0[1] ? 'done' : i === now ? 'now' : ''}">${s0[1] ? '✓ ' : ''}${E(s0[0])}</li>`).join('') + '</ol>' +
      `<p><b>${E(mon ? '' : P.msg || '')}</b></p><p class="muted">Laukiama ${sec} s.${sec > 150 ? ' Ilgai – patikrinkite internetą monitoriaus telefone ir Pulse serverį (Nustatymai → Pulse serveris → Tikrinti ryšį).' : ''}</p>` +
      (re ? btn('stop0', 'rep', 'Baigti scenarijų (ataskaita)', 'pxb wide') : btn('stop0', null, 'Atšaukti', 'pxb wide')) + '</section>';
  }
  function render(P, local, mver) {
    lastP = P; LOCAL = P && P.engSet ? P.engSet !== 'pulse' : SU.eng !== 'pulse';
    let pre = '';
    const cur = typeof VER !== 'undefined' ? VER : '';
    // mver: null – monitoriaus nuotraukos dar nėra; '' – monitorius siunčia nuotrauką be versijos (sena programėlė)
    if (!local && mver != null && (mver !== cur || !P || (P.st === 'run' && !P.sc))) pre += `<div class="mira p1 pxwarn">⚠ Monitoriaus telefone kita programėlės versija (${E(mver || 'sena')}, čia ${E(cur)}). Atnaujinkite monitoriaus telefoną: uždarykite ir vėl atidarykite SIM (gali reikėti 2 kartų).</div>`;
    if (!local && mver == null) pre += '<div class="mira p2 pxwarn">Nėra ryšio su monitoriumi – prisijunkite (monitoriaus QR kodas arba kambario kodas), tada spauskite PRADĖTI.</div>';
    // PRADĖTI išsiųstas: laukti monitoriaus patvirtinimo; sena versija nonce neatsiunčia – priimama, jei ji pati pradėjo
    if (sent) {
      if (P && P.sc && (P.sc.nonce === sent.n || (P.sc.nonce == null && RUN.concat(['dead', 'err']).indexOf(P.st) >= 0))) sent = null;
      else if (Date.now() - sent.at > SENT_S * 1000) { sent = null; waitT = 0; late = 'Monitorius per ' + SENT_S + ' s nesureagavo į komandą PRADĖTI. Tikriausiai monitoriaus telefone sena SIM versija arba nutrūko ryšys – atnaujinkite monitoriaus telefoną (uždarykite ir vėl atidarykite SIM) ir bandykite dar kartą.'; }
      else return pre + waitHtml(P && P.sc && P.sc.nonce === sent.n ? P : null);
    }
    if (P && P.sc && (P.st === 'load' || P.st === 'conn')) return pre + headHtml(P) + waitHtml(P);
    waitT = 0;
    if (late && P && P.sc && RUN.concat(['dead']).indexOf(P.st) >= 0) late = '';   // monitorius vis dėlto pradėjo
    if (late) pre += `<div class="mira p1 pxwarn">⚠ ${E(late)}</div>`;
    if (P && P.st === 'err' && P.msg) pre += `<div class="mira p1 pxwarn">✕ ${E(P.msg)}</div>`;
    if (P && P.st === 'off' && P.sc && P.sc.lost) pre += `<div class="mira p1 pxwarn">⚠ ${E(P.msg || 'Pulse sesija prarasta – pradėkite iš naujo.')}</div>`;
    const live = P && P.sc && (RUN.indexOf(P.st) >= 0 || P.st === 'dead');
    if (!live) return pre + (P && P.sc && P.sc.end != null && view === 'rep' ? headHtml(P) + repHtml(P) + btn('view', 'pt', '＋ Naujas scenarijus', 'pxgo') : setupHtml(P, local));
    const sc = P.sc, nk = sc.nonce || '';
    if (sc.ph === 'role1' && sc.r1t0 != null && seenR1 !== nk + sc.r1t0) { seenR1 = nk + sc.r1t0; LSs('sim-pu-r1', seenR1); view = 'recv'; }
    if (view === 'tx') view = 'all';
    const body = view === 'all' ? allHtml(P) : view === 'ev' ? scenEvHtml(P) + evHtml(P) : view === 'rep' ? repHtml(P) : view === 'hand' ? handHtml(P) : view === 'recv' && sc.set === 'role1' ? recvHtml(P) : statusHtml(P);
    return pre + '<div class="pxw">' + headHtml(P) + body + '<div class="pxbot">' + undoHtml(P) + (view === 'all' ? railHtml(P) : '') + navHtml(P) + '</div></div>';
  }

  // ── apatiniai lapai ──
  function sheetEl() { let el = document.getElementById('pxs'); if (!el) { el = document.createElement('div'); el.id = 'pxs'; document.body.appendChild(el); } return el; }
  function openSheet(kind, data) { sheet = Object.assign({ kind }, data || {}); drawSheet(); }
  function closeSheet() { sheet = null; const el = document.getElementById('pxs'); if (el) el.innerHTML = ''; }
  function drawSheet() {
    if (!sheet) return closeSheet();
    const P = lastP || {}, set = (P.sc && P.sc.set) || SU.set;
    let title = '', body = '', foot = '';
    const seg = (k, opts, cur) => '<div class="pxseg">' + opts.map(o => `<button class="pxsg${cur == o[0] ? ' on' : ''}" data-act="px" data-k="${k}" data-x="${E(o[0])}"${o[2] ? ' disabled' : ''}><b>${E(o[1])}</b>${o[3] ? `<small>${E(o[3])}</small>` : ''}</button>`).join('') + '</div>';
    if (sheet.kind === 'inj') {
      title = sheet.k ? (PCAT.injBy(sheet.k) || {}).n : 'Naujas sužalojimas';
      if (!sheet.k) body = '<div class="pxgrid">' + PCAT.INJ.map(t => { const ok = !t.sup || !P.sup || P.sup.indexOf(t.sup) >= 0; return `<button class="pxe" data-act="px" data-k="si-k" data-x="${t.k}"${ok ? '' : ' disabled'}><b>${t.ico} ${E(t.n)}${apxB('inj:' + t.k)}</b>${ok ? (PCAT.apx('inj:' + t.k) ? '<small class="apxs">≈ Pulse neturi – apytiksliai</small>' : '') : '<small>nepalaikoma</small>'}</button>`; }).join('') + '</div>';
      else {
        const t = PCAT.injBy(sheet.k);
        body += apxB('inj:' + sheet.k, 1);
        body += '<p class="lbl pxlb">Sunkumas</p>' + seg('si-sev', (t.sevs || PCAT.SEV).map(s => [s[2], s[1]]), sheet.sev);
        if (t.pick.indexOf('side') >= 0) body += '<p class="lbl pxlb">Pusė</p>' + seg('si-side', PCAT.SIDES, sheet.side);
        if (t.pick.indexOf('loc') >= 0) {
          const grp = [['limb', 'Galūnės – galima turniketas'], ['junc', 'Jungtinės vietos – turniketas netinka'], ['torso', 'Liemuo – nesuspaudžiamas'], ['soft', 'Kita']];
          const avail = l => !P.hemc || !P.hemc.length || P.hemc.indexOf(PCAT.cmpOf(l)) >= 0;
          body += grp.map(g => `<p class="lbl pxlb">${g[1]}</p><div class="pxgrid">` + PCAT.LOCS.filter(l => l[2] === g[0] && avail(l[0])).map(l => `<button class="pxsg${sheet.loc === l[0] ? ' on' : ''}" data-act="px" data-k="si-loc" data-x="${l[0]}"><b>${E(l[1])}</b></button>`).join('') + '</div>').join('');
        }
        const ready = sheet.sev != null && (t.pick.indexOf('loc') < 0 || sheet.loc) && (t.pick.indexOf('side') < 0 || sheet.side);
        const miss = [sheet.sev == null ? 'sunkumą' : '', t.pick.indexOf('side') >= 0 && !sheet.side ? 'pusę' : '', t.pick.indexOf('loc') >= 0 && !sheet.loc ? 'vietą' : ''].filter(Boolean);
        foot = btn('si-back', null, '‹ Atgal', 'pxb') + btn('si-ok', null, ready ? (sheet.mode === 'setup' ? 'Pridėti' : 'Sukelti dabar') : 'Pasirinkite ' + miss.join(', '), 'pxgo sm', ready ? '' : ' disabled');
      }
    } else if (sheet.kind === 'pat') {
      title = 'Pacientas';
      body = '<p class="lbl pxlb">Fiziologinis profilis (Pulse)</p><div class="pxgrid">' + PCAT.PATIENTS.map(p => `<button class="pxsg${SU.pat.state === p[0] ? ' on' : ''}" data-act="px" data-k="sp-st" data-x="${p[0]}"><b>${E(p[1])}</b><small>${E(p[2])}</small></button>`).join('') + '</div>' +
        `<label class="rl">Vardas / šaukinys<input class="inp" id="sp-name" value="${E(SU.pat.name)}" autocomplete="off"></label>` +
        `<div class="pxtwo"><label class="rl">Amžius<input class="inp" id="sp-age" inputmode="numeric" value="${E(SU.pat.age)}"></label><label class="rl">Svoris, kg<input class="inp" id="sp-kg" inputmode="numeric" value="${E(SU.pat.kg)}"></label></div>` +
        `<label class="rl">Alergijos<input class="inp" id="sp-al" value="${E(SU.pat.allergy)}" autocomplete="off" placeholder="nėra"></label><p class="muted">Svoris naudojamas dozėms mg/kg; profilis lemia kraujo tūrį ir fiziologiją.</p>`;
      foot = btn('sp-ok', null, 'Išsaugoti', 'pxgo sm');
    } else if (sheet.kind === 'o2') {
      title = 'Deguonis';
      const D = PCAT.O2DEV.find(d => d[0] === sheet.dev) || PCAT.O2DEV[0];
      body = seg('so-dev', PCAT.O2DEV.map(d => [d[0], d[1], 0, d[2][0] + '–' + d[2][d[2].length - 1] + ' l/min']), D[0]) +
        '<p class="lbl pxlb">Srautas, l/min</p><div class="pxseg n8">' + [1, 2, 4, 6, 8, 10, 12, 15].map(f => `<button class="pxsg${sheet.flow === f ? ' on' : ''}${D[2].indexOf(f) < 0 ? ' dim' : ''}" data-act="px" data-k="so-fl" data-x="${f}"><b>${f}</b></button>`).join('') + '</div>' +
        '<p class="muted">Pilki skaičiai – ne šio prietaiso srautas.</p>' + (P.sc && P.sc.o2 ? `<p class="muted">Dabar: ${E(P.sc.o2.n)} ${P.sc.o2.flow} l/min</p>` : '');
      foot = btn('so-ok', null, 'Atlikti', 'pxgo sm', sheet.flow ? '' : ' disabled');
    } else if (sheet.kind === 'fluid') {
      title = 'Kraujas / skysčiai';
      const comp = P.comp || [];
      body = '<div class="pxgrid">' + PCAT.FLUIDS.map(f => { const has = !comp.length || comp.indexOf(f[0]) >= 0, alt = !LOCAL && !!PCAT.apx('fl:' + f[0]); return `<button class="pxsg${sheet.cmp === f[0] ? ' on' : ''}" data-act="px" data-k="sf-c" data-x="${f[0]}"${has || alt ? '' : ' disabled'}><b>${E(f[1])}${alt ? '<span class="apx">≈</span>' : ''}</b>${alt ? '<small class="apxs">Pulse neturi – lašinamas NaCl</small>' : !has ? '<small>Pulse neturi – neprieinama</small>' : ''}</button>`; }).join('') + '</div>' +
        '<p class="lbl pxlb">Tūris</p>' + seg('sf-v', PCAT.VOLS.map(v => [v, v + ' ml']), sheet.ml) +
        '<p class="lbl pxlb">Greitis</p>' + seg('sf-r', PCAT.RATES.map(r => [r[0], r[1]]), sheet.rate).replace('class="pxseg"', 'class="pxseg wrap"') +
        (P.sc && P.sc.set === 'medevac' && /Blood|PackedRBC|Plasma/.test(sheet.cmp || '') ? `<p class="muted">Kraujo atsargos: ${Math.max(0, P.sc.kit.max - Math.ceil(P.sc.kit.used))} / ${P.sc.kit.max} vnt.</p>` : '');
      foot = btn('sf-ok', null, 'Pradėti lašinti', 'pxgo sm', sheet.cmp && sheet.ml && sheet.rate ? '' : ' disabled');
    } else if (sheet.kind === 'drug') {
      const L = PCAT.drugsFor(set).filter(d => !sheet.grp || d.g === sheet.grp);
      if (!sheet.id) {
        title = sheet.grp || 'Vaistai';
        const G = []; L.forEach(d => { if (G.indexOf(d.g) < 0) G.push(d.g); });
        body = G.map(g => `<p class="lbl pxlb">${E(g)}</p><div class="pxgrid">` + L.filter(d => d.g === g).map(d => `<button class="pxsg" data-act="px" data-k="sd-id" data-x="${d.id}"><b>${E(d.n)}</b>${LOCAL ? '' : !d.pulse || PCAT.apx('drug:' + d.id) ? `<small class="apxs"><span class="apx">≈</span> ${d.pulse ? 'apytiksliai' : d.lo ? 'tik žurnale' : 'Pulse neturi – tik žurnale'}</small>` : '<small>Pulse skaičiuoja</small>'}</button>`).join('') + '</div>').join('') + `<p class="muted">Pagal ${E(PCAT.SETTINGS[set].src)} gidą.</p>`;
      } else {
        const D = PCAT.drugBy(sheet.id, set), kg = +((P.sc && P.sc.pat && P.sc.pat.kg) || SU.pat.kg || 80);
        title = D.n;
        const opts = [];
        D.r.forEach(r => r[1].forEach(v => opts.push({ route: r[0], dose: v, unit: r[2], l: num(v) + ' ' + r[2] + ' ' + r[0] })));
        D.kg.forEach(k => { let v = k[1] * kg, u = 'mg'; if (v < 1) { v = Math.round(v * 1000); u = 'mcg'; } else v = Math.round(v * 10) / 10; if (k[1] >= 100) { v = Math.round(k[1] * kg / 100) / 10; u = 'g'; } opts.push({ route: k[0], dose: v, unit: u, l: num(v) + ' ' + u + ' ' + k[0], s: k[2] + ' × ' + kg + ' kg' }); });
        body = (D.pulse && !LOCAL ? apxB('drug:' + D.id, 1) : '') + '<div class="pxgrid">' + opts.map((o, i) => { const ap = !LOCAL && D.pulse && PCAT.apx('route:' + o.route); return `<button class="pxsg${sheet.oi === i ? ' on' : ''}" data-act="px" data-k="sd-o" data-x="${i}"><b>${ap ? '<span class="apx">≈</span> ' : ''}${E(o.l)}</b>${o.s ? `<small>${E(o.s)}</small>` : ''}${ap ? `<small class="apxs">≈ ${E(ap)}</small>` : ''}</button>`; }).join('') + '</div>' +
          (D.note ? `<p class="muted">${E(D.note)}</p>` : '') + (D.pulse || LOCAL ? '' : D.lo ? '<p class="apxt"><span class="apx">≈</span> Modelyje tik žurnale (žr. pastabą).</p>' : '<p class="apxt"><span class="apx">≈</span> Pulse šio vaisto neturi – modelis nereaguoja, veiksmas žymimas tik žurnale.</p>');
        sheet.opts = opts;
        foot = (sheet.fixed ? '' : btn('sd-back', null, '‹ Atgal', 'pxb')) + btn('sd-ok', null, 'Suleista', 'pxgo sm', sheet.oi != null ? '' : ' disabled');
      }
    } else if (sheet.kind === 'team') {
      title = 'Gydymas (komanda)';
      body = P.sc ? '<p class="muted mt0">Pažymėkite, ką atlikote – įvyks po 5 s (atšaukti – juostoje). <span class="apx">≈</span> – modelis tai skaičiuoja apytiksliai arba tik žymi žurnale.</p>' + P.sc.inj.map(j => { const A = PCAT.cardActions(j, P.sc.set).filter(a => a[4] === 'team'); return A.length ? `<p class="lbl pxlb">${E(PCAT.injName(j).name)} · ${E(PCAT.STATES[j.state] || '')}</p><div class="pxacts">` + A.map(a => actBtn(P, j, a, 'team')).join('') + '</div>' : ''; }).join('') + txHtml(P, 'team') : '<p class="muted">Pulse scenarijus nevyksta.</p>';
    }
    sheetEl().innerHTML = `<div class="pxs-bg" data-act="px" data-k="sh-x"></div><div class="pxs" role="dialog" aria-label="${E(title)}"><div class="pxs-h"><b>${E(title)}</b><button class="ib" data-act="px" data-k="sh-x" aria-label="Uždaryti">✕</button></div><div class="pxs-b">${body}</div>${foot ? '<div class="pxs-f">' + foot + '</div>' : ''}</div>`;
  }

  // ── paspaudimai: grąžina komandą monitoriui (arba null) ──
  const vib = () => { try { navigator.vibrate && navigator.vibrate(20); } catch (e) {} };
  function startCmd() {
    const c = PULSE.cfg(), m = mechBy(SU.mech);
    const o = { c: 'pulse', op: 'start', eng: SU.eng === 'pulse' ? 'pulse' : 'local', nonce: sent ? sent.n : '', url: c.url, token: c.token, ff: SU.ff, sc: { set: SU.set, pat: SU.pat, mech: m[0], mechN: m[1], inj: SU.inj } };
    if (SU.scen && PSCEN.get(SU.scen)) o.scen = { id: SU.scen, mode: SU.mode, out: SU.out, auto: !!SU.auto, team2: SU.mode === 'chain' && !!SU.team2 };
    return o;
  }
  function txAct(x, by, C) {
    const P = lastP || {}, it = PCAT.TX.flatMap(g => g[2]).find(i => i[0] === x); if (!it) return null;
    if (it[2] === 'o2') { openSheet('o2', { dev: P.sc && P.sc.o2 ? P.sc.o2.dev : 'NonRebreatherMask', flow: P.sc && P.sc.o2 ? P.sc.o2.flow : 0, by }); return null; }
    if (it[2] === 'fluid') { openSheet('fluid', { cmp: (P.comp || []).indexOf('Blood') >= 0 || !P.comp ? 'Blood' : 'Saline', ml: P.sc && P.sc.set === 'medevac' ? 500 : 500, rate: 'pb', by }); return null; }
    if (it[2] === 'drug') { openSheet('drug', { by }); return null; }
    if (it[2] === 'drug:abx') { openSheet('drug', { grp: 'Antibiotikai', by }); return null; }
    if (it[2] && it[2].indexOf('drug:') === 0) { openSheet('drug', { id: it[2].slice(5), fixed: 1, by }); return null; }
    closeSheetIfTeam();
    return C({ op: 'tx', code: x, n: it[1] });
  }
  function click(el) {
    const k = el.dataset.k, x = el.dataset.x, by = el.dataset.by || (sheet && sheet.kind === 'team' ? 'team' : 'instr'), P = lastP || {};
    const C = o => { vib(); return Object.assign({ c: 'pulse', by }, o); };
    switch (k) {
      // pasiruošimas
      case 'su-set': SU.set = x; saveSU(); rerender(); return null;
      case 'su-scen': SU.scen = x; saveSU(); rerender(); return null;
      case 'su-mode': SU.mode = x; saveSU(); rerender(); return null;
      case 'su-out': SU.out = x; saveSU(); rerender(); return null;
      case 'su-auto': SU.auto = !SU.auto; saveSU(); rerender(); return null;
      case 'su-team2': SU.team2 = !SU.team2; saveSU(); rerender(); return null;
      case 'su-eng': SU.eng = x; LOCAL = x !== 'pulse'; saveSU(); if (x === 'pulse') PULSE.wake(() => rerender()); rerender(); return null;
      case 'wake': PULSE.wake(() => rerender()); rerender(); return null;
      case 'adv': {
        const a = ADV[+x]; if (!a || !a.act) return null; const A = a.act;
        if (A.k === 'card') { const [iid, ac] = A.x.split('|'); return C({ op: 'card', iid, a: ac }); }
        if (A.k === 'tx') return txAct(A.x, by, C);
        if (A.k === 'drug') { openSheet('drug', { id: A.id, fixed: 1, by }); return null; }
        if (A.k === 'view') { view = A.x; LSs('sim-pu-view', view); rerender(); scrollTop(); }
        return null;
      }
      case 'hm': { const sc = P.sc; if (!sc) return null; const kind = sc.set === 'role1' ? 'atm' : 'mist', key = (sc.nonce || '') + kind, [k, val] = x.split('|'); const M = HM[key] = HM[key] || {}; M[k] = M[k] === +val ? null : +val; Object.keys(HM).filter(z => z !== key && z.indexOf(sc.nonce || '#') !== 0).forEach(z => delete HM[z]); LSs('sim-pu-hm', HM); rerender(); return C({ op: 'hand', kind, m: M }); }
      case 'ho': HO[x] = HO[x] ? 0 : 1; LSs('sim-pu-ho', HO); rerender(); return null;
      case 'torole1': view = 'recv'; LSs('sim-pu-view', view); return C({ op: 'phase', to: 'role1', skip: HO.skip ? 180 : 0, reprobe: !!HO.reprobe, team2: !!HO.team2 });
      case 'recvok': view = 'pt'; LSs('sim-pu-view', view); rerender(); scrollTop(); return null;
      case 'sev': return C({ op: 'sev', id: x });
      case 'auto': return C({ op: 'auto', on: x === '1' });
      case 'su-mech': SU.mech = x; SU.inj = mechBy(x)[3].map(j => Object.assign({}, j)); saveSU(); rerender(); return null;
      case 'su-del': SU.inj.splice(+x, 1); saveSU(); rerender(); return null;
      case 'su-ff': SU.ff = +x; saveSU(); rerender(); return null;
      case 'start': view = 'pt'; LSs('sim-pu-view', view); cmOpen = false; late = ''; sent = { at: Date.now(), n: Math.random().toString(36).slice(2, 8) }; return C(startCmd());
      case 'resume': return C({ op: 'resume' });
      case 'stop0': waitT = 0; sent = null; if (x === 'rep') { view = 'rep'; LSs('sim-pu-view', view); } return C({ op: 'stop' });
      case 'view': view = x; LSs('sim-pu-view', view); rerender(); scrollTop(); return null;
      // eiga
      case 'pause': return C({ op: 'pause', on: x === '1' });
      case 'speed': { const L = [1, 2, 5]; return C({ op: 'speed', x: L[(L.indexOf(+x) + 1) % L.length] }); }
      case 'skip': return C({ op: 'skip', s: +x });
      case 'mark': toast2('★ Pažymėta aptarimui'); return C({ op: 'mark', x: 'Žymė aptarimui' });
      case 'stop': view = 'rep'; LSs('sim-pu-view', view); return C({ op: 'stop' });
      case 'cm': cmOpen = !cmOpen; rerender(); return null;
      case 'rail': { const s = document.getElementById('pxg-' + x); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); return null; }
      case 'card': { const [iid, a] = x.split('|'); closeSheetIfTeam(); return C({ op: 'card', iid, a }); }
      case 'ev': { if (x === 'newbleed') { openSheet('inj', { mode: 'live', k: 'bleed' }); return null; } if (x === 'newinj') { openSheet('inj', { mode: 'live' }); return null; } return C({ op: 'ev', code: x }); }
      case 'istop': return C({ op: 'istop', cmp: x });
      case 'undo': return C({ op: 'undo', uid: x });
      case 'team': lastP = PULSE.status(); openSheet('team'); vib(); return null;
      case 'copy': { try { navigator.clipboard.writeText(mist(P) + '\n\n' + metrics(P).map(m => m[0] + ': ' + m[1].replace(/<[^>]+>/g, '')).join('\n')); toast2('Nukopijuota'); } catch (e) { toast2('Nepavyko nukopijuoti'); } return null; }
      case 'tx': return txAct(x, by, C);
      // lapai
      case 'sh-x': closeSheet(); return null;
      case 'sh-inj': openSheet('inj', { mode: x }); return null;
      case 'sh-pat': openSheet('pat'); return null;
      case 'si-k': sheet.k = x; sheet.sev = null; sheet.loc = null; sheet.side = null; drawSheet(); return null;
      case 'si-loc': sheet.loc = x; drawSheet(); return null;
      case 'si-side': sheet.side = x; drawSheet(); return null;
      case 'si-sev': sheet.sev = +x; drawSheet(); return null;
      case 'si-back': sheet.k = null; drawSheet(); return null;
      case 'si-ok': { const j = { k: sheet.k, sev: sheet.sev }; if (sheet.loc) j.loc = sheet.loc; if (sheet.side) j.side = sheet.side; const mode = sheet.mode; closeSheet(); if (mode === 'setup') { SU.inj.push(j); saveSU(); rerender(); return null; } return C({ op: 'inj', j }); }
      case 'sp-st': SU.pat.state = x; drawSheetKeep(); return null;
      case 'sp-ok': { const v = id => (document.getElementById(id) || {}).value || ''; SU.pat.name = v('sp-name').trim(); SU.pat.age = Math.max(0, Math.min(99, parseInt(v('sp-age'), 10) || 0)); SU.pat.kg = Math.max(30, Math.min(200, parseInt(v('sp-kg'), 10) || 80)); SU.pat.allergy = v('sp-al').trim(); saveSU(); closeSheet(); rerender(); return null; }
      case 'so-dev': { sheet.dev = x; const D = PCAT.O2DEV.find(d => d[0] === x); if (D && D[2].indexOf(sheet.flow) < 0) sheet.flow = D[2][Math.min(1, D[2].length - 1)]; drawSheet(); return null; }
      case 'so-fl': sheet.flow = +x; drawSheet(); return null;
      case 'so-ok': { const o = { op: 'tx', code: 'o2', p: { dev: sheet.dev, flow: sheet.flow }, n: 'Deguonis ' + sheet.flow + ' l/min', by: sheet.by || by }; closeSheet(); vib(); return Object.assign({ c: 'pulse' }, o); }
      case 'sf-c': sheet.cmp = x; drawSheet(); return null;
      case 'sf-v': sheet.ml = +x; drawSheet(); return null;
      case 'sf-r': sheet.rate = x; drawSheet(); return null;
      case 'sf-ok': { const R = PCAT.RATES.find(r => r[0] === sheet.rate), rate = R[2] || Math.round(sheet.ml / +R[0]), F = PCAT.FLUIDS.find(f => f[0] === sheet.cmp); const o = { op: 'tx', code: 'fluid', p: { cmp: sheet.cmp, ml: sheet.ml, rate }, n: F[1] + ' ' + sheet.ml + ' ml', by: sheet.by || by }; closeSheet(); vib(); return Object.assign({ c: 'pulse' }, o); }
      case 'sd-id': sheet.id = x; sheet.oi = null; drawSheet(); return null;
      case 'sd-back': sheet.id = null; drawSheet(); return null;
      case 'sd-o': sheet.oi = +x; drawSheet(); return null;
      case 'sd-ok': { const o = sheet.opts[sheet.oi], D = PCAT.drugBy(sheet.id, (P.sc && P.sc.set) || SU.set); const c = { op: 'tx', code: 'drug', p: { id: sheet.id, route: o.route, dose: o.dose, unit: o.unit }, n: D.n + ' ' + o.l, by: sheet.by || by }; closeSheet(); vib(); return Object.assign({ c: 'pulse' }, c); }
    }
    return null;
  }
  function closeSheetIfTeam() { if (sheet && sheet.kind === 'team') closeSheet(); }
  function drawSheetKeep() { const v = id => { const e = document.getElementById(id); return e ? e.value : null; }; const keep = { n: v('sp-name'), a: v('sp-age'), k: v('sp-kg'), l: v('sp-al') }; drawSheet(); const set = (id, x) => { const e = document.getElementById(id); if (e && x != null) e.value = x; }; set('sp-name', keep.n); set('sp-age', keep.a); set('sp-kg', keep.k); set('sp-al', keep.l); }
  function scrollTop() { try { const d = document.getElementById('dbd'); if (d && document.querySelector('#drawer.on')) d.scrollTop = 0; else scrollTo(0, 0); } catch (e) {} }
  function toast2(t) { if (typeof toast === 'function') toast(t); }

  // ── laikymas patvirtinimui (Baigti, širdies sustojimas) ──
  let holdT = null, holdEl = null, sendFn = null, holdDone = 0;
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('[data-hold="1"]'); if (!el || el.disabled) return;
    holdEl = el; el.classList.add('holding');
    holdT = setTimeout(() => { holdT = null; holdDone = Date.now(); const o = click(el); el.classList.remove('holding'); holdEl = null; if (o && sendFn) sendFn(o); }, 1500);
  }, { passive: true });
  const holdEnd = () => { if (holdT) { clearTimeout(holdT); holdT = null; } if (holdEl) { holdEl.classList.remove('holding'); holdEl = null; } };
  document.addEventListener('pointerup', holdEnd, { passive: true });
  document.addEventListener('pointercancel', holdEnd, { passive: true });
  // paspaudimas (iš app.js): laikomiems mygtukams – tik užuomina
  function onClick(el, send) {
    sendFn = send;
    if (el.dataset.hold === '1') { if (Date.now() - holdDone > 1500) toast2('Laikykite paspaudę 1,5 s'); return; }
    const o = click(el);
    if (o && send(o) === false && o.op === 'start') { sent = null; rerender(); }   // komanda neišsiųsta (nėra ryšio) – nelaukti
  }

  // paieška „Visi veiksmai“ – filtruojama vietoje (be perpiešimo, kol rašoma)
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'pxq') return;
    Q = e.target.value; const q = Q.trim().toLowerCase(), root = e.target.closest('.pxw') || document;
    root.querySelectorAll('.pxcd,.pxrow,.pxoff span').forEach(el => { el.style.display = !q || el.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; });
    root.querySelectorAll('section.pnl').forEach(sec => { const it = sec.querySelectorAll('.pxcd,.pxrow'); if (it.length) sec.style.display = !q || [...it].some(i => i.style.display !== 'none') ? '' : 'none'; });
  });
  // ── monitoriaus gydymo juosta ──
  function strip(P) {
    if (!P || !P.sc || !(RUN.indexOf(P.st) >= 0 || P.st === 'dead')) return '';
    const sc = P.sc, C = [];
    sc.inf.forEach(f => { const done = Math.max(0, Math.min(f.tot, P.simt - f.t0)), left = f.tot - done; C.push(`<span class="pxsc"><i style="width:${Math.round(done / Math.max(1, f.tot) * 100)}%"></i>🩸 ${E(f.n.replace('Pilnas kraujas', 'Kraujas'))} · ${left > 0 ? T(left) : '✓'}</span>`); });
    if (sc.o2) C.push(`<span class="pxsc">O₂ ${sc.o2.flow} l/min</span>`);
    sc.inj.filter(j => j.tq0 != null && j.state !== 'pdress').forEach(j => C.push(`<span class="pxsc${P.simt - j.tq0 > 7200 || j.tqOn == null ? ' warn' : ''}">TQ ${T(P.simt - j.tq0)}${j.tqOn == null ? ' atsileidęs' : ''}</span>`));
    const q = (P.q || []).slice(-1)[0];
    if (q) C.push(`<span class="pxsc und" data-act="px" data-k="undo" data-x="${q.uid}">⏳ ${E(q.n)} · ${q.left} s ✕</span>`);
    C.push('<span class="pxsc add" data-act="px" data-k="team" role="button" aria-label="Pažymėti gydymą">＋ Gydymas</span>');
    return C.join('');
  }
  // ilgas paspaudimas ant juostos – komandos meniu
  let stripT = null;
  document.addEventListener('pointerdown', e => { const s = e.target.closest && e.target.closest('#pustrip'); if (!s || (e.target.closest('[data-k="undo"]'))) return; stripT = setTimeout(() => { stripT = null; lastP = PULSE.status(); openSheet('team'); vib(); }, 550); }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { if (stripT) { clearTimeout(stripT); stripT = null; } }, { passive: true }));
  function refreshSheet(P) { if (sheet && sheet.kind === 'team' && P) { lastP = P; const b = document.querySelector('#pxs .pxs-b'), y = b ? b.scrollTop : 0; drawSheet(); const b2 = document.querySelector('#pxs .pxs-b'); if (b2) b2.scrollTop = y; } }
  // Pulse serverio nustatymai (Nustatymai → Pulse serveris)
  function settingsHtml() {
    const c = PULSE.cfg();
    return `<label class="rl">Serverio adresas<input class="inp" id="pu-url" placeholder="${E(PULSE.DEF_URL)}" value="${E(c.url)}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url"></label>` +
      `<label class="rl">Žetonas (token)<input class="inp" id="pu-tok" value="${E(c.token)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>` +
      `<div class="acts"><button class="btn" data-act="pu-save">Išsaugoti</button><button class="btn" data-act="pu-test">Tikrinti ryšį</button></div><p class="muted" id="pu-res"></p>` +
      '<p class="muted">Adresas įrašytas iš anksto (Azure serveris). Žetoną užtenka įvesti vieną kartą kiekviename telefone arba atidaryti nuorodą iš diegimo skripto.</p>';
  }
  return { render, settingsHtml, onClick, strip, refreshSheet, set rerender(f) { rerender = f; }, get sheetOpen() { return !!sheet; }, findings, mist, metrics, _SU: () => SU };
})();
