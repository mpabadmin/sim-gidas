'use strict';
// ───────── Pulse pultas: pasiruošimas (aplinka → scenarijus → pradėti), eiga (Pacientas · Gydymas · Įvykiai · Ataskaita),
// apatiniai lapai parametrams, atšaukimas, laikymas patvirtinimui, monitoriaus gydymo juosta ir komandos meniu ─────────
const PUI = (() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  const T = s => PULSE.mmss(s);
  const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const num = x => String(x).replace('.', ',');
  // paieška: be diakritikų, žodžio pradžia, trumpinant galūnes (kalcis → kalci…), sinonimai
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/₂/g, '2');
  const SYN = { o2: 'deguonis', deguonis: 'o2', kpr: 'gaivinimas paspaudimai', cpr: 'kpr', tq: 'turniketas', ndc: 'adatine dekompresija', txa: 'traneksamo', abx: 'antibiotikas' };
  function match(text, q) {
    const W = norm(text).split(/[^a-z0-9]+/).filter(Boolean);
    return norm(q).split(/\s+/).filter(Boolean).every(t => { const st = t.length >= 6 ? t.slice(0, -2) : t.length >= 5 ? t.slice(0, -1) : t; const alt = SYN[t] ? norm(SYN[t]).split(' ') : []; return W.some(w => w.indexOf(st) === 0) || alt.some(a => W.some(w => w.indexOf(a) === 0)); });
  }
  const RUN = ['run', 'pause', 'load', 'conn'];
  // pasiruošimo juodraštis (instruktoriaus telefone)
  let SU = Object.assign({ set: 'medevac', mech: 'gswt', inj: null, pat: { state: 'Soldier@0s.json', name: '', age: 25, kg: 80, allergy: '', sex: 'M' }, ff: 0, scen: '', eng: 'local', step: 1 }, LS('sim-pu-su', {}));
  SU.scen = ''; if (!SU.pat.sex) SU.pat.sex = 'M'; if (['manual', 'local', 'pulse'].indexOf(SU.eng) < 0) SU.eng = 'local';
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
    ['R', 'L'].forEach(sd => {
      const J = sc.inj.filter(j => (j.k === 'ptx' || j.k === 'optx' || j.k === 'htx') && j.side === sd && j.state !== 'drained'); if (!J.length) return;
      const ten = J.some(j => j.k !== 'htx' && act(j)), htx = J.some(j => j.k === 'htx');
      chest.push((sd === 'R' ? 'dešinėje' : 'kairėje') + (ten ? ' nesigirdi' : ' susilpnėjęs') + (htx ? ', duslus perkusijoje' : ''));
    });
    if (aw && act(aw)) chest.push('stridoras / gargimas');
    if (br) chest.push('švokštimas');
    if (v.rr != null && v.rr < 8) chest.push('retas, paviršinis');
    F.push(['Kvėpavimas', chest.length ? chest.join('; ') : 'girdimas abipus, lygus', chest.length > 0]);
    const tension = sc.inj.some(j => (j.k === 'ptx' || j.k === 'optx') && act(j) && j.sev >= 0.5) || sc.inj.some(j => j.k === 'tam' && j.state !== 'drained');
    F.push(['Kaklo venos', tension && v.sys > 50 ? 'išsipūtusios' : 'neišsipūtusios', tension]);
    const burn = inj('burn')[0], shock = v.sys < 90 || (v.hr > 120 && v.sys < 100);
    F.push(['Oda', (v.spo2 != null && v.spo2 < 85 ? 'cianozė; ' : '') + (shock ? 'blyški, šalta, drėgna; KPL > 2 s' : 'šilta, rausva; KPL < 2 s') + (burn ? '; nudegimai ' + Math.round(burn.sev * 100) + ' %' : ''), shock]);
    if (sc.log && sc.log.some(l => l.code === 'efast')) {
      const E2 = [];
      ['R', 'L'].forEach(sd => { if (sc.inj.some(j => j.k === 'htx' && j.side === sd && j.state !== 'drained')) E2.push('skystis ' + (sd === 'R' ? 'dešinėje' : 'kairėje') + ' pleuroje'); if (sc.inj.some(j => (j.k === 'ptx' || j.k === 'optx') && j.side === sd && PCAT.BAD.indexOf(j.state) >= 0)) E2.push((sd === 'R' ? 'dešinėje' : 'kairėje') + ' nėra pleuros slydimo'); });
      E2.push(sc.inj.some(j => j.k === 'tam' && j.state !== 'drained') ? 'skystis perikarde' : 'perikardas – be skysčio');
      E2.push(sc.inj.some(j => j.k === 'bleed' && (PCAT.locBy(j.loc) || [])[2] === 'torso') ? 'laisvas skystis pilve' : 'pilvas – be skysčio');
      F.push(['e-FAST', E2.join('; '), E2.some(x => !/be skysčio/.test(x))]);
    }
    return F;
  }

  function prebrief() {
    const m = mechBy(SU.mech), S = PCAT.SETTINGS[SU.set];
    const I = SU.inj.map(j => PCAT.injName(j).name.toLowerCase()).join('; ') || 'nenustatyta';
    return `${S.n === 'MEDEVAC' ? 'Priimate sužeistąjį evakuacijai' : 'Į Role 1 punktą atvežamas sužeistasis'}${SU.ff ? ' praėjus ' + SU.ff / 60 + ' min nuo sužeidimo' : ''}. ` +
      `MIST: M – ${m[1]}; I – ${I}; S – matysite monitoriuje; T – ${SU.ff ? 'suteikta nebuvo (patikrinkite!)' : 'dar nesuteikta'}. ` +
      `Priemonės ir vaistai – pagal ${S.src} gidą${S.n === 'MEDEVAC' ? '; kraujo – ' + S.blood + ' vnt., deguonis – balionas' : ''}. Veiksmus, kurių modelis neskaičiuoja (pvz. TXA, antibiotikai), sakykite garsiai – jie žymimi žurnale.`;
  }

  // ── ikonos (linijinės, 24×24, spalva – currentColor) ──
  const ICP = {
    heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z|M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3',
    band: 'M18 6H6a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-4a4 4 0 0 0-4-4Z|M10 10h.01M14 14h.01M10 14h.01M14 10h.01',
    syr: 'm18 2 4 4|m17 7 3-3|M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5|m9 11 4 4|m5 19-3 3|m14 4 6 6',
    zap: 'M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6A1 1 0 0 0 13 10h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11 14z',
    clip: 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z|M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 12h6M9 16h6',
    wave: 'M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.4 8.3a.25.25 0 0 1-.5 0L9.2 2.2a.25.25 0 0 0-.5 0L6.4 10.5A2 2 0 0 1 4.5 12H2',
    drop: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z',
    wind: 'M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2|M9.6 4.6A2 2 0 1 1 11 8H2|M12.6 19.4A2 2 0 1 0 14 16H2',
    therm: 'M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z',
    stop: 'M6 6h12v12H6z', play: 'M7 4v16l13-8z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
    heli: 'M3 4h18|M12 4v4|M6 12a6 4 0 0 1 6-4h3a4 4 0 0 1 4 4v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z|M8 19h12|M10 15v4M16 15v4|M3 10l3 2',
    tent: 'M3 21h18|M5 21V9l7-6 7 6v12|M12 10v6M9 13h6',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2|M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    hand: 'M18 11V6a2 2 0 0 0-4 0|M14 10V4a2 2 0 0 0-4 0v2|M10 10.5V6a2 2 0 0 0-4 0v8|M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15',
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z|M12 18h.01',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z',
    lung: 'M6.1 4.5C4 4.5 2 8.6 2 13.5c0 3 1 5 3 5.5 2.4.6 4-1 4-4V7c0-1.5-1.5-2.5-2.9-2.5Z|M17.9 4.5C20 4.5 22 8.6 22 13.5c0 3-1 5-3 5.5-2.4.6-4-1-4-4V7c0-1.5 1.5-2.5 2.9-2.5Z|M12 3v7l-3 2M12 10l3 2',
    brain: 'M12 5a3 3 0 1 0-6 .1 4 4 0 0 0-2.5 5.8 4 4 0 0 0 .6 6.6A4 4 0 1 0 12 18Z|M12 5a3 3 0 1 1 6 .1 4 4 0 0 1 2.5 5.8 4 4 0 0 1-.6 6.6A4 4 0 1 1 12 18Z|M12 5v13',
    flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.4 1.6 1.4 2.7 2.5 2.7Z',
    mouth: 'M4 12a8 5 0 0 0 16 0|M4 12a8 3 0 0 1 16 0|M12 3v3M12 18v3',
    bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z', check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12',
    back: 'm15 18-6-6 6-6', next: 'm9 18 6-6-6-6', plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z|m21 21-4.3-4.3',
    clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z|M12 7v5l3 2', tq: 'M3 10h18v4H3z|M8 10V6h3v4|M12 14v4',
    pill: 'M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z|m8.5 8.5 7 7', bed: 'M2 4v16|M2 8h18a2 2 0 0 1 2 2v10|M2 17h20|M6 8v9', ok: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z|m8 12 3 3 5-6'
  };
  const ic = (k, cls) => `<svg class="pxic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${(ICP[k] || ICP.plus).split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
  const INJIC = { bleed: 'drop', ptx: 'lung', optx: 'lung', htx: 'lung', aw: 'mouth', tbi: 'brain', tam: 'heart', burn: 'flame', bronch: 'wind', pain: 'bolt' };
  const ENGN = { manual: ['hand', 'Rankinis', 'rodiklius keičiate patys'], local: ['phone', 'Telefono modelis ≈', 'automatiškai, be interneto'], pulse: ['cloud', 'Pulse simuliatorius', 'žmogaus fiziologijos modelis serveryje'] };

  // ── pasiruošimas: vedlys (vieta → pacientas → sužalojimai → dinamika) ──
  const pulseState = () => SU.pat.sex === 'F' ? 'StandardFemale@0s.json' : SU.pat.kg < 60 ? 'Underweight@0s.json' : SU.pat.kg > 100 ? 'Overweight@0s.json' : SU.pat.age <= 35 ? 'Soldier@0s.json' : 'StandardMale@0s.json';
  function preview() {
    try {
      const E0 = PLOCAL._fresh(SU.pat.kg || 80, 36.6, SU.pat.sex, SU.pat.age);
      SU.inj.forEach(j => { const a = PCAT.injAct(j); if (a) PLOCAL._apply(E0, a); });
      if (SU.ff) PLOCAL._advance(E0, SU.ff);
      return PLOCAL._vitals(E0);
    } catch (e) { return null; }
  }
  const SEVML = { l: 15, m: 40, s: 100, x: 250 };
  function wizardHtml(P, local) {
    const st = SU.step || 1, S = PCAT.SETTINGS;
    const steps = [['tent', 'Vieta'], ['user', 'Pacientas'], ['drop', 'Sužalojimai'], ['wave', 'Dinamika']];
    let h = '<div class="pxw pxwiz"><div class="pxsteps2">' + steps.map((x, i) => `<button class="${st === i + 1 ? 'on' : st > i + 1 ? 'done' : ''}" data-act="px" data-k="wz" data-x="${i + 1}">${ic(x[0])}<small>${x[1]}</small></button>`).join('') + '</div>';
    if (st === 1) {
      h += '<h2 class="pxq2">Kur vyksta?</h2><div class="pxbig2">' +
        [['medevac', 'heli', 'MEDEVAC', 'MARCH gidas · transportas'], ['role1', 'tent', 'Role 1', 'ETC gidas · medicinos punktas']].map(o => `<button class="pxbigc${SU.set === o[0] ? ' on' : ''}" data-act="px" data-k="wz-set" data-x="${o[0]}">${ic(o[1], 'xl')}<b>${o[2]}</b><small>${o[3]}</small></button>`).join('') + '</div>';
    } else if (st === 2) {
      const p = SU.pat;
      h += '<h2 class="pxq2">Pacientas</h2><div class="pxseg pxsex">' + [['M', '♂ Vyras'], ['F', '♀ Moteris']].map(o => `<button class="pxsg${p.sex === o[0] ? ' on' : ''}" data-act="px" data-k="wz-sex" data-x="${o[0]}"><b>${o[1]}</b></button>`).join('') + '</div>' +
        slider('age', 'Amžius', p.age, 18, 70, 1, ' m.') + slider('kg', 'Svoris', p.kg, 45, 130, 1, ' kg') +
        `<p class="muted pxc">${ic('drop')} Kraujo tūris ≈ <b id="sl-bv">${num(Math.round((p.sex === 'F' ? 65 : 70) * p.kg / 100) / 10)}</b> l</p>`;
    } else if (st === 3) {
      h += '<h2 class="pxq2">Sužalojimai</h2>' +
        `<button class="pxrow pxhealthy${!SU.inj.length ? ' on' : ''}" data-act="px" data-k="wz-healthy">${ic('ok')}<span><b>Sveikas</b><small>be sužalojimų – pridėsite eigos metu</small></span></button>` +
        '<div class="pxinjg">' + PCAT.INJ.map(t => `<button class="pxinjb" data-act="px" data-k="si-k0" data-x="${t.k}">${ic(INJIC[t.k] || 'plus')}<small>${E(t.n.replace(' / inhaliacinė trauma', '').replace('Kvėpavimo takų obstrukcija', 'Kvėpavimo takai').replace('Galvos smegenų trauma', 'Galvos trauma').replace('Įtampos pneumotoraksas', 'Įtampos PTX').replace('Atviras pneumotoraksas', 'Atviras PTX'))}</small></button>`).join('') + '</div>' +
        (SU.inj.length ? '<div class="pxinj">' + SU.inj.map((j, i) => { const n = PCAT.injName(j), sk = ((PCAT.injBy(j.k) || {}).sevs || PCAT.SEV).find(x => Math.abs(x[2] - j.sev) < 1e-6), ml = j.k === 'bleed' && sk ? SEVML[sk[0]] : null; return `<div class="pxij">${ic(INJIC[j.k] || 'plus')}<span>${E(n.name)}${n.sev ? ` <small>${E(n.sev)}${ml ? ' · ~' + ml + ' ml/min' : ''}</small>` : ''}</span><button class="pxx" data-act="px" data-k="su-del" data-x="${i}" aria-label="Pašalinti">${ic('x')}</button></div>`; }).join('') + '</div>' : '') +
        slider('ff', 'Laikas nuo sužeidimo', Math.round((SU.ff || 0) / 60), 0, 60, 1, ' min');
      const v = preview();
      if (v) h += `<div class="pxprev"><small>${ic('heart')} Pradiniai rodikliai (prognozė)</small><div><span>ŠSD <b>${v.hr}</b></span><span>AKS <b>${v.sys}/${v.dia}</b></span><span>SpO₂ <b>${v.spo2}</b></span><span>KD <b>${v.rr}</b></span><span>Netekta <b>${num(Math.round(v.lost / 100) / 10)} l</b></span></div></div>`;
    } else {
      h += '<h2 class="pxq2">Kaip keisis būklė?</h2><div class="pxengc">' + ['manual', 'local', 'pulse'].map(k => `<button class="pxbigc row${SU.eng === k ? ' on' : ''}" data-act="px" data-k="su-eng" data-x="${k}">${ic(ENGN[k][0], 'xl')}<span><b>${E(ENGN[k][1])}</b><small>${E(ENGN[k][2])}</small></span></button>`).join('') + '</div>';
      if (SU.eng === 'pulse') {
        const w = PULSE.wakeState();
        h += `<div class="pxwake">${w.st === 'ready' ? `<b class="ok">${ic('check')} Serveris pabudęs</b><small>budrus dar ${w.left} min</small>` : w.st === 'waking' ? `<b class="amb">${ic('clock')} Žadinama… ${w.sec} s</b><small>miegantis serveris pasileidžia per 1–2 min</small>` : w.st === 'err' ? `<b class="bad">${ic('x')} ${E(w.msg)}</b>` : `<button class="pxb pri" data-act="px" data-k="wake">${ic('cloud')} Pažadinti serverį</button>`}</div>` +
          '<p class="muted pxc"><span class="apx">≈</span> – Pulse tokios funkcijos neturi, programėlė prideda apytiksliai.</p>';
        const tokOk = local ? PULSE.cfg().token : (!P || (P.ptok != null ? P.ptok : P.tok !== false) || String(PULSE.cfg().token || '').trim());
        if (!tokOk) h += `<p class="mira p1">Nėra serverio žetono ${local ? 'šiame telefone' : 'nei šiame, nei monitoriaus telefone'} – Nustatymai → Pulse serveris.</p>`;
      } else if (SU.eng === 'manual') h += '<p class="muted pxc">Pradiniai rodikliai – pagal sužalojimus. Toliau juos keičiate skirtuke „Rodikliai“, o veiksmai ir vaistai žymimi žurnale ir ataskaitoje.</p>';
      else h += '<p class="muted pxc">Supaprastintas mokomasis modelis (≈): kraujo netekimas, pneumotoraksas, deguonis, vaistai, temperatūra.</p>';
      if (P && P.sc && P.sc.end != null) h += btn('view', 'rep', ic('clip') + ' Ankstesnio scenarijaus ataskaita', 'pxb wide');
    }
    const lbl = (SU.set === 'role1' ? 'Role 1' : 'MEDEVAC') + ' · ' + (SU.inj.length ? SU.inj.length + ' sužal.' : 'sveikas') + ' · ' + ENGN[SU.eng || 'local'][1].replace(' ≈', '');
    h += '<div class="pxbot pxbotsu pxwnav">' + (st > 1 ? btn('wz', st - 1, ic('back'), 'pxb pxwb', ' aria-label="Atgal"') : '<span></span>') +
      (st < 4 ? btn('wz', st + 1, 'Toliau ' + ic('next'), 'pxgo sm') : btn('start', null, ic('play') + ' PRADĖTI<small>' + E(lbl) + '</small>', 'pxgo sm pxstart')) + '</div></div>';
    return h;
  }
  function slider(k, lbl, v, min, max, step, u) {
    return `<label class="pxsll"><span>${lbl}</span><b id="sl-${k}">${v}${u}</b></label><input class="pxsl" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-su="${k}" data-u="${u}" aria-label="${lbl}">`;
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
  function chipsHtml(P, compact) {
    const sc = P.sc, C = [], t = P.simt;
    if (!sc || !sc.inj) return '';
    const live = RUN.indexOf(P.st) >= 0;
    sc.inj.filter(j => j.tq0 != null && j.state !== 'pdress').forEach(j => { const loose = j.tqOn == null; C.push(`<span class="pxchip ${loose ? 'bad' : 'amb'}">TQ ${E(j.lbl ? j.lbl.split(' ')[0].toLowerCase() : (PCAT.locBy(j.loc) || [0, ''])[1].split(' ')[0].toLowerCase())} ${Math.floor((t - j.tq0) / 60)} min${loose ? ' · atsileidęs' : ''}</span>`); });
    const txa = PSCEN.drugT(sc, 'txa'), bleeding = sc.inj.some(j => j.k === 'bleed' || j.k === 'htx');
    if (txa != null) C.push(`<span class="pxchip">TXA ✓ prieš ${Math.round((t - txa) / 60)} min</span>`);
    else if (bleeding && t < 10800) { const r1 = sc.set === 'role1' && t < 5400, lim = r1 ? 5400 : 10800; C.push(`<span class="pxchip amb">TXA liko ${Math.round((lim - t) / 60)} min (${r1 ? 'ETC ≤ 90 min' : '≤ 3 val.'})</span>`); }
    (sc.inf || []).forEach(f => { const left = f.tot - Math.max(0, t - f.t0); if (left > 0) C.push(`<span class="pxchip blu">${E(f.n.replace('Pilnas kraujas', 'Kraujas'))} · liko ${Math.ceil(left / 60)} min</span>`); });
    if (sc.kit) C.push(`<span class="pxchip">Kraujo liko ${Math.max(0, sc.kit.max - Math.ceil(sc.kit.used))}/${sc.kit.max}</span>`);
    if (sc.o2) C.push(`<span class="pxchip blu">O₂ ${sc.o2.flow} l/min</span>`);
    const bu = (sc.log || []).filter(l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || '')).length, ca = (sc.log || []).filter(l => l.code === 'drug' && l.id === 'ca').length;
    if (bu && !ca) C.push('<span class="pxchip bad">Kalcis – neskirtas</span>');
    if (live && !compact && sc.set === 'role1' && sc.r1t0 != null && t >= sc.r1t0) { const nx = 900 - ((t - sc.r1t0) % 900); C.push(`<span class="pxchip">Vertinimas po ${Math.ceil(nx / 60)}′</span>`); }
    const ne = live && !compact && nextEv(P); if (ne) C.push(`<span class="pxchip dim">Kitas įvykis: ${E(ne)}</span>`);
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
    ADV = P.st === 'dead' ? [] : PSCEN.advise(P).slice(0, 6);
    let h = '';
    const cm0 = (P.cm || []).filter(c => c.end == null).sort((a, b) => ((b.lvl === 'crit') - (a.lvl === 'crit')) || (a.t - b.t))[0];
    const cm = cm0 && cmClean(cm0, sc);
    const want = !cm ? null : cm.id === 'hypox' || cm.id === 'apnea' ? /^[RABO]/ : cm.id === 'cold' ? /^[HE]/ : /pneumotorak/i.test(cm.why[0] || '') ? /^[RB]/ : /^[MCc]/;
    const top = cm ? (ADV.find(a => (a.lvl === 'crit' || a.lvl === 'warn') && want.test(a.L)) || ADV.find(a => a.lvl === 'crit')) : ADV.find(a => a.lvl === 'crit');
    if (cm || (top && top.lvl === 'crit')) {
      const lvl = cm ? cm.lvl : 'crit';
      h += `<div class="pxalert ${lvl}"><b>${E(cm ? cm.title : top.n)}</b>` +
        `<span>${E(cm ? 'Kodėl: ' + (cm.why[0] || '') : top.why)}</span>` +
        (top ? `<button class="pxalertgo" data-act="px" data-k="adv" data-x="${ADV.indexOf(top)}">Atlikti: ${E(top.n)}</button>` : '') +
        (cm ? `<button class="pxalertmore" data-act="px" data-k="cm">${cmOpen ? 'Mažiau' : 'Daugiau – visos priežastys ir ką daryti'}</button>` : '') +
        (cm && cmOpen ? `<div class="pxcw"><p>Galimos priežastys:</p><ul>${cm.why.map(x => '<li>' + E(x) + '</li>').join('')}</ul>${cm.todo.length ? '<p>Ką daryti:</p><ul>' + cm.todo.map(x => '<li>' + E(x) + '</li>').join('') + '</ul>' : ''}<small>Užuomina pagal modelį ir pažymėtus veiksmus – ne diagnozė.</small></div>` : '') + '</div>';
    }
    if (sc.ph === 'handover' && sc.set === 'medevac') h += `<div class="pxalert hand"><b>${ic('heli')} Nusileidimas – MIST</b>${btn('xferask', null, ic('tent') + ' Perduoti į Role 1', 'pxalertgo')}</div>`;
    h += `<p class="pxlbl">${ic('bolt')} Dabar svarbiausia · ${sc.set === 'role1' ? 'ETC' : 'MARCH'}</p>`;
    const LL = sc.set === 'role1' ? { M: 'c', R: 'B', H: 'E', P: 'E' } : {};
    const shownTop = top && top.lvl === 'crit' ? top : null;
    h += ADV.length ? ADV.map((a, i) => a === shownTop ? '' : `<button class="pxadv ${a.lvl}" data-act="px" data-k="adv" data-x="${i}"><span class="pxL">${E(LL[a.L] || a.L)}</span><span class="pxadvt"><b>${E(a.n)}</b><small>${E(a.why)}</small></span><i>›</i></button>`).join('') : '<p class="muted">Skubių veiksmų pagal rodiklius nėra – stebėkite, vertinkite pakartotinai.</p>';
    h += '<div class="pxquick">' + btn('view', 'proc', ic('band') + ' Procedūros', 'pxb') + btn('view', 'med', ic('syr') + ' Vaistai', 'pxb') + '</div>';
    const done = (sc.log || []).filter(l => l.kind === 'tx' && !l.star && (!sc.r1t0 || sc.set !== 'role1' || l.t >= sc.r1t0)).slice(-6).reverse();
    if (done.length) h += '<p class="pxlbl">' + ic('check') + ' Atlikta</p><div class="pxdone">' + done.map(l => `<span><small>${T(l.t)}</small> ${E(l.n.split(' (')[0])}</span>`).join('') + '</div>';
    h += '<section class="pnl"><h2>Apžiūros radiniai' + (P.local ? '' : ' <span class="apx">≈</span>') + '</h2>' + (P.local ? '' : '<p class="apxt mt0">Pulse šių radinių neskaičiuoja – programėlė juos apytiksliai išveda iš rodiklių ir sužalojimų.</p>') + '<div class="pxf">' + findings(P).map(f => `<div class="${f[2] ? 'bad' : ''}"><small>${E(f[0])}</small><b>${E(f[1])}</b></div>`).join('') + '</div>' +
      htxLine(P) + '</section>';
    return h;
  }
  // komentaras be to, ko šioje fazėje nėra ar kas dar neturi būti žinoma (hemotoraksas MEDEVAC)
  function cmClean(cm, sc) {
    if (sc.set !== 'medevac') return cm;
    const hid = sc.inj.some(j => j.hideMist && j.state !== 'drained') && !(sc.log || []).some(l => l.code === 'efast');
    const why = cm.why.filter(x => !(hid && /Hemotoraks/.test(x))), todo = cm.todo.filter(x => !/drenas|Perikardiocentez/i.test(x) && !(sc.o2 && /^Deguon/i.test(x)));
    return Object.assign({}, cm, { why: why.length ? why : ['Aiškios priežasties nėra – vertinkite pagal MARCH.'], todo });
  }
  function htxLine(P) { const H = P.v && P.v.htx; if (!H) return ''; return Object.keys(H).filter(s => H[s].drained).map(s => `<p class="muted">Drenas ${s === 'R' ? 'dešinėje' : 'kairėje'}: išbėgo ${H[s].out} ml</p>`).join(''); }

  function headHtml(P) {
    const run = RUN.indexOf(P.st) >= 0, sp = P.speed || 1, sc = P.sc || {}, v = P.v || {}, r1 = sc.set === 'role1';
    const lost = v.lost != null ? v.lost : bleedLoss(P), en = P.manual ? 'manual' : P.local ? 'local' : 'pulse';
    let h = `<div class="pxh${view === 'pt' || P.st === 'off' ? '' : ' stk'}"><div class="pxh1">` +
      `<span class="pxclkw"><b class="pxclk">${T(P.simt)}</b><small class="pxst2 ${P.st}">${ic(r1 ? 'tent' : 'heli')} ${r1 ? 'Role 1' : sc.ph === 'handover' ? 'Perdavimas' : 'MEDEVAC'} · ${ic(ENGN[en][0])} ${P.st === 'off' && sc.end != null ? 'baigta' : P.st === 'run' ? { manual: 'Rankinis', local: 'Telefonas', pulse: 'Pulse' }[en] : stTxt[P.st] || P.st}</small></span>` +
      `<button class="pxi" data-act="pu-curves" aria-label="Kreivės (monitorius)">${ic('wave')}</button>` +
      (run || P.st === 'dead' ? `<button class="pxi pxstop" data-act="px" data-k="stopask" aria-label="Baigti scenarijų">${ic('stop')}</button>` : '') + '</div>';
    if (P.v) {
      const C = [['hr', 'ŠSD', v.hr, 1], ['sys', 'AKS', v.sys != null ? v.sys + '/' + v.dia : null, 2], ['spo2', 'SpO₂', v.spo2, 3], ['rr', 'KD', v.rr, 4], ['temp', 'T', v.temp != null ? num(v.temp) : null], ['lost', 'Netekta', P.manual ? '–' : lost ? num(Math.round(lost / 100) / 10) + ' l' : '0 l']];
      h += '<div class="pxvit">' + C.map(c => { const raw = c[0] === 'sys' ? v.sys : c[0] === 'lost' ? (P.manual ? null : lost) : v[c[0]], cl = vitCls(c[0], raw, r1), tr = c[3] ? trend(P, c[0], c[3]) : ''; return `<div class="${cl}"><small>${c[1]}</small><b>${c[2] == null ? '–' : E(c[2])}${tr}</b></div>`; }).join('') + '</div>';
    }
    h += chipsHtml(P, !(view === 'pt' || P.st === 'off'));
    if (run && view === 'pt') h += '<div class="pxh2">' + btn('speed', sp, '×' + sp, 'pxi', ' aria-label="Greitis: ×' + sp + ' (keisti)"') + btn('skip', 300, ic('next') + '5 min', 'chip pxch') + btn('skip', 900, ic('next') + '15 min', 'chip pxch') + btn('mark', null, '★', 'pxi', ' aria-label="Pažymėti aptarimui"') + (P.skip ? `<span class="muted">praleidžiama… ${T(P.skip)}</span>` : '') + (P.msg && P.st !== 'run' ? `<span class="muted">${E(P.msg)}</span>` : '') + '</div>';
    else if (P.msg && !run) h += `<div class="pxh2"><span class="muted">${E(P.msg)}</span></div>`;
    if (P.manual && run && view === 'pt') h += `<div class="pxh2"><button class="chip pxch" data-act="tab" data-k="ctl">${ic('hand')} Keisti rodiklius</button><span class="muted">rankinis režimas</span></div>`;
    if (P.eng && !P.pulse && !P.local) h += '<div class="pxh2"><span class="mira p1">Serveryje veikia testinis variklis, ne Pulse</span></div>';
    return h + '</div>';
  }
  // ── procedūros: tik tai, kas keičia būklę (sužalojimų kortelės + kvėpavimas, šiluma) ──
  function procHtml(P) {
    const sc = P.sc, set = sc.set, other = set === 'role1' ? 'medevac' : 'role1', q = Q.trim();
    let h = `<div class="pxqw">${ic('search')}<input class="inp pxq" id="pxq" type="search" placeholder="Paieška: dren, turnik, NDC…" autocomplete="off" aria-label="Paieška" value="${E(Q)}"></div>`;
    const order = j => ['bleed', 'aw', 'ptx', 'optx', 'htx', 'tam', 'tbi', 'burn', 'bronch', 'pain'].indexOf(j.k);
    const L = sc.inj.slice().sort((a, b) => order(a) - order(b)).filter(j => !q || match(PCAT.injName(j).name + ' ' + PCAT.cardActions(j, set).map(a => a[1]).join(' ') + ' ' + PCAT.cardActions(j, other).map(a => a[1]).join(' '), q));
    h += L.map(j => cardHtml(P, j).replace(/<\/div>$/, offCard(P, j, other) + '</div>')).join('');
    if (!sc.inj.length) h += '<p class="muted pxc">Sužalojimų nėra.</p>';
    h += btn('sh-inj', 'live', ic('plus') + ' Naujas sužalojimas', 'pxb wide ins');
    h += txHtml(P, null, q);
    return h;
  }
  // ── vaistai, kraujas ir skysčiai ──
  function medHtml(P, by) {
    const set = (P.sc && P.sc.set) || SU.set, q = Q.trim();
    let h = by ? '' : `<div class="pxqw">${ic('search')}<input class="inp pxq" id="pxq" type="search" placeholder="Paieška: ketam, TXA, kalc, plazm…" autocomplete="off" aria-label="Paieška" value="${E(Q)}"></div>`;
    const FL = PCAT.FLUIDS.filter(f => !q || match(f[1] + ' kraujas skysčiai', q));
    if (FL.length) h += `<p class="pxlbl">${ic('drop')} Kraujas ir skysčiai</p><div class="pxfl">` + FL.map(f => `<button class="pxflb${/Blood|PackedRBC|Plasma/.test(f[0]) ? ' red' : ''}" data-act="px" data-k="sf-open" data-x="${f[0]}"${by ? ` data-by="${by}"` : ''}>${ic('drop')}<b>${E(f[1].replace('Eritrocitų masė', 'Eritrocitai'))}</b></button>`).join('') + '</div>' +
      (P.sc && P.sc.kit ? `<p class="muted pxc">Kraujo liko ${Math.max(0, P.sc.kit.max - Math.ceil(P.sc.kit.used))} / ${P.sc.kit.max} vnt.</p>` : '');
    const DR = PCAT.drugsFor(set).filter(d => !q || match(d.n + ' ' + d.g, q)), G = [];
    DR.forEach(d => { if (G.indexOf(d.g) < 0) G.push(d.g); });
    h += G.map(g => `<p class="pxlbl">${ic('syr')} ${E(g)}</p><div class="pxdrg">` + DR.filter(d => d.g === g).map(d => `<button class="pxdrb" data-act="px" data-k="sd-open" data-x="${d.id}"${by ? ` data-by="${by}"` : ''}><b>${E(d.n.replace(' (traneksamo rūgštis)', '').replace(' 10 %', ''))}</b><small>${E(d.r.length ? d.r.map(r => r[1].map(num).join('/') + ' ' + r[2] + ' ' + r[0]).slice(0, 2).join(' · ') : d.kg.length ? d.kg[0][2] : '')}</small></button>`).join('') + '</div>').join('');
    if (!FL.length && !DR.length) h += '<p class="muted pxc">Nerasta.</p>';
    h += `<p class="muted pxc">Pagal ${E(PCAT.SETTINGS[set].src)} gidą.</p>`;
    return h;
  }
  function offCard(P, j, other) {
    const here = PCAT.cardActions(j, P.sc.set).map(a => a[0]), miss = PCAT.cardActions(j, other).filter(a => a[4] === 'team' && here.indexOf(a[0]) < 0);
    if (!miss.length) return '';
    return '<div class="pxoff">' + miss.map(a => `<span data-q="${E(a[1].toLowerCase())}">${E(a[1])} – tik ${other === 'role1' ? 'Role 1 (ETC)' : 'MEDEVAC'}</span>`).join('') + '</div>';
  }

  // ── perdavimas (MIST / ATMISTER) ──
  let HM = LS('sim-pu-hm', {}), HO = Object.assign({ skip: 1, reprobe: 1, team2: 1 }, LS('sim-pu-ho', {}));
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
    const ST = { ok: ['✓', 'ok'], late: ['~', 'amb'], bad: ['✕', 'bad'], wait: ['…', ''], na: ['–', 'na'] };
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
  function txHtml(P, by, q) {
    const G = PCAT.txFor(P.sc.set);
    let h = '';
    G.forEach(([L, n, items0]) => {
      const items = q ? items0.filter(it => match(it[1] + ' ' + n, q)) : items0;
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
  // ── įvykiai (instruktorius) ──
  const EVIC = { tqloose: 'tq', newbleed: 'drop', retens: 'lung', vomit: 'mouth', o2off: 'wind', ivout: 'syr', ecgoff: 'wave', spo2off: 'heart', nibpoff: 'heart', probeson: 'check', painup: 'bolt', newinj: 'plus', vib: 'zap', noise: 'zap', land: 'heli', evac: 'tent', vf: 'heart', asys: 'heart', rosc: 'heart' };
  function evHtml(P) {
    const sc = P.sc, L = PCAT.EVENTS.filter(e => !e[3] || e[3] === sc.set), arr = ['vf', 'asys', 'rosc'];
    const eb = e => { const pl = pend(P, e[1]); return `<button class="pxeb${pl != null ? ' pend' : ''}" data-act="px" data-k="ev" data-x="${e[0]}"${pl != null ? ' disabled' : ''}>${ic(EVIC[e[0]] || 'zap')}<b>${E(e[1].replace('…', ''))}</b>${pl != null ? `<small>⏳ ${pl} s</small>` : ''}</button>`; };
    let h = '';
    if (sc.set === 'medevac' && RUN.indexOf(P.st) >= 0) h += `<button class="pxbigc row xfer" data-act="px" data-k="xferask">${ic('tent', 'xl')}<span><b>Perduoti į Role 1</b><small>nusileidimas, MIST, toliau – ETC gidas</small></span></button>`;
    h += '<div class="pxevg">' + L.filter(e => arr.indexOf(e[0]) < 0 && e[0] !== 'land').map(eb).join('') + '</div>';
    h += `<p class="pxlbl">${ic('heart')} Širdies sustojimas</p><div class="pxevg">` + L.filter(e => arr.indexOf(e[0]) >= 0).map(e => `<button class="pxeb ${e[0] === 'rosc' ? 'grn' : 'red'}" data-act="px" data-k="${e[0] === 'rosc' ? 'ev' : 'arrask'}" data-x="${e[0]}">${ic('heart')}<b>${E(e[1])}</b></button>`).join('') + '</div>';
    return h;
  }
  function navHtml(P) {
    const V = [['pt', 'heart', 'Būklė'], ['proc', 'band', 'Procedūros'], ['med', 'syr', 'Vaistai'], ['ev', 'zap', 'Įvykiai'], ['rep', 'clip', 'Ataskaita']];
    return '<nav class="pxnav n5">' + V.map(v => `<button class="${view === v[0] ? 'on' : ''}" data-act="px" data-k="view" data-x="${v[0]}">${ic(v[1])}<span>${v[2]}</span></button>`).join('') + '</nav>';
  }

  // ── ataskaita ──
  function metrics(P) {
    const sc = P.sc, t0 = sc.phs && sc.phs.length ? sc.phs[0].t0 : sc.ff || 0, M = [];
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
    const hasM = (sc.phs || []).some(x => x.ph === 'medevac'), hasR = (sc.phs || []).some(x => x.ph === 'role1');
    let h = (cv ? '<section class="pnl"><h2>Sistolinis AKS per visą scenarijų</h2>' + cv + '<p class="muted">' + [hasM ? 'geltona brūkšninė – MEDEVAC tikslas ~100' : '', hasR ? 'mėlyna juosta – Role 1 tikslas 80–90' : '', 'raudona – &lt; 70'].filter(Boolean).join('; ') + '.</p></section>' : '') + evalHtml(P) + handSum(sc) + '<section class="pnl"><h2>Pagrindiniai laikai <small class="tag pxtag">nuo komandos atvykimo</small></h2><div class="pxm">' + metrics(P).map(m => `<div><span>${E(m[0])}</span>${m[1]}<small>${E(m[2])}</small></div>`).join('') + '</div></section>';
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
    if (!live) return pre + (P && P.sc && P.sc.end != null && view === 'rep' ? headHtml(P) + repHtml(P) + btn('newsc', null, ic('plus') + ' Naujas scenarijus', 'pxgo') : wizardHtml(P, local));
    const sc = P.sc, nk = sc.nonce || '';
    if (sc.ph === 'role1' && sc.r1t0 != null && seenR1 !== nk + sc.r1t0) { seenR1 = nk + sc.r1t0; LSs('sim-pu-r1', seenR1); view = 'recv'; }
    if (view === 'tx' || view === 'all') view = 'proc';
    if (view === 'hand') view = 'pt';
    const body = view === 'proc' ? procHtml(P) : view === 'med' ? medHtml(P) : view === 'ev' ? evHtml(P) : view === 'rep' ? repHtml(P) : view === 'recv' && sc.set === 'role1' ? recvHtml(P) : statusHtml(P);
    return pre + '<div class="pxw">' + headHtml(P) + body + '<div class="pxbot">' + undoHtml(P) + navHtml(P) + '</div></div>';
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
        body += '<p class="lbl pxlb">Sunkumas</p>' + seg('si-sev', (t.sevs || PCAT.SEV).map(s => [s[2], s[1], 0, sheet.k === 'bleed' && SEVML[s[0]] ? '~' + SEVML[s[0]] + ' ml/min' : '']), sheet.sev) + (sheet.k === 'bleed' ? '<p class="muted">Per 10 min: lengvas ~150 ml (rodikliai beveik nesikeičia), vidutinis ~400 ml, sunkus ~1 l (ŠSD ↑), masyvus ~2,5 l (šokas). Galūnėms; rankoms – mažiau.</p>' : '');
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
    } else if (sheet.kind === 'confirm') {
      const ar = sheet.what === 'arrest';
      title = ar ? (sheet.code === 'vf' ? 'Skilvelių virpėjimas' : 'Asistolija') : 'Baigti scenarijų?';
      body = `<p class="pxcf">${ic(ar ? 'heart' : 'stop', 'xl')}<span>${ar ? 'Sukelti širdies sustojimą dabar?' : 'Modeliavimas bus sustabdytas, atsidarys ataskaita.'}</span></p>`;
      foot = btn('sh-x', null, 'Atšaukti', 'pxb') + btn('cf-ok', null, ar ? 'Sukelti' : ic('stop') + ' Baigti', 'pxgo sm red');
    } else if (sheet.kind === 'xfer') {
      title = 'Perduoti į Role 1';
      body = [['skip', 'clock', 'Pervežimas +3 min'], ['reprobe', 'wave', 'Davikliai prijungiami iš naujo'], ['team2', 'user', 'Kita komanda']].map(o => `<button class="pxrow" data-act="px" data-k="xf-t" data-x="${o[0]}">${ic(o[1])}<span><b>${o[2]}</b></span><i>${sheet[o[0]] ? ic('check') : '–'}</i></button>`).join('') + '<p class="muted">Toliau – ETC gidas, kraujo bankas 6 vnt., tikslas sAKS 80–90.</p>';
      foot = btn('sh-x', null, 'Atšaukti', 'pxb') + btn('xf-ok', null, ic('tent') + ' Perduoti', 'pxgo sm');
    } else if (sheet.kind === 'team') {
      title = 'Gydymas (komanda)';
      body = P.sc ? '<p class="muted mt0">Pažymėkite, ką atlikote – įvyks po 5 s (atšaukti – juostoje). <span class="apx">≈</span> – modelis tai skaičiuoja apytiksliai arba tik žymi žurnale.</p>' + P.sc.inj.map(j => { const A = PCAT.cardActions(j, P.sc.set).filter(a => a[4] === 'team'); return A.length ? `<p class="lbl pxlb">${E(PCAT.injName(j).name)} · ${E(PCAT.STATES[j.state] || '')}</p><div class="pxacts">` + A.map(a => actBtn(P, j, a, 'team')).join('') + '</div>' : ''; }).join('') + txHtml(P, 'team') + medHtml(P, 'team') : '<p class="muted">Pulse scenarijus nevyksta.</p>';
    }
    sheetEl().innerHTML = `<div class="pxs-bg" data-act="px" data-k="sh-x"></div><div class="pxs" role="dialog" aria-label="${E(title)}"><div class="pxs-h"><b>${E(title)}</b><button class="ib" data-act="px" data-k="sh-x" aria-label="Uždaryti">✕</button></div><div class="pxs-b">${body}</div>${foot ? '<div class="pxs-f">' + foot + '</div>' : ''}</div>`;
  }

  // ── paspaudimai: grąžina komandą monitoriui (arba null) ──
  const vib = () => { try { navigator.vibrate && navigator.vibrate(20); } catch (e) {} };
  function startCmd() {
    const c = PULSE.cfg();
    SU.pat.state = pulseState();
    const mechN = SU.inj.length ? SU.inj.map(j => PCAT.injName(j).name.split(' – ')[0]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2).join(' + ') : 'Sveikas';
    return { c: 'pulse', op: 'start', eng: SU.eng, nonce: sent ? sent.n : '', url: c.url, token: c.token, ff: SU.ff, sc: { set: SU.set, pat: SU.pat, mech: 'wiz', mechN, inj: SU.inj } };
  }
  function txAct(x, by, C) {
    const P = lastP || {}, it = PCAT.TX.flatMap(g => g[2]).find(i => i[0] === x); if (!it) return null;
    if (it[2] === 'o2') { openSheet('o2', { dev: P.sc && P.sc.o2 ? P.sc.o2.dev : 'NonRebreatherMask', flow: P.sc && P.sc.o2 ? P.sc.o2.flow : 15, by }); return null; }
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
      case 'wz': SU.step = Math.max(1, Math.min(4, +x)); saveSU(); rerender(); scrollTop(); return null;
      case 'wz-set': SU.set = x; SU.step = 2; saveSU(); rerender(); scrollTop(); return null;
      case 'wz-sex': SU.pat.sex = x; saveSU(); rerender(); return null;
      case 'wz-healthy': SU.inj = []; saveSU(); rerender(); return null;
      case 'si-k0': { const t = PCAT.injBy(x), S0 = t.sevs || PCAT.SEV; openSheet('inj', { mode: 'setup', k: x, sev: S0[Math.min(2, S0.length - 1)][2], loc: t.pick.indexOf('loc') >= 0 ? 'RightLeg' : null, side: t.pick.indexOf('side') >= 0 ? 'R' : null }); return null; }
      case 'newsc': view = 'pt'; LSs('sim-pu-view', view); SU.step = 1; saveSU(); rerender(); scrollTop(); return null;
      case 'stopask': openSheet('confirm', { what: 'stop' }); return null;
      case 'arrask': openSheet('confirm', { what: 'arrest', code: x }); return null;
      case 'xferask': openSheet('xfer', { skip: 1, reprobe: 1, team2: 0 }); return null;
      case 'xf-t': sheet[x] = sheet[x] ? 0 : 1; drawSheet(); return null;
      case 'xf-ok': { const o = { op: 'phase', to: 'role1', skip: sheet.skip ? 180 : 0, reprobe: !!sheet.reprobe, team2: !!sheet.team2 }; closeSheet(); view = 'recv'; LSs('sim-pu-view', view); return C(o); }
      case 'cf-ok': { const w = sheet.what, code = sheet.code; closeSheet(); if (w === 'stop') { view = 'rep'; LSs('sim-pu-view', view); return C({ op: 'stop' }); } return C({ op: 'ev', code }); }
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
        if (A.k === 'drug') { openSheet('drug', { id: A.id, fixed: 1, by, oi: 0 }); return null; }
        if (A.k === 'fluid') { openSheet('fluid', { cmp: 'Blood', ml: 500, rate: 'pb', by }); return null; }
        if (A.k === 'ev') return C({ op: 'ev', code: A.x });
        if (A.k === 'view') { view = A.x; LSs('sim-pu-view', view); rerender(); scrollTop(); }
        return null;
      }
      case 'hm': { const sc = P.sc; if (!sc) return null; const kind = sc.set === 'role1' ? 'atm' : 'mist', key = (sc.nonce || '') + kind, [k, val] = x.split('|'); const M = HM[key] = HM[key] || {}; M[k] = M[k] === +val ? null : +val; Object.keys(HM).filter(z => z !== key && z.indexOf(sc.nonce || '#') !== 0).forEach(z => delete HM[z]); LSs('sim-pu-hm', HM); rerender(); return C({ op: 'hand', kind, m: M }); }
      case 'ho': HO[x] = HO[x] ? 0 : 1; LSs('sim-pu-ho', HO); rerender(); return null;
      case 'torole1': view = 'recv'; LSs('sim-pu-view', view); return C({ op: 'phase', to: 'role1', skip: HO.skip ? 180 : 0, reprobe: !!HO.reprobe, team2: !!HO.team2 });
      case 'recvok': view = 'pt'; LSs('sim-pu-view', view); rerender(); scrollTop(); return null;
      case 'sev': return C({ op: 'sev', id: x });
      case 'sd-open': openSheet('drug', { id: x, fixed: 1, by }); return null;
      case 'sf-open': openSheet('fluid', { cmp: x, ml: 500, rate: 'pb', by }); return null;
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

  // lipnios antraštės aukštis (programėlės juosta + skirtukai) – kad rodikliai liktų matomi slenkant
  setInterval(() => { try { const r = document.querySelector('.rhead'); if (r) document.documentElement.style.setProperty('--rh', r.offsetHeight + 'px'); } catch (e) {} }, 1000);
  // vedlio slankikliai: rašant – tik reikšmė, paleidus – perpiešiama (prognozė)
  document.addEventListener('input', e => {
    const t = e.target; if (!t || !t.dataset || !t.dataset.su) return;
    const k = t.dataset.su, v = +t.value;
    if (k === 'ff') SU.ff = v * 60; else SU.pat[k] = v;
    const l = document.getElementById('sl-' + k); if (l) l.textContent = v + (t.dataset.u || '');
    const bv = document.getElementById('sl-bv'); if (bv) bv.textContent = num(Math.round((SU.pat.sex === 'F' ? 65 : 70) * SU.pat.kg / 100) / 10);
    saveSU();
  });
  document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.su) rerender(); });
  // paieška „Visi veiksmai“ – filtruojama vietoje (be perpiešimo, kol rašoma)
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'pxq') return;
    Q = e.target.value; const q = Q.trim(), root = e.target.closest('.pxw') || document;
    root.querySelectorAll('.pxcd,.pxrow,.pxoff span,.pxdrb,.pxflb').forEach(el => { el.style.display = !q || match(el.textContent, q) ? '' : 'none'; });
    root.querySelectorAll('.pxdrg,.pxfl').forEach(g => { const any = [...g.children].some(c => c.style.display !== 'none'), lb = g.previousElementSibling; g.style.display = any ? '' : 'none'; if (lb && lb.classList.contains('pxlbl')) lb.style.display = any ? '' : 'none'; });
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
