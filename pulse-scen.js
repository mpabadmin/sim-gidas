'use strict';
// ───────── Scenarijai per evakuacijos grandinę (MEDEVAC → perdavimas → Role 1), vertinimas ir siūlymai ─────────
// Scenarijus: pacientas + sužalojimai (key), priešistorė (prep – kas padaryta iki perėmimo), fazių įvykiai (pagal laiką
// arba sąlygą), MEDEVAC baigtys „tik Role 1“ režimui, laukiami veiksmai su laiko langais. Laikai – sekundės nuo sužeidimo.
// Įvykių sąlygos – funkcijos (vykdomos monitoriuje); į būseną (SC) rašomi tik identifikatoriai ir laikai.
// Laukiamų veiksmų laiko langai – JUODRAŠTIS, tvirtina instruktoriai (MARCH gidas – TCCC 2026, ETC gidas – ETC 5.0).
const PSCEN = (() => {
  const mm = s => { s = Math.round(s); return Math.floor(s / 3600) + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0'); };
  const by = (sc, key) => sc && sc.inj && sc.inj.find(j => j.key === key);
  const logs = sc => (sc && sc.log) || [];
  const first = (sc, f, from) => { const l = logs(sc).find(x => x.t >= (from || 0) && f(x)); return l ? l.t : null; };
  const cardT = (sc, key, A, from) => { const j = by(sc, key); return j ? first(sc, l => l.iid === j.id && A.indexOf(l.a) >= 0, from) : null; };
  const txT = (sc, code, from) => first(sc, l => l.code === code, from);
  const drugT = (sc, id, from) => first(sc, l => l.code === 'drug' && l.id === id, from);
  const bloodT = (sc, from) => first(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || ''), from);
  const count = (sc, f) => logs(sc).filter(f).length;
  const ph = (sc, p) => (sc.phs || []).find(x => x.ph === p);

  // ── scenarijai ──
  const VILKAS = {
    id: 'vilkas', n: 'Vilkas 2-1 · SSU patrulyje', d: 'MEDEVAC → Role 1 · ~80 min · 5 sužalojimai · planuoti įvykiai', chain: true,
    mech: 'ied', mechN: 'SSU pėsčiųjų patrulyje', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Vilkas 2-1', age: 25, kg: 80, allergy: '' },
    brief: 'Pėsčiųjų patrulis, sprogstamasis užtaisas (SSU) 0:00. CLS uždėjo turniketą ant dešinės šlaunies 0:02, laikas užrašytas. IV, TXA, analgetikų nėra. MEDEVAC perima 0:25 nusileidimo aikštelėje, skrydis ~25 min į Role 1.',
    inj: [
      { key: 'amp', k: 'bleed', loc: 'RightLeg', sev: 1, lbl: 'Dešinės blauzdos trauminė amputacija', note: 'CLS turniketas per laisvai – kelmas sunkiasi', a: [{ k: 'hem', cmp: 'RightLeg', sev: 1 }] },
      { key: 'thigh', k: 'bleed', loc: 'LeftLeg', sev: 0.45, lbl: 'Kairės šlaunies skeveldros žaizda', note: 'nepastebėta – tamsios, permirkusios kelnės (randama kraujo paieška)' },
      { key: 'ptx', k: 'ptx', side: 'R', sev: 0.35, wound: 1, lbl: 'Dešinės krūtinės skeveldra – pneumotoraksas', note: 'maža įėjimo žaizda; skrydžio metu įtampa didėja', a: [{ k: 'tpx', side: 'R', sev: 0.35, idx: 0, rate: 0.01 }] },
      { key: 'htx', k: 'htx', side: 'R', sev: 0.2, hideMist: 1, lbl: 'Hemotoraksas dešinėje', note: 'lėtas (~5 ml/min); MEDEVAC neaptinkamas – Role 1: e-FAST, drenas', a: [{ k: 'htx', side: 'R', sev: 0.2, rate: 5 }] },
      { key: 'pain', k: 'pain', sev: 0.8 }
    ],
    // iki perėmimo (CLS)
    pre: [{ t: 120, ops: [{ card: 'amp', a: 'tq', n: 'CLS: turniketas ant šlaunies per uniformą', by: 'cls' }, { card: 'amp', a: 'tqloose', silent: 1 }, { a: { k: 'hem', cmp: 'RightLeg', sev: 1, rate: 12.5 } }, { note: 'Turniketas per laisvai – sunkiasi ~12 ml/min' }] }],
    start: { medevac: 1500 },
    // planuoti įvykiai: ph – fazė; at – laikas (MEDEVAC – nuo sužeidimo, Role 1 – nuo fazės pradžios); when – sąlyga
    ev: [
      { id: 'flight', ph: 'medevac', at: 1500, n: 'Pakilimas – skrydžio metu pneumotoraksas progresuoja greičiau (≈)', ops: [{ a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 22 } }], quiet: 1, hide: 1 },
      { id: 'noise', ph: 'medevac', at: 1680, n: 'Triukšmas 2 min – aliarmai negirdimi', ops: [{ ev: 'noise', p: { min: 2 } }], quiet: 1 },
      { id: 'vib', ph: 'medevac', at: 2280, n: 'Vibracija – SpO₂ artefaktai 60 s', ops: [{ ev: 'vib', p: { on: 1 } }], quiet: 1 },
      { id: 'vib0', ph: 'medevac', at: 2340, n: 'Vibracija baigėsi', ops: [{ ev: 'vib', p: { on: 0 } }], quiet: 1, hide: 1 },
      { id: 'o2off', ph: 'medevac', at: 2520, when: sc => !!sc.o2, n: 'Nukrito O₂ kaukė (jei uždėta)', ops: [{ ev: 'o2off' }], quiet: 1 },
      { id: 'kink', ph: 'medevac', when: (sc, t) => { const n = cardT(sc, 'ptx', ['ndc']); return n != null && t - n >= 360; }, n: 'Kateteris užsilenkė – vėl įsitempė (6 min po NDC)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 8 } }] },
      { id: 'land', ph: 'medevac', at: 3000, n: 'Nusileidimas – perdavimas (MIST)', ops: [{ ev: 'land' }], quiet: 1 },
      { id: 'rkink', ph: 'role1', at: 120, when: sc => { const j = by(sc, 'ptx'); return j && j.state === 'decomp'; }, n: 'NDC kateteris neveikia – vėl įtampa (jei dar tik adata)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 7 } }] },
      { id: 'rdrain', ph: 'role1', when: sc => { const j = by(sc, 'htx'); return j && j.state === 'drained'; }, n: 'Po drenavimo – drenu ~150 ml/val.', ops: [{ a: { k: 'htx', side: 'R', rate: 2.5 } }], quiet: 1, hide: 1 },
      { id: 'rbank', ph: 'role1', at: 1020, n: 'Kraujo bankas – kitiems sužeistiesiems paimta, liko 2 vnt.', ops: [{ bank: 2 }] },
      { id: 'rtq', ph: 'role1', at: 1320, when: sc => { const j = by(sc, 'amp'); return j && j.state === 'tq'; }, n: 'Verčiant rąstu atsileido turniketas', ops: [{ card: 'amp', a: 'tqloose' }] },
      { id: 'rcold', ph: 'role1', at: 2220, when: (sc, t, v) => v && v.temp < 35 && (by(sc, 'thigh') || {}).state === 'packed', n: 'Hipotermija – tamponuota šlaunis vėl kraujuoja (≈)', ops: [{ card: 'thigh', a: 'rebleed' }] },
      { id: 'revac', ph: 'role1', at: 2520, n: 'Evakuacija į Role 2 atvyko – ATMISTER', ops: [{ ev: 'evac' }], quiet: 1 }
    ],
    // „tik Role 1“ – kaip baigėsi MEDEVAC (veiksmai atkartojami modelyje)
    out: {
      opt: { n: 'Optimali', d: 'Viskas laiku: kraujavimas sustabdytas iki 0:28, NDC 0:35, TXA, kraujas + kalcis, HPMK', ops: [
        [1560, [{ o2: 'NonRebreatherMask', flow: 15 }]], [1620, [{ card: 'amp', a: 'tqre' }]], [1680, [{ card: 'thigh', a: 'pack' }]], [1740, [{ card: 'ptx', a: 'seal' }, { tx: 'iv' }]], [1800, [{ tx: 'io' }, { tx: 'pelvic' }]],
        [1860, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]], [1920, [{ fluid: 'Blood', ml: 450, rate: 45 }]], [1980, [{ tx: 'hpmk' }]], [2040, [{ tx: 'avpu' }, { drug: 'ket', dose: 25, unit: 'mg', route: 'IO' }]],
        [2100, [{ card: 'ptx', a: 'ndc' }]], [2160, [{ drug: 'cro', dose: 2, unit: 'g', route: 'IV' }]], [2520, [{ drug: 'ca', dose: 30, unit: 'ml', route: 'IO' }, { card: 'ptx', a: 'ndc' }]]] },
      typ: { n: 'Tipinė', d: 'Šlaunis rasta 0:34, NDC 0:44 (pavėluota), viena IV, be kalcio ir HPMK', ops: [
        [1680, [{ card: 'amp', a: 'tqre' }]], [1860, [{ card: 'ptx', a: 'seal' }]], [1980, [{ tx: 'iv' }]], [2040, [{ card: 'thigh', a: 'pack' }]], [2160, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]],
        [2280, [{ fluid: 'Blood', ml: 450, rate: 45 }]], [2400, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2460, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]], [2640, [{ card: 'ptx', a: 'ndc' }]], [3180, [{ card: 'ptx', a: 'ndc' }]]] },
      err: { n: 'Su klaidomis', d: 'Turniketas neužveržtas, šlaunis nerasta, kraujo nėra, NDC 0:41 – trauminis sustojimas ~0:50, atvežamas gaivinamas (HOTT)', ops: [
        [2400, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2460, [{ card: 'ptx', a: 'ndc' }]]] }
    },
    role1At: 3480,   // atvežimas į Role 1 (0:58)
    exp: [
      // MEDEVAC (laikas nuo perėmimo 0:25, jei nenurodyta kitaip)
      { ph: 'medevac', id: 'sweep', n: 'Kraujo paieška → kairė šlaunis kontroliuota', c: 'K', win: 180, done: sc => { const j = by(sc, 'thigh'); return j && j.ctl; } },
      { ph: 'medevac', id: 'tq', n: 'Turniketo patikra → užveržtas / antras', c: 'K', win: 180, done: sc => cardT(sc, 'amp', ['tqre', 'tq'], 1400) },
      { ph: 'medevac', id: 'ndc', n: 'NDC dešinėje (krūtinės žaizda + šokas + SpO₂ < 90)', c: 'K', from: sc => { const h = (sc.vh || []).find(x => x[0] >= 1500 && x[3] != null && x[3] < 90 && (x[2] < 100 || x[1] > 120)); return h ? h[0] : null; }, win: 300, done: sc => cardT(sc, 'ptx', ['ndc', 'fthor']) },
      { ph: 'medevac', id: 'txa', n: 'TXA 2 g (lėtai, atskira linija)', c: 'K', abs: 10800, done: sc => drugT(sc, 'txa') },
      { ph: 'medevac', id: 'seal', n: 'Krūtinės lipdukas', c: 'S', win: 480, done: sc => cardT(sc, 'ptx', ['seal']) },
      { ph: 'medevac', id: 'pelvic', n: 'Dubens diržas (sprogimas + amputacija + šokas)', c: 'S', win: 600, done: sc => txT(sc, 'pelvic') },
      { ph: 'medevac', id: 'access', n: 'Dvi linijos (IV / IO) – TXA ir kraujas atskirai', c: 'S', win: 600, done: sc => { const a = txT(sc, 'iv'), b = txT(sc, 'io'); return a != null && b != null ? Math.max(a, b) : null; } },
      { ph: 'medevac', id: 'o2', n: 'Deguonis (šokas, krūtinės trauma)', c: 'S', win: 300, done: sc => txT(sc, 'o2') },
      { ph: 'medevac', id: 'blood', n: 'Kraujas iki tikslo (radialinis pulsas / sAKS 100)', c: 'S', win: 900, done: sc => bloodT(sc) },
      { ph: 'medevac', id: 'abx0', n: 'Antibiotikas (ceftriaksonas 2 g IV / IO)', c: 'P', done: sc => first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')) },
      { ph: 'medevac', id: 'ca', n: 'Kalcis po 1-ojo vieneto', c: 'S', when: sc => bloodT(sc) != null, done: sc => { const b = bloodT(sc); const c = drugT(sc, 'ca'); return b != null && c != null && c >= b && c - b <= 1500 ? c : null; } },
      { ph: 'medevac', id: 'hpmk', n: 'Hipotermijos prevencija (HPMK)', c: 'S', win: 900, done: sc => txT(sc, 'hpmk') },
      { ph: 'medevac', id: 'avpu', n: 'AVPU įrašytas prieš ketaminą', c: 'S', when: sc => drugT(sc, 'ket') != null, done: sc => { const k = drugT(sc, 'ket'), a = txT(sc, 'avpu'); return k == null ? null : a != null && a <= k ? a : false; } },
      { ph: 'medevac', id: 'redo', n: 'Pakartotinė NDC (ta pati vieta, nauja adata)', c: 'S', when: sc => sc.evd && sc.evd.kink, from: sc => sc.evd.kink, win: 180, done: sc => sc.evd && sc.evd.kink ? cardT(sc, 'ptx', ['ndc', 'fthor'], sc.evd.kink) : null },
      { ph: 'medevac', id: 'mist', n: 'MIST perdavimas 4 / 4 (TQ laikas nuo pirmojo)', c: 'S', done: sc => sc.hand && sc.hand.mist ? (Object.values(sc.hand.mist.m).filter(x => x === 1).length === 4 ? sc.hand.mist.t : false) : null },
      // Role 1 (laikas nuo atvežimo)
      { ph: 'role1', id: 'probes', n: 'Davikliai prijungti', c: 'S', win: 60, done: (sc, p0) => first(sc, l => /^(ecgon|spo2on|nibpon)$/.test(l.code || ''), p0) },
      { ph: 'role1', id: 'cchk', n: '<c> turniketų ir tamponavimo patikra', c: 'K', win: 120, done: (sc, p0) => txT(sc, 'tqchk', p0) },
      { ph: 'role1', id: 'fthor', n: 'Pirštinė torakostomija / drenas dešinėje', c: 'K', win: 300, done: (sc, p0) => cardT(sc, 'ptx', ['fthor', 'tube'], p0) },
      { ph: 'role1', id: 'la', n: 'Vietinė nejautra prieš torakostomiją (sąmoningas)', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0) != null, done: sc => { const f = cardT(sc, 'ptx', ['fthor'], sc.r1t0), l = txT(sc, 'la', sc.r1t0); return l != null && l <= f ? l : false; } },
      { ph: 'role1', id: 'drain', n: 'Krūtinės drenas po torakostomijos', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0) != null, from: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0), win: 900, done: (sc, p0) => cardT(sc, 'ptx', ['tube'], p0) || cardT(sc, 'htx', ['htube'], p0) },
      { ph: 'role1', id: 'ca1', n: 'Kalcis (jei neskirtas MEDEVAC)', c: 'S', when: sc => bloodT(sc) != null, win: 600, done: (sc, p0) => drugT(sc, 'ca') },
      { ph: 'role1', id: 'txa1', n: 'TXA nekartota', c: 'S', done: (sc, p0) => count(sc, l => l.code === 'drug' && l.id === 'txa') > 1 ? false : 'ok' },
      { ph: 'role1', id: 'warm', n: 'Aktyvus šildymas', c: 'S', win: 900, done: (sc, p0) => txT(sc, 'warm', p0) },
      { ph: 'role1', id: 'abx', n: 'Antibiotikas (ETC: kuo greičiau, per 1 val.; jei neskirtas MEDEVAC)', c: 'S', win: 900, done: sc => first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')) },
      { ph: 'role1', id: 'pelv1', n: 'Dubens įvertinimas / diržas', c: 'S', done: sc => txT(sc, 'pelvic') },
      { ph: 'role1', id: 'target', n: 'sAKS 80–90 – neperpilta', c: 'S', when: sc => bloodT(sc, sc.r1t0) != null, done: (sc, p0) => { const H = (sc.vh || []).filter(x => x[0] > p0 + 600); if (!H.length) return null; const hi = H.filter(x => x[2] > 100).length; return hi >= 6 ? false : 'ok'; } },
      { ph: 'role1', id: 'efast', n: 'e-FAST', c: 'P', done: (sc, p0) => txT(sc, 'efast', p0) },
      { ph: 'role1', id: 'atm', n: 'ATMISTER perdavimas', c: 'S', done: sc => sc.hand && sc.hand.atm ? (Object.values(sc.hand.atm.m).filter(x => x === 1).length >= 7 ? sc.hand.atm.t : false) : null }
    ]
  };
  const LIST = [VILKAS];
  const get = id => LIST.find(s => s.id === id);

  // ── vertinimas: [{n, c, st: ok|bad|late|wait|na, t, txt}] fazei ──
  function evaluate(sc, phase, now) {
    const S = get(sc.scen && sc.scen.id); if (!S) return [];
    const P = ph(sc, phase); if (!P) return [];
    const p0 = phase === 'medevac' ? S.start.medevac : P.t0, end = P.t1 != null ? P.t1 : now;
    return S.exp.filter(e => e.ph === phase && (!e.when || e.when(sc))).map(e => {
      const d = e.done(sc, p0), from = typeof e.from === 'function' ? e.from(sc) : e.from != null ? e.from : p0;
      const lim = e.abs != null ? e.abs : e.win != null && from != null ? from + e.win : null;
      if (from == null && d == null) return { id: e.id, n: e.n, c: e.c, st: P.t1 != null ? 'na' : 'wait', t: null, txt: P.t1 != null ? 'indikacijos nebuvo' : 'kai atsiras indikacija', win: e.win != null ? '≤ ' + Math.round(e.win / 60) + ' min' : '' };
      let st, txt = '';
      if (d === 'ok') { st = 'ok'; }
      else if (d === false) { st = 'bad'; txt = e.id === 'txa1' ? 'kartota' : e.id === 'target' ? 'sAKS > 100' : e.id === 'avpu' ? 'neįrašytas' : 'ne visi punktai'; }
      else if (d != null && d !== true) { st = lim != null && d > lim ? 'late' : 'ok'; txt = e.abs != null ? mm(d) + ' nuo sužeidimo' : d < from ? 'atlikta anksčiau (' + mm(d) + ')' : Math.max(0, Math.round((d - from) / 60)) + ' min'; }
      else if (lim != null && end > lim) { st = 'bad'; txt = 'neatlikta'; }
      else { st = P.t1 != null ? 'bad' : 'wait'; txt = P.t1 != null ? 'neatlikta' : lim != null ? 'liko ' + Math.max(0, Math.round((lim - now) / 60)) + ' min' : ''; }
      const win = e.abs != null ? '≤ ' + mm(e.abs) : e.win != null ? '≤ ' + Math.round(e.win / 60) + ' min' : '';
      return { id: e.id, n: e.n, c: e.c, st, t: d, txt, win };
    });
  }

  // ── perdavimo etalonai (programėlė žino tiesą iš žurnalo) ──
  const injTxt = (sc, mist) => sc.inj.filter(j => j.k !== 'pain' && !(mist && j.hideMist && j.state !== 'drained' && txT(sc, 'efast') == null)).map(j => (j.lbl || PCAT.injName(j).name) + (j.state ? ' (' + (PCAT.STATES[j.state] || j.state).toLowerCase() + ')' : '')).join('; ');
  function txList(sc, upTo) {
    const T = [];
    logs(sc).filter(l => l.kind === 'tx' && (upTo == null || l.t <= upTo) && !l.star && l.by !== 'instr').forEach(l => { const k = l.n.split(' (')[0].replace(/^CLS: /, 'CLS: ') + ' ' + mm(l.t); if (T.indexOf(k) < 0) T.push(k); });
    return T;
  }
  function handItems(P, kind) {
    const sc = P.sc, v = P.v || {}, t = P.simt, S = get(sc.scen && sc.scen.id);
    const tq = sc.inj.filter(j => j.tq0 != null).map(j => 'turniketas ' + (j.lbl ? j.lbl.toLowerCase() : '') + ' uždėtas ' + mm(j.tq0) + ' (prieš ' + Math.round((t - j.tq0) / 60) + ' min)').join('; ');
    const lows = sc.min && sc.min.sys < 900 ? '; žemiausias sAKS ' + Math.round(sc.min.sys) : '';
    const S0 = `ŠSD ${v.hr != null ? v.hr : '?'}, AKS ${v.sys != null ? v.sys + '/' + v.dia : '?'}, SpO₂ ${v.spo2 != null ? v.spo2 : '?'}${sc.o2 ? ' su O₂ ' + sc.o2.flow + ' l/min' : ''}, KD ${v.rr != null ? v.rr : '?'}, T ${v.temp != null ? String(v.temp).replace('.', ',') : '?'}${lows}`;
    const tx = txList(sc).join('; ') || 'nesuteikta';
    const mech = (sc.mechN || 'nenurodyta') + ', ' + mm(0) + ' (sužeidimo laikas)';
    if (kind === 'mist') return [['M', 'Mechanizmas ir laikas', mech], ['I', 'Sužalojimai', injTxt(sc, 1)], ['S', 'Požymiai ir tendencija', S0], ['T', 'Gydymas (su laikais)', (tq ? tq + '; ' : '') + tx]];
    const pat = sc.pat || {};
    return [['A', 'Amžius', (pat.age ? pat.age + ' m.' : '?') + (pat.kg ? ', ' + pat.kg + ' kg' : '') + (pat.allergy ? ', alergija: ' + pat.allergy : ', alergijų nėra')], ['T', 'Sužeidimo laikas', '0:00 (prieš ' + Math.round(t / 60) + ' min)'], ['M', 'Mechanizmas', sc.mechN || '?'], ['I', 'Sužalojimai', injTxt(sc)], ['S', 'Požymiai', S0], ['T', 'Gydymas', (tq ? tq + '; ' : '') + tx], ['E', 'Atvykimo laikas (ETA)', 'pagal evakuacijos priemonę'], ['R', 'Reikia', 'chirurgija, kraujas' + (sc.inj.some(j => j.k === 'tbi') ? ', neurochirurgija' : '')]];
  }

  // ── „Perimta iš MEDEVAC – patikrinkite“ ──
  const isArrest = P => { const v = P.v || {}, sc = P.sc || {}; return !!sc.arrest || (v.hr != null && (v.hr < 20 || (v.map != null && v.map < 20) || (v.sys != null && v.sys < 30))); };
  function takeover(P) {
    const sc = P.sc, R = [], t = P.simt;
    if (isArrest(P)) R.push(['bad', 'TRAUMINIS SUSTOJIMAS – gaivinama', 'HOTT: kraujavimo kontrolė, kvėpavimo takai ir ventiliacija, abipusė dekompresija, kraujas + kalcis']);
    sc.inj.filter(j => j.k === 'bleed').forEach(j => {
      const nm = j.lbl || PCAT.injName(j).name;
      if (j.tq0 != null) R.push([j.tqOn != null ? 'ok' : 'bad', 'Turniketas – ' + nm, mm(t - j.tq0) + ' nuo pirmojo (' + mm(j.tq0) + ')' + (j.tqOn == null ? ' · ATSILEIDĘS' : '') + ' · konversija netaikoma esant šokui / amputacijai']);
      else if (PCAT.BAD.indexOf(j.state) >= 0) R.push(['bad', nm, 'kraujuoja – nekontroliuota']);
      else R.push(['ok', nm, (PCAT.STATES[j.state] || j.state).toLowerCase() + (j.ctl != null ? ' ' + mm(j.ctl) : '')]);
    });
    sc.inj.filter(j => j.k === 'ptx' || j.k === 'optx').forEach(j => { const n = count(sc, l => l.iid === j.id && l.a === 'ndc'); R.push([j.state === 'decomp' ? 'warn' : PCAT.BAD.indexOf(j.state) >= 0 ? 'bad' : 'ok', j.lbl || PCAT.injName(j).name, (PCAT.STATES[j.state] || j.state).toLowerCase() + (n ? ' · NDC ×' + n + ' – adata nepavyksta 40–50 %, patikrinkite (ETC)' : '')]); });
    const tx = drugT(sc, 'txa'); R.push([tx != null ? 'ok' : 'warn', 'TXA', tx != null ? '2 g ' + mm(tx) + ' – nekartoti' : 'neskirta – geriausia per 90 min nuo sužeidimo (liko ' + Math.max(0, Math.round((5400 - t) / 60)) + ' min)']);
    const bu = count(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || ''));
    R.push([bu ? 'ok' : 'warn', 'Kraujas', bu ? bu + ' vnt.' : 'neperpilta']);
    const ca = drugT(sc, 'ca'); if (bu) R.push([ca != null ? 'ok' : 'bad', 'Kalcis', ca != null ? mm(ca) : 'neskirtas po 1-ojo vieneto']);
    R.push([txT(sc, 'hpmk') != null ? 'ok' : 'bad', 'Hipotermijos prevencija', txT(sc, 'hpmk') != null ? 'HPMK ' + mm(txT(sc, 'hpmk')) : 'nėra' + (P.v && P.v.temp ? ' – T ' + String(P.v.temp).replace('.', ',') : '')]);
    const k = drugT(sc, 'ket'), a = txT(sc, 'avpu'); if (k != null) R.push([a != null && a <= k ? 'ok' : 'warn', 'AVPU prieš ketaminą', a != null && a <= k ? 'įrašytas' : 'neįrašytas – vaisto poveikio neatskirsite nuo šoko']);
    const ab = first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')); R.push([ab != null ? 'ok' : 'warn', 'Antibiotikas', ab != null ? mm(ab) : 'neskirtas – ETC: per 1 val. nuo sužeidimo']);
    const iv = txT(sc, 'iv'), io = txT(sc, 'io'); R.push([iv != null && io != null ? 'ok' : iv != null || io != null ? 'warn' : 'bad', 'Kraujagyslių prieiga', [iv != null ? 'IV' : '', io != null ? 'IO' : ''].filter(Boolean).join(' + ') || 'nėra']);
    return R;
  }

  // ── siūlymai pagal aktualumą (abiem varikliams; kiekvienas – su priežastimi) ──
  // balas = grėsmė (M5 A4 R3 C2 H1 P0,5) × būklė + rodiklių signalas + laikas; act – ką atidaryti / atlikti
  const W = { M: 5, A: 4, R: 3, B: 3, C: 2, H: 1, E: 1, D: 1, P: 0.5 };
  function advise(P) {
    const sc = P.sc, v = P.v || {}, t = P.simt, set = sc.set, r1 = set === 'role1', no = (PCAT.SETTINGS[set] || {}).no || [], S = [];
    if (!sc || sc.ph === 'handover') return [];
    const add = (L, n, why, sc0, act, lvl) => S.push({ L, n, why, s: (W[L] || 1) * 10 + sc0, act, lvl: lvl || (sc0 >= 20 ? 'crit' : sc0 >= 8 ? 'warn' : '') });
    if (isArrest(P)) {   // trauminis sustojimas – HOTT (ETC / CGO): priežastys pirmiau už paspaudimus
      sc.inj.filter(j => j.k === 'bleed' && PCAT.BAD.indexOf(j.state) >= 0).forEach(j => { const a = PCAT.cardActions(j, set).find(x => ['tqre', 'tq', 'jtq', 'pack'].indexOf(x[0]) >= 0); if (a) add('M', 'H: ' + a[1] + ' – ' + (j.lbl || PCAT.injName(j).name).toLowerCase(), 'trauminis sustojimas – pirmiausia sustabdyti kraujavimą', 40, { k: 'card', x: j.id + '|' + a[0] }, 'crit'); });
      add('A', 'O: kvėpavimo takai + ventiliacija (BVM)', 'deguonis, ventiliacija – hipoksija kaip priežastis', 36, { k: 'tx', x: 'bvm' }, 'crit');
      sc.inj.filter(j => (j.k === 'ptx' || j.k === 'optx') && ['decomp', 'active', 'retension', 'occl'].indexOf(j.state) >= 0).forEach(j => { const a = PCAT.cardActions(j, set).find(x => x[0] === (r1 ? 'fthor' : 'ndc')); if (a) add('B', 'T: ' + a[1] + ' – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'įtampos pneumotoraksas', 35, { k: 'card', x: j.id + '|' + a[0] }, 'crit'); });
      add('B', 'T: abipusė dekompresija', r1 ? 'abipusė pirštinė torakostomija (ETC)' : 'abipusė NDC (MARCH)', 30, { k: 'tx', x: 'bilat' }, 'crit');
      add('C', 'H: kraujas + kalcis', 'hipovolemija – greitas perpylimas (IO / IV)', 32, { k: 'tx', x: 'fluid' }, 'crit');
      add('C', 'Paspaudimai – antraeiliai', 'pirma pašalinti priežastis; adrenalinas – ne pirmo pasirinkimo (ETC)', 6, { k: 'view', x: 'ev' });
      S.sort((a, b) => b.s - a.s); return S;
    }
    const bad = j => PCAT.BAD.indexOf(j.state) >= 0, sys = v.sys, spo2 = v.spo2, hr = v.hr;
    const shock = sys != null && (sys < (r1 ? 80 : 90) || (hr > 120 && sys < 100));
    const did = code => txT(sc, code) != null, gave = id => drugT(sc, id) != null, didR = code => txT(sc, code, r1 && sc.r1t0 != null ? sc.r1t0 : 0) != null;
    // sužalojimai
    sc.inj.forEach(j => {
      const nm = (j.lbl || PCAT.injName(j).name);
      const A = PCAT.cardActions(j, set).filter(a => a[4] === 'team');
      const pick = codes => A.find(a => codes.indexOf(a[0]) >= 0);
      if (j.k === 'bleed' && bad(j)) {
        const a = pick(['tqre', 'tq', 'jtq', 'pack']);
        if (a) add('M', a[1] + ' – ' + nm.toLowerCase(), j.state === 'tq_loose' ? 'turniketas per laisvas / atsileidęs – kraujuoja' : 'nekontroliuotas kraujavimas', 30, { k: 'card', x: j.id + '|' + a[0] }, 'crit');
        else add('C', 'Kraujas, skubi evakuacija – ' + nm.toLowerCase(), 'nesuspaudžiamas kraujavimas', 18, { k: 'tx', x: 'fluid' }, 'crit');
      }
      if ((j.k === 'ptx' || j.k === 'optx') && (bad(j) || j.state === 'decomp' && spo2 < 90)) {
        const ten = spo2 != null && spo2 < 92;
        if (j.k === 'optx' && j.state === 'active') { const a = pick(['occl']); if (a) add('R', a[1] + ' – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'atvira krūtinės žaizda', 22, { k: 'card', x: j.id + '|occl' }); }
        else if (j.k === 'ptx' && j.wound && !j.sealed && pick(['seal'])) add('R', 'Krūtinės lipdukas – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'krūtinės žaizda (MARCH: lipdukas su vožtuvu)', ten ? 12 : 10, { k: 'card', x: j.id + '|seal' });
        if (ten || j.state === 'retension') {
          const a = r1 ? pick(['fthor']) : pick(['ndc']);
          if (a) add('R', (j.sealed && !r1 && j.state !== 'decomp' ? 'Atpūsti lipduką → ' : '') + a[1] + ' – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'SpO₂ ' + (spo2 != null ? spo2 : '?') + (sys != null ? ', AKS ' + sys : '') + (j.state === 'retension' ? ' · vėl įsitempė' : j.state === 'decomp' ? ' · po NDC vėl blogėja – ta pati vieta, nauja adata' : '') + (r1 ? ' · sąmoningam – vietinė nejautra' : ''), 26, { k: 'card', x: j.id + '|' + a[0] }, 'crit');
        }
      }
      if (j.k === 'ptx' && j.state === 'decomp' && r1) { const a = pick(['fthor']); if (a && !(spo2 < 92)) add('B', 'Pirštinė torakostomija → drenas – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'po adatos visada drenas; NDC nepavyksta 40–50 % (ETC) · vietinė nejautra', 9, { k: 'card', x: j.id + '|fthor' }); }
      if (j.k === 'ptx' && j.state === 'thor' && r1) { const a = pick(['tube']); if (a) add('B', 'Krūtinės drenas – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'po pirštinės torakostomijos – drenas', 12, { k: 'card', x: j.id + '|tube' }); }
      if (j.k === 'ptx' && j.state === 'decomp' && !r1 && spo2 >= 90) { /* stebėti */ }
      if (j.k === 'htx' && j.state !== 'drained' && r1) { const a = pick(['htube']); if (a) add('B', 'Krūtinės drenas – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'hemotoraksas' + (spo2 != null ? ' · SpO₂ ' + spo2 : ''), spo2 < 92 ? 14 : 8, { k: 'card', x: j.id + '|htube' }); }
      if (j.k === 'aw' && bad(j)) { const a = pick(r1 ? ['ett', 'sga', 'npa'] : ['npa', 'sga', 'cric']); if (a) add('A', a[1], 'kvėpavimo takų obstrukcija' + (spo2 != null ? ' · SpO₂ ' + spo2 : ''), 28, { k: 'card', x: j.id + '|' + a[0] }, 'crit'); }
      if (j.k === 'tam' && j.state !== 'drained' && r1) { const a = pick(['pcd']); if (a) add('C', a[1], 'tamponada – obstrukcinis šokas', 24, { k: 'card', x: j.id + '|pcd' }, 'crit'); }
    });
    const bleeding = sc.inj.some(j => j.k === 'bleed' || j.k === 'htx');
    const access = did('iv') || did('io');
    // C
    if (bleeding && !gave('txa') && t < 10800) add('C', 'TXA 2 g IV / IO lėtai', (r1 ? 'geriausia per 90 min' : 'ne vėliau 3 val.') + ' – liko ' + Math.max(0, Math.round(((r1 && t < 5400 ? 5400 : 10800) - t) / 60)) + ' min' + (access ? '' : ' · reikia prieigos'), 10 + (shock ? 4 : 0), { k: 'drug', id: 'txa' });
    if (!access && (shock || bleeding)) add('C', 'IV / IO prieiga', 'kraujui, TXA, vaistams' + (r1 ? '' : ' – dvi linijos (TXA ir kraujas atskirai)'), 12, { k: 'tx', x: 'iv' });
    else if (bleeding && !r1 && access && !(did('iv') && did('io')) && bloodT(sc) == null) add('C', 'Antra linija (IO)', 'TXA leidžiama ~20 min – kraujui atskira linija', 7, { k: 'tx', x: did('iv') ? 'io' : 'iv' });
    const bu = count(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || '')), left = sc.kit ? Math.max(0, sc.kit.max - Math.ceil(sc.kit.used)) : 0, running = (sc.inf || []).some(f => /Blood|PackedRBC|Plasma/.test(f.cmp) && t - f.t0 < f.tot);
    const tgtLow = r1 ? 80 : 100;
    const needBlood = sys != null && (r1 ? sys < 80 : (sys < 100 || (hr != null && hr / Math.max(1, sys) >= 1.3)));
    if (needBlood && !running && left > 0) add('C', 'Kraujas 1 vnt.', (sys >= tgtLow ? 'ŠSD ' + hr + ' > sAKS ' + sys + ' (šoko indeksas)' : 'sAKS ' + sys) + ' – tikslas ' + (r1 ? '80–90 (ETC)' : 'radialinis pulsas, sąmonė ar sAKS 100 (MARCH)') + ' · liko ' + left + ' vnt.', sys < 70 ? 22 : 12, { k: 'tx', x: 'fluid' }, sys < 70 ? 'crit' : 'warn');
    if (r1 && sys != null && sys > 95 && running) add('C', 'Stabdyti kraują – virš tikslo', 'sAKS ' + sys + ' > 90 (ETC tikslas 80–90)', 9, { k: 'view', x: 'all' });
    const caN = count(sc, l => l.code === 'drug' && l.id === 'ca');
    const caNeed = bu >= 1 && (caN === 0 || (r1 && Math.floor(bu / 4) > caN - 1));
    if (caNeed) add('C', 'Kalcio gliukonatas 10 % 30 ml', caN === 0 ? 'po 1-ojo kraujo vieneto – dar neskirtas' : 'kas 4 vienetus', 9, { k: 'drug', id: 'ca' });
    if (!did('pelvic') && sc.mech === 'ied') add('C', 'Dubens diržas', 'sprogimas + kojos amputacija + šokas', 7, { k: 'tx', x: 'pelvic' });
    if (r1 && !didR('efast') && sc.inj.some(j => ['ptx', 'optx', 'htx', 'tam'].indexOf(j.k) >= 0 || (j.k === 'bleed' && (PCAT.locBy(j.loc) || [])[2] === 'torso'))) add('C', 'e-FAST', 'pleura, perikardas, pilvas', 4, { k: 'tx', x: 'efast' });
    if (r1 && !didR('tqchk') && sc.inj.some(j => j.tq0 != null || j.state === 'packed')) add('M', 'Turniketų / tamponavimo patikra', '<c> – pirmiausia patikrinti, kas perimta', 8, { k: 'tx', x: 'tqchk' });
    // R
    const chest = sc.inj.some(j => ['ptx', 'optx', 'htx'].indexOf(j.k) >= 0 && j.state !== 'drained');
    if (!sc.o2 && spo2 != null && (spo2 < (r1 ? 94 : 90) || shock || chest || (hr != null && sys != null && hr / Math.max(1, sys) >= 1.3))) add('R', 'Deguonis', 'SpO₂ ' + spo2 + (shock ? ' · šokas' : '') + (chest ? ' · krūtinės trauma' : ''), spo2 < 90 ? 14 : 7, { k: 'tx', x: 'o2' });
    if (r1 && spo2 != null && spo2 < 90 && !sc.inj.some(j => (j.k === 'ptx' || j.k === 'optx' || j.k === 'aw') && bad(j))) add('A', 'Sprendimas: RSI?', 'SpO₂ ' + spo2 + ' nepaisant gydymo · ketamino indukcijos dozę šoke mažinti 50 %', 10, { k: 'tx', x: 'ett_g' });
    if (v.rr != null && v.rr < 8 && !sc.arrest) add('R', 'Ventiliacija maišu (BVM)', 'KD ' + v.rr + ' – hipoventiliacija', 24, { k: 'tx', x: 'bvm' }, 'crit');
    // H
    const T0 = v.temp;
    if (!r1 && !did('hpmk')) add('H', 'Hipotermijos prevencija (HPMK)', 'T ' + (T0 != null ? String(T0).replace('.', ',') : '?') + ' – šalta kabina', T0 != null && T0 < 35.5 ? 8 : 5, { k: 'tx', x: 'hpmk' });
    if (r1 && !didR('warm') && T0 != null && T0 < 36) add('E', 'Aktyvus šildymas, šilti skysčiai', 'T ' + String(T0).replace('.', ',') + (T0 < 35 ? ' – krešėjimas blogėja' : ''), T0 < 35 ? 9 : 5, { k: 'tx', x: 'warm' });
    // P
    const ket = drugT(sc, 'ket'), lastAn = Math.max(ket || -1e9, drugT(sc, 'fen') || -1e9, drugT(sc, 'mor') || -1e9);
    if (sc.inj.some(j => j.k === 'pain' && j.state !== 'stopped') && t - lastAn > 1800) add('P', r1 ? 'Analgezija (ketaminas 0,2–0,3 mg/kg IV)' : 'Ketaminas 25 mg IV lėtai', (!did('avpu') ? 'pirma – AVPU į kortelę · ' : '') + 'stiprus skausmas', 4, { k: 'drug', id: 'ket' });
    if (!did('avpu') && !ket) add('P', 'AVPU įvertinti ir įrašyti', 'prieš ketaminą – kitaip neatskirsite vaisto poveikio', 3, { k: 'tx', x: 'avpu' });
    if (sc.inj.some(j => j.k === 'bleed' || j.k === 'ptx' || j.k === 'optx') && first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')) == null) add('P', 'Antibiotikas', (r1 ? 'ETC: per 1 val. nuo sužeidimo' : 'ceftriaksonas 2 g IV / IO (negali nuryti)'), t > 3000 ? 6 : 3, { k: 'drug', id: r1 ? 'amx' : 'cro' });
    S.sort((a, b) => b.s - a.s);
    const seen = {}; return S.filter(x => (seen[x.n] ? false : (seen[x.n] = 1)));
  }
  return { LIST, get, evaluate, handItems, takeover, advise, mm, by, cardT, txT, drugT };
})();
if (typeof module !== 'undefined') module.exports = PSCEN;
