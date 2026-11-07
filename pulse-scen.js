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

  // ── grandinės scenarijai MEDEVAC → Role 1 (2026-11-07) ──
  // Laikai – sekundės nuo sužeidimo (Role 1 įvykių „at“ – nuo atvežimo). Laukiami veiksmai – tik tie, kuriuos pultas žymi
  // (kortelių veiksmai, procedūros, vaistai, skysčiai, perdavimas). MEDEVAC – MARCH gidas (TCCC 2026), Role 1 – ETC gidas / JTS.
  // Pastabos „note“ ir įvykių „n“ mato tik instruktorius.
  const ABX = /^(cro|amx|ert|cfd|mox|cfx)$/;
  const abxT = (sc, from) => first(sc, l => l.code === 'drug' && ABX.test(l.id || ''), from);
  const anT = (sc, from) => first(sc, l => l.code === 'drug' && /^(ket|esket|fen|mor)$/.test(l.id || ''), from);
  const fluidT = (sc, from) => first(sc, l => l.code === 'fluid' && /Saline|LactatedRingers/.test(l.cmp || ''), from);
  const caT = (sc, from) => first(sc, l => l.code === 'drug' && /^(ca|cacl)$/.test(l.id || ''), from);
  const awT = (sc, A, from) => cardT(sc, 'aw', A, from);
  // pirmas rodiklių įrašas nuo t0, atitinkantis sąlygą (vh: [t, ŠSD, sAKS, SpO₂])
  const vhAt = (sc, t0, f) => { const h = (sc.vh || []).find(x => x[0] >= t0 && f(x)); return h ? h[0] : null; };
  // sAKS tikslas fazėje: ne daugiau kaip 30 % įrašų žemiau ribos
  const sysOk = (sc, a, b, lo) => { const H = (sc.vh || []).filter(x => x[0] >= a && (b == null || x[0] <= b) && x[2] != null); if (H.length < 4) return null; return H.filter(x => x[2] < lo).length / H.length <= 0.3 ? 'ok' : false; };
  const evAt = (sc, id) => sc.evd && sc.evd[id] != null ? sc.evd[id] : null;
  const mistOk = sc => sc.hand && sc.hand.mist ? (Object.values(sc.hand.mist.m).filter(x => x === 1).length === 4 ? sc.hand.mist.t : false) : null;
  const atmOk = sc => sc.hand && sc.hand.atm ? (Object.values(sc.hand.atm.m).filter(x => x === 1).length >= 7 ? sc.hand.atm.t : false) : null;
  // bendri įvykiai skrydžio metu
  const FLY = (t0, o2t) => [
    { id: 'noise', ph: 'medevac', at: t0 + 180, n: 'Triukšmas 2 min – aliarmai negirdimi', ops: [{ ev: 'noise', p: { min: 2 } }], quiet: 1 },
    { id: 'vib', ph: 'medevac', at: t0 + 600, n: 'Vibracija – SpO₂ artefaktai 60 s', ops: [{ ev: 'vib', p: { on: 1 } }], quiet: 1 },
    { id: 'vib0', ph: 'medevac', at: t0 + 660, n: 'Vibracija baigėsi', ops: [{ ev: 'vib', p: { on: 0 } }], quiet: 1, hide: 1 },
    { id: 'o2off', ph: 'medevac', at: o2t, when: sc => !!sc.o2, n: 'Nukrito O₂ kaukė (jei uždėta)', ops: [{ ev: 'o2off' }], quiet: 1 }
  ];
  const LAND = t => ({ id: 'land', ph: 'medevac', at: t, n: 'Nusileidimas – perdavimas (MIST)', ops: [{ ev: 'land' }], quiet: 1 });
  const EVAC = { id: 'revac', ph: 'role1', at: 2700, n: 'Evakuacija į Role 2 atvyko – ATMISTER', ops: [{ ev: 'evac' }], quiet: 1 };
  // bendri laukiami veiksmai
  const X = {
    mTxa: (c, n) => ({ ph: 'medevac', id: 'txa', n: n || 'TXA 2 g IV / IO lėtai (ne vėliau 3 val.)', c: c || 'K', abs: 10800, done: sc => drugT(sc, 'txa') }),
    mO2: (c, n, win) => ({ ph: 'medevac', id: 'o2', n: n || 'Deguonis', c: c || 'S', win: win || 300, done: sc => txT(sc, 'o2') }),
    mHpmk: win => ({ ph: 'medevac', id: 'hpmk', n: 'Hipotermijos prevencija (HPMK)', c: 'S', win: win || 900, done: sc => txT(sc, 'hpmk') }),
    mBlood: (n, lo) => ({ ph: 'medevac', id: 'blood', n: n || 'Kraujas, kai šoko požymiai (radialinis pulsas silpnas / sAKS < 100)', c: 'S', when: sc => vhAt(sc, (ph(sc, 'medevac') || {}).t0 || 0, x => x[2] < (lo || 90) || (x[1] && x[2] && x[1] / x[2] >= 1.3)) != null, from: sc => vhAt(sc, (ph(sc, 'medevac') || {}).t0 || 0, x => x[2] < (lo || 90) || (x[1] && x[2] && x[1] / x[2] >= 1.3)), win: 600, done: sc => bloodT(sc) }),
    mCa: { ph: 'medevac', id: 'ca', n: 'Kalcis po 1-ojo kraujo vieneto (30 ml 10 % gliukonato)', c: 'S', when: sc => { const b = bloodT(sc), P = ph(sc, 'medevac'); return b != null && (!P || P.t1 == null || b <= P.t1); }, from: sc => bloodT(sc), win: 1500, done: sc => { const b = bloodT(sc); return b == null ? null : caT(sc, b); } },
    mPain: { ph: 'medevac', id: 'pain', n: 'Analgezija (ketaminas / esketaminas – MARCH)', c: 'P', done: sc => anT(sc) },
    mAbx: (n) => ({ ph: 'medevac', id: 'abx0', n: n || 'Antibiotikas (atvira žaizda)', c: 'P', done: sc => abxT(sc) }),
    mMist: { ph: 'medevac', id: 'mist', n: 'MIST perdavimas 4 / 4 (turnikete – pirmasis laikas)', c: 'S', done: mistOk },
    rProbes: { ph: 'role1', id: 'probes', n: 'Jutikliai prijungti', c: 'S', when: sc => sc.reprobe != null, win: 90, done: (sc, p0) => first(sc, l => /^(ecgon|spo2on|nibpon|probes)$/.test(l.code || ''), p0) },
    rTxa: { ph: 'role1', id: 'txa1', n: 'TXA nekartota', c: 'S', done: sc => count(sc, l => l.code === 'drug' && l.id === 'txa') > 1 ? false : 'ok' },
    rBlood: lo => ({ ph: 'role1', id: 'blood1', n: 'Kraujas iki tikslo (sAKS ≈ 100; GST – ≥ 110)', c: 'S', when: sc => vhAt(sc, sc.r1t0 || 0, x => x[2] < (lo || 90) || (x[1] && x[2] && x[1] / x[2] >= 1.3)) != null, from: sc => vhAt(sc, sc.r1t0 || 0, x => x[2] < (lo || 90) || (x[1] && x[2] && x[1] / x[2] >= 1.3)), win: 600, done: (sc, p0) => bloodT(sc, p0) }),
    rCa: { ph: 'role1', id: 'ca1', n: 'Kalcis po 1-ojo kraujo vieneto (jei neskirtas MEDEVAC)', c: 'S', when: sc => bloodT(sc) != null, from: sc => bloodT(sc), win: 1500, done: sc => { const b = bloodT(sc); return b == null ? null : caT(sc, b); } },
    rWarm: { ph: 'role1', id: 'warm', n: 'Aktyvus šildymas, šilti skysčiai', c: 'S', win: 900, done: (sc, p0) => txT(sc, 'warm', p0) },
    rAbx: n => ({ ph: 'role1', id: 'abx', n: n || 'Antibiotikas (ETC – kuo greičiau; jei neskirtas MEDEVAC)', c: 'S', win: 900, done: sc => abxT(sc) }),
    rHi: { ph: 'role1', id: 'target', n: 'Neperpilta – sAKS ≤ 110', c: 'S', bad: 'sAKS > 110', when: sc => bloodT(sc, sc.r1t0 || 0) != null, done: (sc, p0) => { const H = (sc.vh || []).filter(x => x[0] > p0 + 600 && x[2] != null); if (H.length < 4) return null; return H.filter(x => x[2] > 115).length >= 6 ? false : 'ok'; } },
    rAtm: { ph: 'role1', id: 'atm', n: 'ATMISTER perdavimas', c: 'S', done: atmOk }
  };

  // 1. Kraujavimas ir turniketas
  const LUSIS = {
    id: 'lusis', n: 'Lūšis 1-3 · Šautinė šlaunis', d: 'Kraujavimas ir turniketas · MEDEVAC → Role 1 · ~75 min', chain: true,
    mech: 'gswt', mechN: 'Šautinė žaizda – dešinė šlaunis', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Lūšis 1-3', age: 24, kg: 78, allergy: '', sex: 'M' },
    brief: 'Kontaktas su priešu miške, 0:00 – šautinė žaizda į dešinę šlaunį. CLS 0:02 uždėjo turniketą per uniformą, laiką užrašė. Kitų žaizdų „nėra“. IV, TXA ir analgetikų nėra. MEDEVAC perima 0:25 nusileidimo aikštelėje, skrydis ~25 min į Role 1.',
    brief1: 'Į Role 1 atvežamas sužeistasis po MEDEVAC (skrydis ~25 min). Šautinė žaizda į dešinę šlaunį 0:00, CLS turniketas 0:02. MEDEVAC komanda perduos MIST – patikrinkite turniketą ir ar nėra kitų žaizdų. Kraujo bankas 6 vnt.',
    inj: [
      { key: 'thigh', k: 'bleed', loc: 'RightLeg', sev: 1, lbl: 'Dešinės šlaunies šautinė žaizda – arterinis kraujavimas', note: 'CLS turniketas per laisvas – žaizda sunkiasi (~25 ml/min); kraunant į sraigtasparnį pasislenka (~40 ml/min)' },
      { key: 'arm', k: 'bleed', loc: 'LeftArm', sev: 0.2, lbl: 'Kairio dilbio skeveldros žaizda', note: 'nepastebėta po rankove – randama tik nuodugniai ieškant kraujo' },
      { key: 'pain', k: 'pain', sev: 0.8 }
    ],
    pre: [{ t: 120, ops: [{ card: 'thigh', a: 'tq', n: 'CLS: turniketas per uniformą, laikas užrašytas', by: 'cls' }, { card: 'thigh', a: 'tqloose', silent: 1 }, { a: { k: 'hem', cmp: 'RightLeg', sev: 0.15, rate: 25 } }, { note: 'Turniketas per laisvas – sunkiasi ~25 ml/min' }] }],
    start: { medevac: 1500 },
    ev: FLY(1500, 2400).concat([
      { id: 'tqmove', ph: 'medevac', at: 1800, when: (sc, t) => t <= 1980 && (by(sc, 'thigh') || {}).state === 'tq', n: 'Kraunant į sraigtasparnį turniketas pasislinko – vėl sunkiasi (~40 ml/min)', ops: [{ card: 'thigh', a: 'tqloose' }, { a: { k: 'hem', cmp: 'RightLeg', sev: 0.2, rate: 40 } }] },
      LAND(3000),
      { id: 'rarm', ph: 'role1', at: 600, when: (sc, t, v) => { const j = by(sc, 'arm'); return j && (j.state === 'packed' || j.state === 'pdress') && v && v.temp < 35.5; }, n: 'Hipotermija – dilbio žaizda vėl kraujuoja (≈)', ops: [{ card: 'arm', a: 'rebleed' }] },
      { id: 'rbank', ph: 'role1', at: 1200, n: 'Atvežami dar 2 sužeistieji – kraujo bankui liko 2 vnt.', ops: [{ bank: 2 }] },
      EVAC
    ]),
    out: {
      opt: { n: 'Optimali', d: 'Turniketas užveržtas 0:26 ir po pakrovimo, dilbis rastas 0:28, TXA, 1 vnt. kraujo + kalcis, HPMK, ketaminas', ops: [
        [1560, [{ card: 'thigh', a: 'tqre' }]], [1680, [{ card: 'arm', a: 'pdress' }]], [1740, [{ tx: 'hpmk' }]], [1800, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]],
        [1860, [{ card: 'thigh', a: 'tqre' }, { fluid: 'Blood', ml: 500, rate: 50 }]], [2100, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]],
        [2520, [{ drug: 'ca', dose: 30, unit: 'ml', route: 'IV' }]], [2700, [{ drug: 'cro', dose: 2, unit: 'g', route: 'IV' }]]] },
      typ: { n: 'Tipinė', d: 'Turniketas užveržtas 0:31, po pakrovimo – tik 0:38; dilbis rastas 0:45, TXA 0:40, 1 vnt. kraujo be kalcio, be HPMK', ops: [
        [1860, [{ card: 'thigh', a: 'tqre' }]], [2280, [{ card: 'thigh', a: 'tqre' }]], [2400, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]], [2520, [{ fluid: 'Blood', ml: 500, rate: 50 }]],
        [2700, [{ card: 'arm', a: 'pdress' }]], [2760, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]]] },
      err: { n: 'Su klaidomis', d: 'Turniketas neužveržtas, dilbis nerastas, TXA ir kraujo nėra – atvežamas sunkaus šoko', ops: [
        [2100, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]]] }
    },
    role1At: 3480,
    exp: [
      { ph: 'medevac', id: 'tq', n: 'Turniketo patikra → užveržtas (arba antras virš jo)', c: 'K', win: 180, done: sc => cardT(sc, 'thigh', ['tqre', 'tq'], 1400) },
      { ph: 'medevac', id: 'sweep', n: 'Kraujo paieška → kairio dilbio žaizda sustabdyta', c: 'K', win: 300, done: sc => (by(sc, 'arm') || {}).ctl },
      { ph: 'medevac', id: 'tqmove', n: 'Turniketas patikrintas po pakrovimo – vėl užveržtas', c: 'K', when: sc => evAt(sc, 'tqmove') != null, from: sc => evAt(sc, 'tqmove'), win: 180, done: sc => cardT(sc, 'thigh', ['tqre', 'tq'], evAt(sc, 'tqmove')) },
      X.mTxa(), X.mBlood(), X.mCa, X.mHpmk(), X.mPain, X.mAbx(), X.mMist,
      X.rProbes,
      { ph: 'role1', id: 'tqok', n: 'Turniketas užveržtas, kraujavimas sustabdytas', c: 'K', win: 120, done: (sc, p0) => { const j = by(sc, 'thigh'); return j && (j.state === 'tq' || j.state === 'pdress') ? (cardT(sc, 'thigh', ['tqre', 'tq'], p0) || 'ok') : null; } },
      { ph: 'role1', id: 'arm1', n: 'Kairio dilbio žaizda sustabdyta', c: 'K', win: 300, done: sc => (by(sc, 'arm') || {}).ctl },
      X.rTxa, X.rBlood(), X.rCa, X.rWarm, X.rAbx(), X.rHi,
      { ph: 'role1', id: 'conv', n: 'Turniketo konversija (ne šoke, < 2 val. – TCCC)', c: 'P', when: sc => { const H = (sc.vh || []).filter(x => x[0] >= (sc.r1t0 || 0) && x[2] != null); return H.length > 3 && H[H.length - 1][2] >= 100; }, abs: 7320, done: sc => cardT(sc, 'thigh', ['tqconv']) },
      X.rAtm
    ]
  };

  // 2. Įtampos pneumotoraksas
  const ERELIS = {
    id: 'erelis', n: 'Erelis 2-2 · Šautinė krūtinės žaizda', d: 'Įtampos pneumotoraksas · MEDEVAC → Role 1 · ~70 min', chain: true,
    mech: 'gswc', mechN: 'Šautinė žaizda – dešinė krūtinė', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Erelis 2-2', age: 31, kg: 85, allergy: 'penicilinas', sex: 'M' },
    brief: 'Snaiperio šūvis į dešinę krūtinės pusę 0:00 – kulka pro šarvinės liemenės šoną. CLS 0:03 užklijavo ventiliuojamą krūtinės lipduką. Sąmoningas, kvėpuoja dažnai, skundžiasi skausmu. Alergija penicilinui. MEDEVAC perima 0:22, skrydis ~25 min.',
    brief1: 'Į Role 1 atvežamas sužeistasis po MEDEVAC (skrydis ~25 min). Šautinė žaizda į dešinę krūtinę 0:00, CLS krūtinės lipdukas 0:03. MEDEVAC perduos MIST – kas atlikta krūtinei? Alergija penicilinui. Kraujo bankas 6 vnt.',
    inj: [
      { key: 'ptx', k: 'ptx', side: 'R', sev: 0.45, wound: 1, lbl: 'Dešinės krūtinės šautinė žaizda – pneumotoraksas', note: 'lipdukas uždėtas; skrydžio metu išsivysto įtampa – NDC; po NDC kateteris užsilenkia', a: [{ k: 'tpx', side: 'R', sev: 0.45, idx: 0.05, rate: 0.008 }] },
      { key: 'htx', k: 'htx', side: 'R', sev: 0.2, hideMist: 1, lbl: 'Hemotoraksas dešinėje', note: '~8 ml/min; MEDEVAC neaptinkamas – Role 1 drenuojant išteka ~500 ml', a: [{ k: 'htx', side: 'R', sev: 0.04, rate: 8 }] },
      { key: 'pain', k: 'pain', sev: 0.5 }
    ],
    pre: [{ t: 180, ops: [{ card: 'ptx', a: 'seal', n: 'CLS: ventiliuojamas krūtinės lipdukas', by: 'cls' }] }],
    start: { medevac: 1320 },
    ev: FLY(1320, 2220).concat([
      { id: 'flight', ph: 'medevac', at: 1440, when: sc => (by(sc, 'ptx') || {}).state === 'active', n: 'Pakilus įtampa didėja greičiau (≈)', ops: [{ a: { k: 'tpx', side: 'R', sev: 0.45, rate: 1 / 16 } }], quiet: 1, hide: 1 },
      { id: 'kink', ph: 'medevac', when: (sc, t) => { const n = cardT(sc, 'ptx', ['ndc']); return n != null && t - n >= 360 && t < 2700; }, n: 'Kateteris užsilenkė – vėl įtampa (6 min po NDC)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.45, rate: 1 / 8 } }] },
      LAND(2820),
      { id: 'rkink', ph: 'role1', at: 180, when: sc => (by(sc, 'ptx') || {}).state === 'decomp', n: 'NDC kateteris nebeveikia – vėl įtampa (jei tik adata)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.45, rate: 1 / 7 } }] },
      { id: 'rdrain', ph: 'role1', when: sc => (by(sc, 'htx') || {}).state === 'drained', n: 'Drenu iš karto ~500 ml kraujo, toliau ~150 ml/val.', ops: [{ a: { k: 'htx', side: 'R', sev: 0.0125, rate: 2.5 } }] },
      EVAC
    ]),
    out: {
      opt: { n: 'Optimali', d: 'Deguonis 0:23, NDC 0:27 (SpO₂ < 90 %), pakartotinė NDC po užsilenkimo, TXA, HPMK, ketaminas', ops: [
        [1380, [{ o2: 'NonRebreatherMask', flow: 15 }]], [1440, [{ tx: 'hpmk' }]], [1620, [{ card: 'ptx', a: 'ndc' }]], [1680, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]],
        [1800, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]], [2040, [{ card: 'ptx', a: 'ndc' }]], [2160, [{ drug: 'cro', dose: 2, unit: 'g', route: 'IV' }]]] },
      typ: { n: 'Tipinė', d: 'NDC tik 0:36 (SpO₂ ~80 %), užsilenkęs kateteris pastebėtas tik prieš nusileidimą, be HPMK', ops: [
        [1500, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2160, [{ card: 'ptx', a: 'ndc' }]], [2280, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]], [2760, [{ card: 'ptx', a: 'ndc' }]]] },
      err: { n: 'Su klaidomis', d: 'NDC neatlikta – deguonis 0:30, lipdukas du kartus „atpūstas“ (laikinai palengvėja); atvežamas su įtampa', ops: [
        [1800, [{ o2: 'NonRebreatherMask', flow: 15 }]], [2040, [{ card: 'ptx', a: 'burp' }]], [2640, [{ card: 'ptx', a: 'burp' }]]] }
    },
    role1At: 3300,
    exp: [
      X.mO2('S', 'Deguonis (krūtinės trauma)'),
      { ph: 'medevac', id: 'ndc', n: 'Adatinė dekompresija dešinėje (SpO₂ < 90 % + krūtinės žaizda)', c: 'K', from: sc => vhAt(sc, 1320, x => x[3] != null && x[3] < 90), win: 300, done: sc => cardT(sc, 'ptx', ['ndc', 'fthor']) },
      { ph: 'medevac', id: 'redo', n: 'Pakartotinė NDC (nauja adata)', c: 'S', when: sc => evAt(sc, 'kink') != null, from: sc => evAt(sc, 'kink'), win: 180, done: sc => evAt(sc, 'kink') != null ? cardT(sc, 'ptx', ['ndc'], evAt(sc, 'kink')) : null },
      X.mTxa('S', 'TXA 2 g (penetruojanti liemens žaizda – TCCC)'), X.mHpmk(), X.mPain, X.mAbx('Antibiotikas (atvira žaizda; alergija penicilinui – patikrinkite)'), X.mMist,
      X.rProbes,
      { ph: 'role1', id: 'fthor', n: 'Pirštinė torakostomija dešinėje', c: 'K', win: 300, done: (sc, p0) => cardT(sc, 'ptx', ['fthor', 'tube'], p0) },
      { ph: 'role1', id: 'la', n: 'Vietinė nejautra (lidokainas) prieš torakostomiją', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor', 'tube'], sc.r1t0 || 0) != null, done: sc => { const f = cardT(sc, 'ptx', ['fthor', 'tube'], sc.r1t0 || 0), l = drugT(sc, 'lido', sc.r1t0 || 0); return l != null && l <= f ? l : false; }, bad: 'be nejautros' },
      { ph: 'role1', id: 'drain', n: 'Krūtinės drenas (pneumo- ir hemotoraksas)', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0) != null, from: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0), win: 900, done: (sc, p0) => cardT(sc, 'ptx', ['tube'], p0) || cardT(sc, 'htx', ['htube'], p0) },
      X.rTxa, X.rBlood(), X.rCa, X.rWarm, X.rAbx(), X.rAtm
    ]
  };

  // 3. Kvėpavimo takų nudegimas
  const SERNAS = {
    id: 'sernas', n: 'Šernas 3-1 · Šarvuočio gaisras', d: 'Kvėpavimo takų nudegimas · MEDEVAC → Role 1 · ~80 min', chain: true,
    mech: 'fire', mechN: 'Šarvuočio gaisras – uždaroje erdvėje', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Šernas 3-1', age: 23, kg: 75, allergy: '', sex: 'M' },
    brief: 'Šarvuotis pataikytas prieštankine rakieta 0:00, kilo gaisras. Šaulys ištrauktas iš degančio skyriaus po ~2 min. Apdegęs veidas, kaklas, rankos ir krūtinė. Užkimęs, kosti, burnoje suodžiai. CLS 10 min aušino nudegimus vandeniu. MEDEVAC perima 0:30, skrydis ~25 min.',
    brief1: 'Į Role 1 atvežamas sužeistasis po MEDEVAC (skrydis ~25 min). Šarvuočio gaisras 0:00, nudegimai ~40 %, inhaliacinė trauma. MEDEVAC perduos MIST – ar kvėpavimo takai užtikrinti? Kraujo bankas 6 vnt.',
    inj: [
      { key: 'burn', k: 'burn', sev: 0.4, lbl: 'Nudegimai 40 % (veidas, kaklas, abi rankos, krūtinė)', note: 'II–III laipsnio; skysčiai pagal 10 taisyklę (40 × 10 = 400 ml/val.)' },
      { key: 'aw', k: 'aw', sev: 0.35, lbl: 'Inhaliacinė trauma – kvėpavimo takų edema', note: 'užkimęs balsas, suodžiai, apdegę antakiai; edema didėja per 30–60 min; NPA / i-gel netinka (TCCC)', a: [{ k: 'aw', sev: 0.15 }] },
      { key: 'pain', k: 'pain', sev: 0.8 }
    ],
    pre: [{ t: 600, ops: [{ a: { k: 'temp', v: 35.8 } }, { note: 'CLS 10 min aušino nudegimus vandeniu – sužeistasis sušalo (T 35,8)' }] }],
    start: { medevac: 1800 },
    ev: FLY(1800, 2700).concat([
      { id: 'edema1', ph: 'medevac', at: 2280, when: sc => (by(sc, 'aw') || {}).state !== 'secured', n: 'Edema didėja – stridoras, SpO₂ krenta', ops: [{ card: 'aw', a: 'sevup' }] },
      { id: 'sgafail', ph: 'medevac', when: (sc, t) => { const s = awT(sc, ['npa', 'sga']); return s != null && t - s >= 180; }, n: 'NPA / i-gel nebeužtikrina – edema užspaudė kvėpavimo takus', ops: [{ card: 'aw', a: 'aww' }, { card: 'aw', a: 'sevup' }] },
      { id: 'edema2', ph: 'medevac', at: 2880, when: sc => { const j = by(sc, 'aw') || {}; return j.state !== 'secured' && j.sev < 0.7; }, n: 'Kvėpavimo takai beveik užsivėrę', ops: [{ card: 'aw', a: 'sevup' }] },
      LAND(3300),
      { id: 'redema', ph: 'role1', at: 480, when: sc => (by(sc, 'aw') || {}).state !== 'secured', n: 'Edema progresuoja – gresia visiška obstrukcija', ops: [{ card: 'aw', a: 'sevup' }] },
      { id: 'rsgafail', ph: 'role1', when: (sc, t) => { const s = awT(sc, ['npa', 'sga'], sc.r1t0 || 0); return s != null && t - s >= 180; }, n: 'NPA / i-gel nebeužtikrina – edema užspaudė kvėpavimo takus', ops: [{ card: 'aw', a: 'aww' }] },
      EVAC
    ]),
    out: {
      opt: { n: 'Optimali', d: 'Deguonis 0:31, HPMK, RL 400 ml/val. 0:35, ketaminas, krikotiroidotomija 0:39 (stridoras)', ops: [
        [1830, [{ o2: 'NonRebreatherMask', flow: 15 }]], [1890, [{ tx: 'hpmk' }]], [2100, [{ fluid: 'LactatedRingers', ml: 1000, rate: 6.7 }]], [2160, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]],
        [2340, [{ card: 'aw', a: 'cric' }]]] },
      typ: { n: 'Tipinė', d: 'Deguonis 0:33, skysčiai tik 0:45, be HPMK; stridoras stebėtas, bet kvėpavimo takai neužtikrinti – atvežamas hipoksiškas (SpO₂ ~65 %)', ops: [
        [1980, [{ o2: 'NonRebreatherMask', flow: 15 }]], [2700, [{ fluid: 'LactatedRingers', ml: 1000, rate: 6.7 }]], [2760, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]]] },
      err: { n: 'Su klaidomis', d: 'NPA 0:40 (netinka – nepadėjo), deguonis tik 0:45, be skysčių ir HPMK – atvežamas su sunkia obstrukcija (SpO₂ ~65 %)', ops: [
        [2400, [{ card: 'aw', a: 'npa' }]], [2700, [{ o2: 'NonRebreatherMask', flow: 10 }]]] }
    },
    role1At: 3780,
    exp: [
      X.mO2('K', 'Deguonis didelio srauto (kaukė su rezervuaru 15 l/min)'),
      { ph: 'medevac', id: 'airway', n: 'Krikotiroidotomija, kai stridoras / SpO₂ krenta (TCCC)', c: 'K', when: sc => evAt(sc, 'edema1') != null, from: sc => evAt(sc, 'edema1'), win: 300, done: sc => awT(sc, ['cric']) },
      { ph: 'medevac', id: 'nonpa', n: 'NPA / i-gel nenaudota (inhaliacinė trauma – TCCC)', c: 'S', bad: 'naudota', done: sc => awT(sc, ['npa', 'sga']) != null ? false : 'ok' },
      { ph: 'medevac', id: 'fluids', n: 'Skysčiai: 40 % × 10 = 400 ml/val. RL (TCCC, > 20 %)', c: 'S', win: 900, done: sc => fluidT(sc) },
      X.mHpmk(600), X.mPain, X.mMist,
      X.rProbes,
      { ph: 'role1', id: 'rsi', n: 'Kvėpavimo takai užtikrinti (RSI) prieš visišką obstrukciją', c: 'K', when: sc => { const t = awT(sc, ['cric', 'ett']); return t == null || t >= (sc.r1t0 || 0); }, win: 900, done: (sc, p0) => awT(sc, ['ett', 'cric'], p0) },
      { ph: 'role1', id: 'fluids1', n: 'Skysčiai pagal 10 taisyklę (jei nepradėti MEDEVAC)', c: 'S', when: sc => { const f = fluidT(sc); return f == null || f >= (sc.r1t0 || 0); }, win: 600, done: (sc, p0) => fluidT(sc, p0) },
      X.rWarm,
      { ph: 'role1', id: 'noabx', n: 'Antibiotikai vien dėl nudegimų neskiriami (TCCC)', c: 'P', bad: 'skirta', done: sc => abxT(sc) != null ? false : 'ok' },
      X.rAtm
    ]
  };

  // 4. Galvos smegenų trauma
  const STUMBRAS = {
    id: 'stumbras', n: 'Stumbras 1-4 · Apvirtęs visureigis', d: 'Galvos smegenų trauma · MEDEVAC → Role 1 · ~75 min', chain: true,
    mech: 'tbi', mechN: 'Apvirtęs visureigis – galvos trauma', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Stumbras 1-4', age: 29, kg: 82, allergy: '', sex: 'M' },
    brief: 'Patrulio visureigis apvirto griovyje 0:00. Vairuotojas atsitrenkė galva į rėmą, trumpai prarado sąmonę, dabar sumišęs (GKS 12), knarkia. Galvos odos žaizda. CLS 0:04 sutvarstė galvą, 0:05 įkišo nosiaryklės vamzdelį ir paguldė ant šono. Skundžiasi pilvo skausmu. MEDEVAC perima 0:25, skrydis ~25 min.',
    brief1: 'Į Role 1 atvežamas sužeistasis po MEDEVAC (skrydis ~25 min). Apvirtęs visureigis 0:00, galvos trauma, sąmonė blogėja. MEDEVAC perduos MIST – kokie vyzdžiai, kas skirta? Kraujo bankas 6 vnt.',
    inj: [
      { key: 'tbi', k: 'tbi', sev: 0.55, lbl: 'Galvos smegenų trauma – kairė smilkininė sritis', note: 'GKS 12 → blogėja; 0:42 išsiplečia kairysis vyzdys (smegenų išvarža) – HTS; hipoksija ir hipotenzija sunkina' },
      { key: 'aw', k: 'aw', sev: 0.35, lbl: 'Kvėpavimo takai – sutrikusi sąmonė, knarkia', note: 'CLS NPA; 0:34 vemia – atsiurbti, vėl atverti kvėpavimo takus' },
      { key: 'scalp', k: 'bleed', loc: 'Skin', sev: 0.2, lbl: 'Galvos odos plėštinė žaizda', note: 'CLS sutvarstė – sustabdyta' },
      { key: 'spl', k: 'bleed', loc: 'Spleen', sev: 0.2, hideMist: 1, lbl: 'Blužnies plyšimas (uždara pilvo trauma)', note: 'lėtas vidinis kraujavimas (~10 ml/min) – tachikardija didėja; MEDEVAC neatpažįstamas, Role 1 – e-FAST; skubi evakuacija į Role 2 (chirurgija)' }
    ],
    pre: [{ t: 240, ops: [{ card: 'scalp', a: 'pdress', n: 'CLS: spaudžiamasis tvarstis ant galvos', by: 'cls' }] }, { t: 300, ops: [{ card: 'aw', a: 'npa', n: 'CLS: nosiaryklės vamzdelis, šoninė padėtis', by: 'cls' }] }],
    start: { medevac: 1500 },
    ev: FLY(1500, 2460).concat([
      { id: 'vomit', ph: 'medevac', at: 2040, when: sc => (by(sc, 'aw') || {}).state !== 'secured', n: 'Vėmimas – kvėpavimo takai užsikimšo', ops: [{ ev: 'vomit' }] },
      { id: 'herni', ph: 'medevac', at: 2520, n: 'Kairysis vyzdys išsiplėtė, dešinės pusės silpnumas – smegenų išvaržos požymiai', ops: [{ card: 'tbi', a: 'sevup' }, { a: { k: 'tbi', sev: 0.85 } }] },
      LAND(3000),
      { id: 'rseiz', ph: 'role1', at: 540, n: 'Generalizuoti traukuliai', ops: [{ a: { k: 'pain', sev: 1 } }] },
      { id: 'rseizaw', ph: 'role1', at: 540, when: sc => (by(sc, 'aw') || {}).state !== 'secured', n: 'Traukulių metu užsikimšo kvėpavimo takai', ops: [{ ev: 'vomit' }], hide: 1 },
      { id: 'rseiz0', ph: 'role1', when: sc => evAt(sc, 'rseiz') != null && drugT(sc, 'mid', evAt(sc, 'rseiz')) != null, n: 'Traukuliai liovėsi (midazolamas)', ops: [{ a: { k: 'pain', sev: 0 } }] },
      EVAC
    ]),
    out: {
      opt: { n: 'Optimali', d: 'Deguonis 0:26, TXA 0:28, HPMK, atsiurbta ir NPA 0:35, HTS 250 ml 0:43 (sAKS > 100 – kraujo nereikia)', ops: [
        [1560, [{ o2: 'NonRebreatherMask', flow: 15 }]], [1620, [{ tx: 'hpmk' }]], [1680, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]], [2100, [{ card: 'aw', a: 'suct' }]], [2160, [{ card: 'aw', a: 'npa' }]],
        [2580, [{ drug: 'hts', dose: 250, unit: 'ml', route: 'IV' }]]] },
      typ: { n: 'Tipinė', d: 'Deguonis 0:30, atsiurbta tik 0:38 (SpO₂ ~80 %), HTS 0:52, be TXA ir kraujo', ops: [
        [1800, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2280, [{ card: 'aw', a: 'suct' }]], [2340, [{ card: 'aw', a: 'pos' }]], [3120, [{ drug: 'hts', dose: 250, unit: 'ml', route: 'IV' }]]] },
      err: { n: 'Su klaidomis', d: 'Deguonis tik 0:40, vėmimas neatsiurbtas, HTS neskirta – atvežamas su Kušingo triada', ops: [
        [2400, [{ o2: 'NonRebreatherMask', flow: 10 }]]] }
    },
    role1At: 3480,
    exp: [
      X.mO2('K', 'Deguonis – SpO₂ > 90 % (TCCC GST)'),
      { ph: 'medevac', id: 'suct', n: 'Atsiurbimas po vėmimo', c: 'K', when: sc => evAt(sc, 'vomit') != null, from: sc => evAt(sc, 'vomit'), win: 120, done: sc => evAt(sc, 'vomit') != null ? awT(sc, ['suct', 'sga', 'cric'], evAt(sc, 'vomit')) : null },
      { ph: 'medevac', id: 'hts', n: 'HTS 3 % / 5 % 250 ml (smegenų išvaržos požymiai – TCCC)', c: 'K', when: sc => evAt(sc, 'herni') != null, from: sc => evAt(sc, 'herni'), win: 600, done: sc => drugT(sc, 'hts', evAt(sc, 'herni') || 0) },
      { ph: 'medevac', id: 'bp', n: 'sAKS > 100 arba normalus radialinis pulsas (TCCC GST)', c: 'S', bad: 'sAKS < 100', done: sc => { const P = ph(sc, 'medevac'); return P ? sysOk(sc, P.t0, P.t1, 100) : null; } },
      X.mTxa('S', 'TXA 2 g (reikšminga GST – TCCC)'), X.mHpmk(), X.mMist,
      X.rProbes,
      { ph: 'role1', id: 'rsi', n: 'RSI – kvėpavimo takų apsauga (GKS ≤ 8 – ETC)', c: 'S', when: sc => { const t = awT(sc, ['ett', 'cric', 'sga']); return t == null || t >= (sc.r1t0 || 0); }, win: 1200, done: (sc, p0) => awT(sc, ['ett', 'cric'], p0) },
      { ph: 'role1', id: 'hts1', n: 'HTS 250 ml – išvaržos požymiai (jei neskirta MEDEVAC)', c: 'K', when: sc => evAt(sc, 'herni') != null && first(sc, l => l.code === 'drug' && /^(hts|man)$/.test(l.id || ''), evAt(sc, 'herni')) == null || first(sc, l => l.code === 'drug' && /^(hts|man)$/.test(l.id || ''), evAt(sc, 'herni') || 0) >= (sc.r1t0 || 0), win: 600, done: (sc, p0) => first(sc, l => l.code === 'drug' && /^(hts|man)$/.test(l.id || ''), p0) },
      { ph: 'role1', id: 'tbibp', n: 'sAKS ≥ 110 (JTS GST)', c: 'S', bad: 'sAKS < 110', done: (sc, p0) => { const P = ph(sc, 'role1'); return sysOk(sc, p0 + 300, P && P.t1, 110); } },
      X.rBlood(110),
      { ph: 'role1', id: 'mid', n: 'Midazolamas 5 mg – traukuliai (JTS)', c: 'K', when: sc => evAt(sc, 'rseiz') != null, from: sc => evAt(sc, 'rseiz'), win: 300, done: sc => drugT(sc, 'mid', evAt(sc, 'rseiz') || 0) },
      { ph: 'role1', id: 'lev', n: 'Levetiracetamas 2000 mg IV (JTS)', c: 'S', when: sc => evAt(sc, 'rseiz') != null, from: sc => evAt(sc, 'rseiz'), win: 1800, done: sc => drugT(sc, 'lev', evAt(sc, 'rseiz') || 0) },
      X.rTxa, X.rCa, X.rAtm
    ]
  };

  // 5. Politrauma (SSU)
  const VILKAS = {
    id: 'vilkas', n: 'Vilkas 2-1 · SSU patrulyje', d: 'Politrauma · MEDEVAC → Role 1 · ~80 min · 5 sužalojimai', chain: true,
    mech: 'ied', mechN: 'SSU pėsčiųjų patrulyje', temp0: 36.6,
    pat: { state: 'Soldier@0s.json', name: 'Vilkas 2-1', age: 25, kg: 80, allergy: '', sex: 'M' },
    brief: 'Pėsčiųjų patrulis, sprogstamasis užtaisas (SSU) 0:00. CLS uždėjo turniketą ant dešinės šlaunies 0:02, laikas užrašytas. IV, TXA, analgetikų nėra. MEDEVAC perima 0:25 nusileidimo aikštelėje, skrydis ~25 min į Role 1.',
    brief1: 'Į Role 1 atvežamas sužeistasis po MEDEVAC (sraigtasparniu, ~25 min). SSU pėsčiųjų patrulyje 0:00. MEDEVAC komanda perduos MIST – patikrinkite, kas padaryta. Kraujo bankas 6 vnt., procedūros ir vaistai pagal ETC gidą.',
    inj: [
      { key: 'amp', k: 'bleed', loc: 'RightLeg', sev: 1, lbl: 'Dešinės blauzdos trauminė amputacija', note: 'CLS turniketas per laisvai – kelmas sunkiasi', a: [{ k: 'hem', cmp: 'RightLeg', sev: 1 }] },
      { key: 'thigh', k: 'bleed', loc: 'LeftLeg', sev: 0.45, lbl: 'Kairės šlaunies skeveldros žaizda', note: 'nepastebėta – tamsios, permirkusios kelnės (randama kraujo paieška)' },
      { key: 'ptx', k: 'ptx', side: 'R', sev: 0.35, wound: 1, lbl: 'Dešinės krūtinės skeveldra – pneumotoraksas', note: 'maža įėjimo žaizda; skrydžio metu įtampa didėja', a: [{ k: 'tpx', side: 'R', sev: 0.35, idx: 0, rate: 0.01 }] },
      { key: 'htx', k: 'htx', side: 'R', sev: 0.2, hideMist: 1, lbl: 'Hemotoraksas dešinėje', note: 'lėtas (~5 ml/min); MEDEVAC neaptinkamas – Role 1: drenas', a: [{ k: 'htx', side: 'R', sev: 0.025, rate: 5 }] },
      { key: 'pain', k: 'pain', sev: 0.8 }
    ],
    pre: [{ t: 120, ops: [{ card: 'amp', a: 'tq', n: 'CLS: turniketas ant šlaunies per uniformą', by: 'cls' }, { card: 'amp', a: 'tqloose', silent: 1 }, { a: { k: 'hem', cmp: 'RightLeg', sev: 0.1, rate: 12.5 } }, { note: 'Turniketas per laisvai – sunkiasi ~12 ml/min' }] }],
    start: { medevac: 1500 },
    ev: FLY(1500, 2520).concat([
      { id: 'flight', ph: 'medevac', at: 1500, n: 'Pakilimas – skrydžio metu pneumotoraksas progresuoja greičiau (≈)', ops: [{ a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 22 } }], quiet: 1, hide: 1 },
      { id: 'kink', ph: 'medevac', when: (sc, t) => { const n = cardT(sc, 'ptx', ['ndc']); return n != null && t - n >= 360 && t < 2900; }, n: 'Kateteris užsilenkė – vėl įsitempė (6 min po NDC)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 8 } }] },
      LAND(3000),
      { id: 'rkink', ph: 'role1', at: 120, when: sc => (by(sc, 'ptx') || {}).state === 'decomp', n: 'NDC kateteris neveikia – vėl įtampa (jei dar tik adata)', ops: [{ card: 'ptx', a: 'retens' }, { a: { k: 'tpx', side: 'R', sev: 0.35, rate: 1 / 7 } }] },
      { id: 'rdrain', ph: 'role1', when: sc => (by(sc, 'htx') || {}).state === 'drained', n: 'Po drenavimo – drenu ~150 ml/val.', ops: [{ a: { k: 'htx', side: 'R', sev: 0.0125, rate: 2.5 } }], quiet: 1, hide: 1 },
      { id: 'rbank', ph: 'role1', at: 1020, n: 'Kraujo bankas – kitiems sužeistiesiems paimta, liko 2 vnt.', ops: [{ bank: 2 }] },
      { id: 'rtq', ph: 'role1', at: 1320, when: sc => (by(sc, 'amp') || {}).state === 'tq', n: 'Verčiant rąstu atsileido turniketas', ops: [{ card: 'amp', a: 'tqloose' }] },
      { id: 'rcold', ph: 'role1', at: 2220, when: (sc, t, v) => v && v.temp < 35 && (by(sc, 'thigh') || {}).state === 'packed', n: 'Hipotermija – tamponuota šlaunis vėl kraujuoja (≈)', ops: [{ card: 'thigh', a: 'rebleed' }] },
      EVAC
    ]),
    out: {
      opt: { n: 'Optimali', d: 'Viskas laiku: kraujavimas sustabdytas iki 0:28, NDC 0:35, TXA, kraujas + kalcis, HPMK', ops: [
        [1560, [{ o2: 'NonRebreatherMask', flow: 15 }]], [1620, [{ card: 'amp', a: 'tqre' }]], [1680, [{ card: 'thigh', a: 'pack' }]], [1740, [{ card: 'ptx', a: 'seal' }]],
        [1860, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]], [1920, [{ fluid: 'Blood', ml: 500, rate: 50 }]], [1980, [{ tx: 'hpmk' }]], [2040, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IO' }]],
        [2100, [{ card: 'ptx', a: 'ndc' }]], [2160, [{ drug: 'cro', dose: 2, unit: 'g', route: 'IV' }]], [2520, [{ drug: 'ca', dose: 30, unit: 'ml', route: 'IO' }, { card: 'ptx', a: 'ndc' }]]] },
      typ: { n: 'Tipinė', d: 'Šlaunis rasta 0:34, NDC 0:44 (pavėluota), be kalcio ir HPMK', ops: [
        [1680, [{ card: 'amp', a: 'tqre' }]], [1860, [{ card: 'ptx', a: 'seal' }]], [2040, [{ card: 'thigh', a: 'pack' }]], [2160, [{ drug: 'txa', dose: 2, unit: 'g', route: 'IV' }]],
        [2280, [{ fluid: 'Blood', ml: 500, rate: 50 }]], [2400, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2460, [{ drug: 'ket', dose: 25, unit: 'mg', route: 'IV' }]], [2640, [{ card: 'ptx', a: 'ndc' }]], [3180, [{ card: 'ptx', a: 'ndc' }]]] },
      err: { n: 'Su klaidomis', d: 'Turniketas neužveržtas, šlaunis nerasta, kraujo nėra, NDC 0:41 – trauminis sustojimas ~0:50, atvežamas gaivinamas (HOTT)', ops: [
        [2400, [{ o2: 'NonRebreatherMask', flow: 10 }]], [2460, [{ card: 'ptx', a: 'ndc' }]]] }
    },
    role1At: 3480,
    exp: [
      { ph: 'medevac', id: 'sweep', n: 'Kraujo paieška → kairė šlaunis kontroliuota', c: 'K', win: 180, done: sc => (by(sc, 'thigh') || {}).ctl },
      { ph: 'medevac', id: 'tq', n: 'Turniketo patikra → užveržtas / antras', c: 'K', win: 180, done: sc => cardT(sc, 'amp', ['tqre', 'tq'], 1400) },
      { ph: 'medevac', id: 'ndc', n: 'NDC dešinėje (krūtinės žaizda + šokas + SpO₂ < 90)', c: 'K', from: sc => vhAt(sc, 1500, x => x[3] != null && x[3] < 90 && (x[2] < 100 || x[1] > 120)), win: 300, done: sc => cardT(sc, 'ptx', ['ndc', 'fthor']) },
      X.mTxa(),
      { ph: 'medevac', id: 'seal', n: 'Krūtinės lipdukas', c: 'S', win: 480, done: sc => cardT(sc, 'ptx', ['seal']) },
      X.mO2('S', 'Deguonis (šokas, krūtinės trauma)'),
      { ph: 'medevac', id: 'blood', n: 'Kraujas iki tikslo (radialinis pulsas / sAKS 100)', c: 'S', win: 900, done: sc => bloodT(sc) },
      X.mCa, X.mHpmk(), X.mPain, X.mAbx('Antibiotikas (ceftriaksonas 2 g IV / IO)'),
      { ph: 'medevac', id: 'redo', n: 'Pakartotinė NDC (ta pati vieta, nauja adata)', c: 'S', when: sc => evAt(sc, 'kink') != null, from: sc => evAt(sc, 'kink'), win: 180, done: sc => evAt(sc, 'kink') != null ? cardT(sc, 'ptx', ['ndc', 'fthor'], evAt(sc, 'kink')) : null },
      X.mMist,
      X.rProbes,
      { ph: 'role1', id: 'fthor', n: 'Pirštinė torakostomija / drenas dešinėje', c: 'K', win: 300, done: (sc, p0) => cardT(sc, 'ptx', ['fthor', 'tube'], p0) },
      { ph: 'role1', id: 'la', n: 'Vietinė nejautra (lidokainas) prieš torakostomiją (sąmoningas)', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0) != null, done: sc => { const f = cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0), l = drugT(sc, 'lido', sc.r1t0 || 0); return l != null && l <= f ? l : false; }, bad: 'be nejautros' },
      { ph: 'role1', id: 'drain', n: 'Krūtinės drenas po torakostomijos', c: 'S', when: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0) != null, from: sc => cardT(sc, 'ptx', ['fthor'], sc.r1t0 || 0), win: 900, done: (sc, p0) => cardT(sc, 'ptx', ['tube'], p0) || cardT(sc, 'htx', ['htube'], p0) },
      { ph: 'role1', id: 'rtq1', n: 'Atsileidęs turniketas vėl užveržtas', c: 'K', when: sc => evAt(sc, 'rtq') != null, from: sc => evAt(sc, 'rtq'), win: 120, done: sc => cardT(sc, 'amp', ['tqre', 'tq'], evAt(sc, 'rtq') || 0) },
      X.rCa, X.rTxa, X.rWarm, X.rAbx(), X.rHi, X.rAtm
    ]
  };
  const LIST = [LUSIS, ERELIS, SERNAS, STUMBRAS, VILKAS];
  const get = id => LIST.find(s => s.id === id);

  // ── vertinimas: [{n, c, st: ok|bad|late|wait|na, t, txt}] fazei ──
  function evaluate(sc, phase, now) {
    const S = get(sc.scen && sc.scen.id); if (!S) return [];
    const P = ph(sc, phase); if (!P) return [];
    const p0 = phase === 'medevac' ? S.start.medevac : P.t0, end = P.t1 != null ? P.t1 : now;
    return S.exp.filter(e => e.ph === phase && (!e.when || e.when(sc))).map(e => {
      let d = e.done(sc, p0); const nx = phase === 'medevac' ? ph(sc, 'role1') : null, lim0 = nx ? nx.t0 : P.t1; if (phase === 'medevac' && typeof d === 'number' && lim0 != null && d > lim0 + 1) d = null;   // MEDEVAC vertinama tik tai, kas atlikta iki perdavimo į Role 1
      const from = typeof e.from === 'function' ? e.from(sc) : e.from != null ? e.from : p0;
      const lim = e.abs != null ? e.abs : e.win != null && from != null ? from + e.win : null;
      if (from == null && d == null) return { id: e.id, n: e.n, c: e.c, st: P.t1 != null ? 'na' : 'wait', t: null, txt: P.t1 != null ? 'indikacijos nebuvo' : 'kai atsiras indikacija', win: e.win != null ? '≤ ' + Math.round(e.win / 60) + ' min' : '' };
      let st, txt = '';
      if (d === 'ok') { st = 'ok'; }
      else if (d === false) { st = 'bad'; txt = e.bad ? e.bad : e.id === 'txa1' ? 'kartota' : e.id === 'target' ? 'sAKS > 100' : e.id === 'avpu' ? 'neįrašytas' : 'ne visi punktai'; }
      else if (d != null && d !== true) { st = lim != null && d > lim ? 'late' : 'ok'; txt = e.abs != null ? mm(d) + ' nuo sužeidimo' : d < from ? 'atlikta anksčiau (' + mm(d) + ')' : Math.max(0, Math.round((d - from) / 60)) + ' min'; }
      else if (lim != null && end > lim) { st = 'bad'; txt = 'neatlikta'; }
      else { st = P.t1 != null ? 'bad' : 'wait'; txt = P.t1 != null ? 'neatlikta' : lim != null ? 'liko ' + Math.max(0, Math.round((lim - now) / 60)) + ' min' : ''; }
      const win = e.abs != null ? '≤ ' + mm(e.abs) : e.win != null ? '≤ ' + Math.round(e.win / 60) + ' min' : '';
      return { id: e.id, n: e.n, c: e.c, st, t: d, txt, win };
    });
  }

  // ── perdavimo etalonai (programėlė žino tiesą iš žurnalo) ──
  const injTxt = (sc, mist) => sc.inj.filter(j => j.k !== 'pain' && !(mist && j.hideMist && j.state !== 'drained' && txT(sc, 'efast') == null)).map(j => (j.lbl || PCAT.injName(j).name) + (j.state ? ': ' + (PCAT.STATES[j.state] || j.state).toLowerCase() : '')).join('; ');
  function txList(sc, upTo) {
    const T = [];
    logs(sc).filter(l => l.kind === 'tx' && !l.ev && l.code !== 'probes' && (upTo == null || l.t <= upTo) && !l.star && ['tq', 'tqre', 'jtq', 'tqloose'].indexOf(l.a) < 0 && !/^CLS: turniket/.test(l.n)).forEach(l => { const k = l.n.split(' (')[0].replace(/ – (Dešin|Kair)[^;]*$/, m0 => m0.length > 40 ? '' : m0) + ' ' + mm(l.t); if (T.indexOf(k) < 0) T.push(k); });
    return T;
  }
  function handItems(P, kind) {
    const sc = P.sc, v = P.v || {}, t = P.simt, S = get(sc.scen && sc.scen.id);
    const tq = sc.inj.filter(j => j.tq0 != null).map(j => 'turniketas (' + (j.lbl ? j.lbl.toLowerCase() : PCAT.injName(j).name.toLowerCase()) + ') uždėtas ' + mm(j.tq0) + ', prieš ' + Math.round((t - j.tq0) / 60) + ' min' + (j.tqOn != null && j.tqOn > j.tq0 + 1 ? ', užveržtas ' + mm(j.tqOn) : '') + (j.tqOn == null ? ', ATSILEIDĘS' : '')).join('; ');
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
      if (j.tq0 != null) R.push([j.tqOn != null ? 'ok' : 'bad', 'Turniketas – ' + nm, 'uždėtas ' + mm(j.tq0) + ' – prieš ' + Math.round((t - j.tq0) / 60) + ' min' + (j.tqOn == null ? ' · ATSILEIDĘS' : '') + ' · konversija netaikoma esant šokui / amputacijai']);
      else if (PCAT.BAD.indexOf(j.state) >= 0) R.push(['bad', nm, 'kraujuoja – nekontroliuota']);
      else R.push(['ok', nm, (PCAT.STATES[j.state] || j.state).toLowerCase() + (j.ctl != null ? ' ' + mm(j.ctl) : '')]);
    });
    sc.inj.filter(j => j.k === 'ptx' || j.k === 'optx').forEach(j => { const n = count(sc, l => l.iid === j.id && l.a === 'ndc'); R.push([j.state === 'decomp' ? 'warn' : PCAT.BAD.indexOf(j.state) >= 0 ? 'bad' : 'ok', j.lbl || PCAT.injName(j).name, (PCAT.STATES[j.state] || j.state).toLowerCase() + (n ? ' · NDC ×' + n + ' – adata nepavyksta 40–50 %, patikrinkite (ETC)' : '')]); });
    const tx = drugT(sc, 'txa'); R.push([tx != null ? 'ok' : 'warn', 'TXA', tx != null ? '2 g ' + mm(tx) + ' – nekartoti' : 'neskirta – geriausia per 90 min nuo sužeidimo (liko ' + Math.max(0, Math.round((5400 - t) / 60)) + ' min)']);
    const bu = count(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || ''));
    R.push([bu ? 'ok' : 'warn', 'Kraujas', bu ? bu + ' vnt.' : 'neperpilta']);
    const ca = first(sc, l => l.code === 'drug' && /^(ca|cacl)$/.test(l.id || '')); if (bu) R.push([ca != null ? 'ok' : 'bad', 'Kalcis', ca != null ? mm(ca) : 'neskirtas po 1-ojo vieneto']);
    R.push([txT(sc, 'hpmk') != null ? 'ok' : 'bad', 'Hipotermijos prevencija', txT(sc, 'hpmk') != null ? 'HPMK ' + mm(txT(sc, 'hpmk')) : 'nėra' + (P.v && P.v.temp ? ' – T ' + String(P.v.temp).replace('.', ',') : '')]);
    const ab = first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')); R.push([ab != null ? 'ok' : 'warn', 'Antibiotikas', ab != null ? mm(ab) : 'neskirtas – ETC: per 1 val. nuo sužeidimo']);
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
      add('C', 'H: kraujas', 'hipovolemija – greitas perpylimas', 32, { k: 'fluid' }, 'crit');
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
        else add('C', 'Kraujas, skubi evakuacija – ' + nm.toLowerCase(), 'nesuspaudžiamas kraujavimas', 18, { k: 'fluid' }, 'crit');
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
      if (j.k === 'htx' && j.state !== 'drained' && r1 && !sc.inj.some(x => x.side === j.side && (x.k === 'ptx' || x.k === 'optx') && x.state === 'thor')) { const a = pick(['htube']); if (a) add('B', 'Krūtinės drenas – ' + (j.side === 'R' ? 'dešinė' : 'kairė'), 'hemotoraksas' + (spo2 != null ? ' · SpO₂ ' + spo2 : ''), spo2 < 92 ? 14 : 8, { k: 'card', x: j.id + '|htube' }); }
      if (j.k === 'aw' && bad(j)) { const a = pick(r1 ? ['ett', 'sga', 'npa'] : ['npa', 'sga', 'cric']); if (a) add('A', a[1], 'kvėpavimo takų obstrukcija' + (spo2 != null ? ' · SpO₂ ' + spo2 : ''), 28, { k: 'card', x: j.id + '|' + a[0] }, 'crit'); }
      if (j.k === 'tam' && j.state !== 'drained' && r1) { const a = pick(['pcd']); if (a) add('C', a[1], 'tamponada – obstrukcinis šokas', 24, { k: 'card', x: j.id + '|pcd' }, 'crit'); }
    });
    const bleeding = sc.inj.some(j => j.k === 'bleed' || j.k === 'htx');
    // C
    if (bleeding && !gave('txa') && t < 10800) add('C', 'TXA 2 g IV / IO lėtai', (r1 ? 'geriausia per 90 min' : 'ne vėliau 3 val.') + ' – liko ' + Math.max(0, Math.round(((r1 && t < 5400 ? 5400 : 10800) - t) / 60)) + ' min', 10 + (shock ? 4 : 0), { k: 'drug', id: 'txa' });
    const bu = count(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || '')), left = sc.kit ? Math.max(0, sc.kit.max - Math.ceil(sc.kit.used)) : 0, running = (sc.inf || []).some(f => /Blood|PackedRBC|Plasma/.test(f.cmp) && t - f.t0 < f.tot);
    // AKS tikslas: be GST – ≈ 100 (Role 1 90–110, gaivinant krauju – JTS; MEDEVAC – radialinis pulsas / sAKS 100, TCCC 2026);
    // GST – Role 1 ≥ 110 (JTS), MEDEVAC > 100 arba normalus radialinis pulsas (TCCC 2026). Kraujas siūlomas, kol žemiau tikslo.
    const tbi = sc.inj.some(j => j.k === 'tbi' && j.sev >= 0.5);
    const tgt = tbi ? (r1 ? 110 : 101) : 100, hiLim = tbi ? 140 : 110;
    const tgtTxt = tbi ? (r1 ? 'GST – sAKS ≥ 110 (JTS)' : 'GST – sAKS > 100 arba normalus radialinis pulsas (TCCC 2026)') : r1 ? '≈ 100 (90–110), kai gaivinama krauju (JTS)' : 'radialinis pulsas, sąmonė ar sAKS 100 (TCCC 2026)';
    const needBlood = sys != null && (sys < tgt || (hr != null && hr / Math.max(1, sys) >= 1.3));
    if (needBlood && !running && left > 0) add('C', 'Kraujas 1 vnt.', (sys >= tgt ? 'ŠSD ' + hr + ' > sAKS ' + sys + ' (šoko indeksas)' : 'sAKS ' + sys) + ' – tikslas ' + tgtTxt + ' · liko ' + left + ' vnt.', sys < 70 ? 22 : sys < (tbi ? tgt : 90) ? 14 : 12, { k: 'fluid' }, sys < 70 ? 'crit' : 'warn');
    if (r1 && sys != null && sys > hiLim && running) add('C', 'Stabdyti kraują – virš tikslo', 'sAKS ' + sys + ' > ' + hiLim + ' (tikslas ' + tgtTxt + ')', 9, { k: 'view', x: 'med' });
    const caN = count(sc, l => l.code === 'drug' && /^(ca|cacl)$/.test(l.id || ''));
    const caNeed = bu >= 1 && (caN === 0 || (r1 && Math.floor(bu / 4) > caN - 1));
    if (caNeed) add('C', 'Kalcio gliukonatas 10 % 30 ml', caN === 0 ? 'po 1-ojo kraujo vieneto – dar neskirtas' : 'kas 4 vienetus', 9, { k: 'drug', id: 'ca' });
    if (r1 && sc.reprobe != null && !logs(sc).some(l => l.t >= sc.reprobe && /^(ecgon|spo2on|nibpon|probes)$/.test(l.code || ''))) add('M', 'Prijungti monitoriaus jutiklius', 'monitorius rodo „– – –“, kol komanda neprijungs EKG, SpO₂, AKS', 9, { k: 'ev', x: 'probeson' });
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
    const painN = sc.inj.some(j => j.k === 'pain' && j.state !== 'stopped') && t - lastAn > 1800;
    if (painN) add('P', r1 ? 'Analgezija (ketaminas 0,2–0,3 mg/kg IV)' : 'Ketaminas 25 mg IV lėtai', 'stiprus skausmas · prieš tai AVPU', 4, { k: 'drug', id: 'ket' });
    S.sort((a, b) => b.s - a.s);
    const seen = {}; return S.filter(x => (seen[x.n] ? false : (seen[x.n] = 1)));
  }
  return { LIST, get, evaluate, handItems, takeover, advise, mm, by, cardT, txT, drugT };
})();
if (typeof module !== 'undefined') module.exports = PSCEN;
