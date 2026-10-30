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

  // ── scenarijai (paruošti scenarijai – kol kas nenaudojami; laisvas scenarijus kuriamas vedlyje) ──
  const LIST = [];
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
  const injTxt = (sc, mist) => sc.inj.filter(j => j.k !== 'pain' && !(mist && j.hideMist && j.state !== 'drained' && txT(sc, 'efast') == null)).map(j => (j.lbl || PCAT.injName(j).name) + (j.state ? ': ' + (PCAT.STATES[j.state] || j.state).toLowerCase() : '')).join('; ');
  function txList(sc, upTo) {
    const T = [];
    logs(sc).filter(l => l.kind === 'tx' && (upTo == null || l.t <= upTo) && !l.star && ['tq', 'tqre', 'jtq', 'tqloose'].indexOf(l.a) < 0 && !/^CLS: turniket/.test(l.n)).forEach(l => { const k = l.n.split(' (')[0].replace(/ – (Dešin|Kair)[^;]*$/, m0 => m0.length > 40 ? '' : m0) + ' ' + mm(l.t); if (T.indexOf(k) < 0) T.push(k); });
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
    const ca = drugT(sc, 'ca'); if (bu) R.push([ca != null ? 'ok' : 'bad', 'Kalcis', ca != null ? mm(ca) : 'neskirtas po 1-ojo vieneto']);
    R.push([txT(sc, 'hpmk') != null ? 'ok' : 'bad', 'Hipotermijos prevencija', txT(sc, 'hpmk') != null ? 'HPMK ' + mm(txT(sc, 'hpmk')) : 'nėra' + (P.v && P.v.temp ? ' – T ' + String(P.v.temp).replace('.', ',') : '')]);
    const k = drugT(sc, 'ket'), a = txT(sc, 'avpu'); if (k != null) R.push([a != null && a <= k ? 'ok' : 'warn', 'AVPU prieš ketaminą', a != null && a <= k ? 'įrašytas' : 'neįrašytas – vaisto poveikio neatskirsite nuo šoko']);
    const ab = first(sc, l => l.code === 'drug' && /^(cro|amx|ert|cfd|mox|cfx)$/.test(l.id || '')); R.push([ab != null ? 'ok' : 'warn', 'Antibiotikas', ab != null ? mm(ab) : 'neskirtas – ETC: per 1 val. nuo sužeidimo']);
    const iv = txT(sc, 'iv'), io = txT(sc, 'io'); R.push([iv != null && io != null ? 'ok' : iv != null || io != null ? 'warn' : 'bad', 'Kraujagyslių prieiga', ([iv != null ? 'IV' : '', io != null ? 'IO' : ''].filter(Boolean).join(' + ') || 'nėra') + (iv != null && io != null ? '' : ' – reikia antros linijos (kraujas ir vaistai atskirai)')]);
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
    const access = did('iv') || did('io');
    // C
    if (bleeding && !gave('txa') && t < 10800) add('C', 'TXA 2 g IV / IO lėtai', (r1 ? 'geriausia per 90 min' : 'ne vėliau 3 val.') + ' – liko ' + Math.max(0, Math.round(((r1 && t < 5400 ? 5400 : 10800) - t) / 60)) + ' min', 10 + (shock ? 4 : 0), { k: 'drug', id: 'txa' });
    const bu = count(sc, l => l.code === 'fluid' && /Blood|PackedRBC|Plasma/.test(l.cmp || '')), left = sc.kit ? Math.max(0, sc.kit.max - Math.ceil(sc.kit.used)) : 0, running = (sc.inf || []).some(f => /Blood|PackedRBC|Plasma/.test(f.cmp) && t - f.t0 < f.tot);
    const tgtLow = r1 ? 80 : 100;
    const needBlood = sys != null && (r1 ? sys < 80 : (sys < 100 || (hr != null && hr / Math.max(1, sys) >= 1.3)));
    if (needBlood && !running && left > 0) add('C', 'Kraujas 1 vnt.', (sys >= tgtLow ? 'ŠSD ' + hr + ' > sAKS ' + sys + ' (šoko indeksas)' : 'sAKS ' + sys) + ' – tikslas ' + (r1 ? '80–90 (ETC)' : 'radialinis pulsas, sąmonė ar sAKS 100 (MARCH)') + ' · liko ' + left + ' vnt.', sys < 70 ? 22 : 12, { k: 'fluid' }, sys < 70 ? 'crit' : 'warn');
    if (r1 && sys != null && sys > 95 && running) add('C', 'Stabdyti kraują – virš tikslo', 'sAKS ' + sys + ' > 90 (ETC tikslas 80–90)', 9, { k: 'view', x: 'med' });
    const caN = count(sc, l => l.code === 'drug' && l.id === 'ca');
    const caNeed = bu >= 1 && (caN === 0 || (r1 && Math.floor(bu / 4) > caN - 1));
    if (caNeed) add('C', 'Kalcio gliukonatas 10 % 30 ml', caN === 0 ? 'po 1-ojo kraujo vieneto – dar neskirtas' : 'kas 4 vienetus', 9, { k: 'drug', id: 'ca' });
    if (r1 && sc.reprobe != null && !logs(sc).some(l => l.t >= sc.reprobe && /^(ecgon|spo2on|nibpon|probes)$/.test(l.code || ''))) add('M', 'Prijungti monitoriaus daviklius', 'monitorius rodo „– – –“, kol komanda neprijungs EKG, SpO₂, AKS', 9, { k: 'ev', x: 'probeson' });
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
