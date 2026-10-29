// ───────── Pulse katalogai: aplinkos, pacientai, sužalojimai, gydymas (MARCH-PAWS), įvykiai, mechanizmų šablonai ─────────
const PCAT = (() => {
  // aplinka: trukmių koeficientas, kas prieinama
  const SETTINGS = {
    medevac: { n: 'MEDEVAC', d: 'Evakuacija transporte: ribotos priemonės, triukšmas, vibracija, perdavimas atvykus', k: 1.3, no: ['tube', 'ett', 'pcd'], blood: 2 },
    role1: { n: 'Role 1', d: 'Bataliono medicinos punktas: kraujas, RSI, krūtinės drenas, daugiau vaistų', k: 1, no: [], blood: 6 }
  };
  const PATIENTS = [
    ['Soldier@0s.json', 'Karys (vyras)', '~25 m., 80 kg – numatytasis'],
    ['StandardMale@0s.json', 'Vyras', '44 m., 77 kg'],
    ['StandardFemale@0s.json', 'Moteris', '44 m., 64 kg'],
    ['Underweight@0s.json', 'Mažo svorio', 'liesas pacientas – mažesnis kraujo tūris'],
    ['Overweight@0s.json', 'Antsvoris', 'didesnis svoris']
  ];
  // kraujavimo vietos: [Pulse skyrius, pavadinimas, grupė: limb – galima turniketas, junc – jungtinė (kirkšnis/pažastis), torso – nesuspaudžiama]
  const LOCS = [
    ['RightLeg', 'Dešinė koja (šlaunis)', 'limb'], ['LeftLeg', 'Kairė koja (šlaunis)', 'limb'],
    ['RightArm', 'Dešinė ranka', 'limb'], ['LeftArm', 'Kairė ranka', 'limb'],
    ['RightLeg|j', 'Dešinė kirkšnis', 'junc'], ['LeftLeg|j', 'Kairė kirkšnis', 'junc'],
    ['RightArm|j', 'Dešinė pažastis', 'junc'], ['LeftArm|j', 'Kairė pažastis', 'junc'],
    ['Spleen', 'Blužnis', 'torso'], ['Liver', 'Kepenys', 'torso'], ['SmallIntestine', 'Plonoji žarna', 'torso'], ['LargeIntestine', 'Storoji žarna', 'torso'],
    ['Splanchnic', 'Pilvo organai (kiti)', 'torso'], ['RightKidney', 'Dešinis inkstas', 'torso'], ['LeftKidney', 'Kairis inkstas', 'torso'],
    ['Aorta', 'Aorta', 'torso'], ['VenaCava', 'Tuščioji vena', 'torso'], ['Muscle', 'Minkštieji audiniai', 'soft'], ['Skin', 'Oda (daug žaizdų)', 'soft']
  ];
  const SEV = [['l', 'Lengvas', 0.2], ['m', 'Vidutinis', 0.45], ['s', 'Sunkus', 0.7], ['x', 'Masyvus', 1.0]];
  const SIDES = [['L', 'Kairė'], ['R', 'Dešinė']];
  // sužalojimų tipai: kas pasirenkama (loc – vietos, side – pusė, sev – sunkumas), kaip paverčiama Pulse veiksmu
  const INJ = [
    { k: 'bleed', n: 'Kraujavimas', ico: '🩸', pick: ['loc', 'sev'] },
    { k: 'ptx', n: 'Įtampos pneumotoraksas', ico: '🫁', pick: ['side', 'sev'], open: false },
    { k: 'optx', n: 'Atviras pneumotoraksas', ico: '🫁', pick: ['side', 'sev'], open: true },
    { k: 'htx', n: 'Hemotoraksas', ico: '🫁', pick: ['side', 'sev'], sup: 'htx' },
    { k: 'aw', n: 'Kvėpavimo takų obstrukcija', ico: '😮', pick: ['sev'], sevs: [['l', 'Dalinė', 0.35], ['m', 'Vidutinė', 0.55], ['s', 'Sunki', 0.75], ['x', 'Visiška', 0.95]] },
    { k: 'tbi', n: 'Galvos smegenų trauma', ico: '🧠', pick: ['sev'], sevs: [['l', 'Lengva', 0.3], ['m', 'Vidutinė', 0.55], ['s', 'Sunki', 0.75], ['x', 'Labai sunki', 0.95]] },
    { k: 'tam', n: 'Širdies tamponada', ico: '❤️', pick: ['sev'], sevs: [['m', 'Lėta (40 ml/min)', 40], ['s', 'Greita (100 ml/min)', 100]] },
    { k: 'burn', n: 'Nudegimai', ico: '🔥', pick: ['sev'], sevs: [['l', '10 %', 0.1], ['m', '20 %', 0.2], ['s', '40 %', 0.4], ['x', '60 %', 0.6]] },
    { k: 'bronch', n: 'Bronchų spazmas / inhaliacinė trauma', ico: '💨', pick: ['sev'], sup: 'bronch' },
    { k: 'pain', n: 'Stiprus skausmas', ico: '⚡', pick: ['sev'], sup: 'pain', sevs: [['m', 'Vidutinis', 0.5], ['s', 'Stiprus', 0.8], ['x', 'Nepakeliamas', 1]] }
  ];
  const injBy = k => INJ.find(i => i.k === k);
  const locBy = l => LOCS.find(x => x[0] === l);
  const cmpOf = l => String(l).split('|')[0];
  // sužalojimo pradžios Pulse veiksmas
  function injAct(j) {
    switch (j.k) {
      case 'bleed': return { k: 'hem', cmp: cmpOf(j.loc), sev: j.sev };
      case 'ptx': case 'optx': return { k: 'tpx', side: j.side, sev: j.sev, open: j.k === 'optx' };
      case 'htx': return { k: 'htx', side: j.side, sev: j.sev };
      case 'aw': return { k: 'aw', sev: j.sev };
      case 'tbi': return { k: 'tbi', sev: j.sev };
      case 'tam': return { k: 'eff', rate: j.sev };
      case 'burn': return { k: 'burn', tbsa: j.sev };
      case 'bronch': return { k: 'bronch', sev: j.sev };
      case 'pain': return { k: 'pain', sev: j.sev, loc: 'LeftLeg' };
    }
    return null;
  }
  function injName(j) {
    const t = injBy(j.k) || { n: j.k };
    const sv = (t.sevs || SEV).find(s => Math.abs(s[2] - j.sev) < 1e-6);
    let w = t.n;
    if (j.loc) w += ' – ' + (locBy(j.loc) || [0, j.loc])[1].toLowerCase();
    if (j.side) w += ' – ' + (j.side === 'R' ? 'dešinė' : 'kairė');
    return { name: w, sev: sv ? sv[1] : '' };
  }
  // būsenų perėjimai kortelėse: [kodas, mygtukas, nauja būsena, Pulse veiksmai (funkcija), kas atlieka: team|instr, trukmė]
  // bleed: bleeding → tq | packed | pdress ; tq → tq_loose (instr) → tq (team)
  function cardActions(j) {
    const L = locBy(j.loc) || [0, '', 'limb'], g = L[2], stop = { k: 'hem', cmp: cmpOf(j.loc), sev: 0 }, on = { k: 'hem', cmp: cmpOf(j.loc), sev: j.sev };
    const A = [];
    if (j.k === 'bleed') {
      if (j.state === 'bleeding' || j.state === 'rebleed') {
        if (g === 'limb') A.push(['tq', 'Turniketas', 'tq', [stop], 'team', '30–60 s']);
        if (g === 'limb' || g === 'junc' || g === 'soft') A.push(['pack', 'Tamponavimas + spaudimas', 'packed', [stop], 'team', '3 min']);
        if (g === 'limb' || g === 'soft') A.push(['pdress', 'Spaudžiamasis tvarstis', 'pdress', [{ k: 'hem', cmp: cmpOf(j.loc), sev: j.sev > 0.5 ? j.sev * 0.3 : 0 }], 'team', '1–2 min']);
        if (g === 'junc') A.push(['jtq', 'Jungtinis turniketas', 'tq', [stop], 'team', '1–2 min']);
      }
      if (j.state === 'tq') { A.push(['tqloose', 'Atsileido turniketas', 'tq_loose', [on], 'instr', '']); A.push(['tqconv', 'Konversija (tvarstis)', 'pdress', [], 'team', '10 min']); }
      if (j.state === 'tq_loose') A.push(['tqre', 'Turniketas perveržtas', 'tq', [stop], 'team', '30 s']);
      if (j.state === 'packed' || j.state === 'pdress') A.push(['rebleed', 'Vėl kraujuoja', 'rebleed', [on], 'instr', '']);
      if (g === 'torso' && j.state !== 'stopped') A.push(['slow', 'Sulėtėjo (savaime / chirurgija)', 'stopped', [stop], 'instr', '']);
      if (j.state !== 'bleeding' && j.state !== 'rebleed' && j.state !== 'tq_loose' && g === 'torso') A.push(['rebleed', 'Vėl kraujuoja', 'rebleed', [on], 'instr', '']);
    }
    if (j.k === 'ptx' || j.k === 'optx') {
      if (j.state === 'active' || j.state === 'retension') {
        A.push(['ndc', 'Adatinė dekompresija', 'decomp', [{ k: 'ndc', side: j.side }], 'team', '1–2 min']);
        if (j.k === 'optx' || j.state === 'active') A.push(['occl', 'Okliuzinis tvarstis', j.k === 'optx' ? 'occl' : j.state, [{ k: 'occl', side: j.side }], 'team', '30–60 s']);
      }
      if (j.state === 'decomp' || j.state === 'occl') A.push(['retens', 'Vėl įsitempė', 'retension', [{ k: 'tpx', side: j.side, sev: j.sev, open: false }], 'instr', '']);
      if (j.state !== 'drained') A.push(['tube', 'Krūtinės drenas', 'drained', [{ k: 'tube', side: j.side }], 'team', '10–15 min']);
    }
    if (j.k === 'htx' && j.state !== 'drained') A.push(['tube', 'Krūtinės drenas', 'drained', [{ k: 'tube', side: j.side }], 'team', '10–15 min']);
    if (j.k === 'aw') {
      if (j.state !== 'secured') {
        A.push(['pos', 'Galvos atlošimas / žandikaulio stūmimas', 'partial', [{ k: 'aw', sev: Math.round(j.sev * 0.6 * 100) / 100 }], 'team', '10–30 s']);
        A.push(['npa', 'Nosiaryklės vamzdelis (NPA)', 'partial', [{ k: 'aw', sev: Math.round(j.sev * 0.4 * 100) / 100 }], 'team', '30 s']);
        A.push(['suct', 'Atsiurbimas', j.state, [{ k: 'aw', sev: Math.round(j.sev * 0.7 * 100) / 100 }], 'team', '15–30 s']);
        A.push(['sga', 'Supraglotinis (i-gel)', 'secured', [{ k: 'sga' }], 'team', '1 min']);
        A.push(['cric', 'Krikotirotomija', 'secured', [{ k: 'cric' }], 'team', '2–3 min']);
        A.push(['ett', 'Intubacija (RSI)', 'secured', [{ k: 'intub' }], 'team', '5–10 min']);
      }
      if (j.state === 'partial' || j.state === 'secured') A.push(['aww', 'Vėl užsikimšo', 'active', [{ k: 'aw', sev: j.sev }], 'instr', '']);
    }
    if (j.k === 'tam' && j.state !== 'drained') A.push(['pcd', 'Perikardiocentezė', 'drained', [{ k: 'pcd', drain: 150, dur: 120 }], 'team', '5–10 min']);
    if (j.k === 'tbi') A.push(['tbiup', 'Blogėja (ICP ↑)', 'active', [{ k: 'tbi', sev: Math.min(1, j.sev + 0.2) }], 'instr', '']);
    if (j.k === 'pain') A.push(['painx', 'Skausmas praeina', 'stopped', [{ k: 'pain', sev: 0 }], 'instr', '']);
    // sunkumo keitimas (instruktorius)
    if (['bleed', 'aw', 'ptx', 'optx', 'htx', 'bronch', 'tbi', 'pain'].indexOf(j.k) >= 0) { A.push(['sevup', 'Stiprinti', '', null, 'instr', '']); A.push(['sevdn', 'Silpninti', '', null, 'instr', '']); }
    return A;
  }
  const STATES = { bleeding: 'Kraujuoja', rebleed: 'Vėl kraujuoja', tq: 'Turniketas užveržtas', tq_loose: 'Turniketas atsileidęs – kraujuoja', packed: 'Tamponuota', pdress: 'Spaudžiamasis tvarstis', stopped: 'Sustabdyta',
    active: 'Aktyvus', retension: 'Vėl įsitempęs', decomp: 'Dekompresuota', occl: 'Okliuzinis tvarstis', drained: 'Drenuota', partial: 'Iš dalies atverta', secured: 'Kvėpavimo takai užtikrinti' };
  const BAD = ['bleeding', 'rebleed', 'tq_loose', 'active', 'retension'];
  // ── gydymas (MARCH-PAWS) – bendri veiksmai, nesusiję su konkrečiu sužalojimu; param – parametrų lapas ──
  const TX = [
    ['M', 'Masyvus kraujavimas', [
      ['txa', 'TXA 2 g IV/IO', null, '10 min', 'log'],
      ['bleedsel', 'Kraujavimo kontrolė…', null, '', 'goto:pt']
    ]],
    ['A', 'Kvėpavimo takai', [
      ['recov', 'Šoninė (atsigavimo) padėtis', null, '30 s', 'log'],
      ['awsel', 'Kvėpavimo takų veiksmai…', null, '', 'goto:pt']
    ]],
    ['R', 'Kvėpavimas', [
      ['o2', 'Deguonis', 'o2', '1 min', ''],
      ['o2off', 'Deguonis nuimtas', null, '', 'o2off'],
      ['bvm', 'Ventiliacija maišu (BVM)', null, 'nuolat', 'log'],
      ['chestsel', 'Krūtinės veiksmai…', null, '', 'goto:pt']
    ]],
    ['C', 'Kraujotaka', [
      ['iv', 'IV kateteris', null, '1–2 min', 'log'], ['io', 'IO adata', null, '1 min', 'log'],
      ['fluid', 'Kraujas / skysčiai', 'fluid', '', ''],
      ['ca', 'Kalcis 1 g IV', null, '10 min', 'log']
    ]],
    ['H', 'Hipotermija / galva', [
      ['hpmk', 'Hipotermijos prevencija (HPMK)', null, '2–3 min', 'log'],
      ['head30', 'Galva pakelta 30°', null, '', 'log']
    ]],
    ['P', 'Skausmas', [
      ['drug', 'Vaistai', 'drug', '', '']
    ]],
    ['A2', 'Antibiotikai', [
      ['abx', 'Antibiotikas (ertapenemas 1 g / moksifloksacinas 400 mg)', null, '', 'log']
    ]],
    ['W', 'Žaizdos ir įtvarai', [
      ['wound', 'Žaizdų tvarstymas / patikra', null, '', 'log'], ['splint', 'Įtvaras', null, '5 min', 'log'], ['pelvic', 'Dubens diržas', null, '2 min', 'log']
    ]],
    ['Mon', 'Stebėjimas', [
      ['ecgon', 'EKG elektrodai uždėti', null, '', 'probe:ecg:1'], ['spo2on', 'SpO₂ daviklis uždėtas', null, '', 'probe:spo2:1'], ['nibpon', 'AKS manžetė uždėta', null, '', 'probe:nibp:1']
    ]]
  ];
  const O2DEV = [['NasalCannula', 'Kaniulės', [1, 2, 4, 6]], ['SimpleMask', 'Kaukė', [6, 8, 10]], ['NonRebreatherMask', 'Kaukė su rezervuaru', [10, 12, 15]]];
  const FLUIDS = [['Blood', 'Pilnas kraujas'], ['PackedRBC', 'Eritrocitų masė'], ['Plasma', 'Plazma'], ['Saline', 'NaCl 0,9 %'], ['LactatedRingers', 'Ringerio laktatas']];
  const VOLS = [250, 500, 1000];
  const RATES = [['pb', 'Slėgio maišas', 50], ['grav', 'Laša savaime', 25], ['15', 'Per 15 min', 0], ['30', 'Per 30 min', 0], ['60', 'Per 60 min', 0]];
  // vaistai: [Pulse medžiaga, pavadinimas, [[būdas, [dozės], vienetai]], pastaba]
  const DRUGS = [
    ['Ketamine', 'Ketaminas', [['IV', [20, 30, 50], 'mg'], ['IO', [20, 30, 50], 'mg'], ['IM', [50, 100], 'mg'], ['IN', [50, 100], 'mg']], 'analgezija 20–30 mg IV lėtai; anestezija 1–2 mg/kg'],
    ['Fentanyl', 'Fentanilis', [['IV', [0.025, 0.05, 0.1], 'mg'], ['IO', [0.05], 'mg'], ['IN', [0.05, 0.1], 'mg']], 'OTFC 800 mcg – modelyje kaip 50 mcg IV'],
    ['Morphine', 'Morfinas', [['IV', [2, 5, 10], 'mg'], ['IM', [10], 'mg']], ''],
    ['Naloxone', 'Naloksonas', [['IV', [0.1, 0.4, 2], 'mg'], ['IM', [0.4], 'mg'], ['IN', [2], 'mg']], 'kartoti kas 2–3 min'],
    ['Midazolam', 'Midazolamas', [['IV', [1, 2, 5], 'mg'], ['IM', [5], 'mg']], ''],
    ['Epinephrine', 'Adrenalinas', [['IM', [0.5], 'mg'], ['IV', [1], 'mg']], 'IV 1 mg – sustojus širdžiai'],
    ['Ondansetron', 'Ondansetronas', [['IV', [4], 'mg']], 'tik žurnale']
  ];
  // instruktoriaus įvykiai: [kodas, pavadinimas, grupė, aplinka (''|medevac|role1)]
  const EVENTS = [
    ['tqloose', 'Atsileido turniketas', 'kraujavimas', ''],
    ['newbleed', 'Naujas kraujavimas…', 'kraujavimas', ''],
    ['retens', 'Vėl įsitempė pneumotoraksas', 'kvėpavimas', ''],
    ['vomit', 'Vėmimas / aspiracija', 'kvėpavimas', ''],
    ['o2off', 'Nukrito deguonies kaukė', 'įranga', ''],
    ['ivout', 'Ištraukta IV / IO', 'įranga', ''],
    ['ecgoff', 'Atlipo EKG elektrodas', 'įranga', ''],
    ['spo2off', 'Nukrito SpO₂ daviklis', 'įranga', ''],
    ['nibpoff', 'Nuimta AKS manžetė', 'įranga', ''],
    ['painup', 'Skausmas stiprėja', 'būklė', ''],
    ['newinj', 'Naujas sužalojimas…', 'būklė', ''],
    ['vib', 'Vibracija (artefaktai)', 'transportas', 'medevac'],
    ['noise', 'Triukšmas – aliarmai negirdimi', 'transportas', 'medevac'],
    ['land', 'Nusileidimas – perdavimas (MIST)', 'transportas', 'medevac'],
    ['vf', 'Skilvelių virpėjimas', 'sustojimas', ''],
    ['asys', 'Asistolija', 'sustojimas', ''],
    ['rosc', 'ROSC – pulsas grįžo', 'sustojimas', '']
  ];
  // mechanizmų šablonai: [kodas, pavadinimas, aprašas, sužalojimai]
  const MECH = [
    ['ied', 'Sprogimas (SSU)', 'Kojos amputacija, skeveldros, pneumotoraksas, galva', [{ k: 'bleed', loc: 'RightLeg', sev: 1 }, { k: 'bleed', loc: 'LeftLeg', sev: 0.45 }, { k: 'ptx', side: 'R', sev: 0.35 }, { k: 'tbi', sev: 0.55 }]],
    ['gswc', 'Šautinė krūtinė', 'Atviras pneumotoraksas + hemotoraksas', [{ k: 'optx', side: 'L', sev: 0.6 }, { k: 'htx', side: 'L', sev: 0.45 }]],
    ['gswt', 'Šautinė šlaunis', 'Arterinis kraujavimas', [{ k: 'bleed', loc: 'RightLeg', sev: 0.7 }]],
    ['groin', 'Kirkšnies žaizda', 'Jungtinis kraujavimas – turniketas netinka', [{ k: 'bleed', loc: 'LeftLeg|j', sev: 0.7 }]],
    ['abd', 'Skeveldros pilve', 'Nesuspaudžiamas vidinis kraujavimas', [{ k: 'bleed', loc: 'Spleen', sev: 0.45 }, { k: 'bleed', loc: 'SmallIntestine', sev: 0.2 }]],
    ['fire', 'Šarvuočio gaisras', 'Nudegimai + inhaliacinė trauma', [{ k: 'burn', sev: 0.4 }, { k: 'aw', sev: 0.35 }, { k: 'bronch', sev: 0.45 }]],
    ['face', 'Veido trauma', 'Kvėpavimo takų obstrukcija', [{ k: 'aw', sev: 0.75 }]],
    ['tbi', 'Kritimas / galvos trauma', 'Sunki GST', [{ k: 'tbi', sev: 0.75 }, { k: 'aw', sev: 0.35 }]],
    ['tam', 'Skeveldra krūtinėje', 'Širdies tamponada', [{ k: 'tam', sev: 40 }]],
    ['none', 'Be sužalojimų', 'Sužalojimus pridėsite vėliau', []]
  ];
  return { SETTINGS, PATIENTS, LOCS, SEV, SIDES, INJ, injBy, locBy, cmpOf, injAct, injName, cardActions, STATES, BAD, TX, O2DEV, FLUIDS, VOLS, RATES, DRUGS, EVENTS, MECH };
})();
