// ───────── Pulse katalogai: aplinkos, pacientai, sužalojimai, gydymas (MARCH-PAWS), įvykiai, mechanizmų šablonai ─────────
const PCAT = (() => {
  // aplinka: trukmių koeficientas, kas prieinama
  const SETTINGS = {
    medevac: { n: 'MEDEVAC', d: 'Evakuacija transporte – procedūros ir vaistai pagal MARCH gidą; ribotos priemonės, triukšmas, vibracija, perdavimas atvykus', src: 'MARCH', no: ['tube', 'htube', 'hbleed', 'ett', 'fthor', 'pcd', 'ett_g'], blood: 2 },
    role1: { n: 'Role 1', d: 'Bataliono medicinos punktas – procedūros ir vaistai pagal ETC gidą; kraujas, RSI, krūtinės drenas', src: 'ETC', no: [], blood: 6 }
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
    if (j.lbl) return { name: j.lbl, sev: sv ? sv[1] : '' };   // scenarijaus pavadinimas
    let w = t.n;
    if (j.loc) w += ' – ' + (locBy(j.loc) || [0, j.loc])[1].toLowerCase();
    if (j.side) w += ' – ' + (j.side === 'R' ? 'dešinė' : 'kairė');
    return { name: w, sev: sv ? sv[1] : '' };
  }
  // būsenų perėjimai kortelėse: [kodas, mygtukas, nauja būsena, Pulse veiksmai (funkcija), kas atlieka: team|instr, trukmė]
  // bleed: bleeding → tq | packed | pdress ; tq → tq_loose (instr) → tq (team)
  function cardActions(j, set) {
    const no = (SETTINGS[set] || SETTINGS.role1).no;
    return cardActions0(j).filter(a => no.indexOf(a[0]) < 0);
  }
  function cardActions0(j) {
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
      if (j.state === 'tq_loose') A.push(['tqre', 'Turniketas vėl užveržtas', 'tq', [stop], 'team', '30 s']);
      if (j.state === 'packed' || j.state === 'pdress') A.push(['rebleed', 'Vėl kraujuoja', 'rebleed', [on], 'instr', '']);
      if (g === 'torso' && j.state !== 'stopped') A.push(['slow', 'Sulėtėjo (savaime / chirurgija)', 'stopped', [stop], 'instr', '']);
      if (j.state !== 'bleeding' && j.state !== 'rebleed' && j.state !== 'tq_loose' && g === 'torso') A.push(['rebleed', 'Vėl kraujuoja', 'rebleed', [on], 'instr', '']);
    }
    if (j.k === 'ptx' || j.k === 'optx') {
      if (j.state === 'active' || j.state === 'retension' || j.state === 'decomp') {
        A.push(['ndc', j.state === 'decomp' ? 'Pakartotinė adatinė dekompresija' : 'Adatinė dekompresija', 'decomp', [{ k: 'ndc', side: j.side }], 'team', '1–2 min']);
        A.push(['fthor', 'Pirštinė torakostomija', 'thor', [{ k: 'ndc', side: j.side, fthor: 1 }], 'team', '2–3 min']);
        if (j.k === 'optx') A.push(['occl', 'Okliuzinis tvarstis (krūtinės lipdukas)', j.k === 'optx' ? 'occl' : j.state, [{ k: 'occl', side: j.side }], 'team', '30–60 s']);
        if (j.k === 'ptx' && j.wound && !j.sealed) A.push(['seal', 'Krūtinės lipdukas (žaizda)', j.state, [], 'team', '30–60 s']);
        if (j.k === 'ptx' && j.wound && j.sealed) A.push(['burp', 'Atpūsti lipduką', j.state, [], 'team', '10 s']);
      }
      if (j.state === 'decomp' || j.state === 'occl' || j.state === 'thor') A.push(['retens', 'Vėl įsitempė', 'retension', [{ k: 'tpx', side: j.side, sev: j.sev, open: false }], 'instr', '']);
      if (j.state !== 'drained') A.push(['tube', 'Krūtinės drenas', 'drained', [{ k: 'ndc', side: j.side }], 'team', '10–15 min']);
    }
    if (j.k === 'htx' && j.state !== 'drained') A.push(['htube', 'Krūtinės drenas', 'drained', [{ k: 'tube', side: j.side }, { k: 'htx', side: j.side, sev: 0 }], 'team', '10–15 min']);
    if (j.k === 'htx' && j.state === 'drained') A.push(['hbleed', 'Kraujuoja toliau (drenu > 200 ml/val.)', 'active', [{ k: 'htx', side: j.side, sev: j.sev }], 'instr', '']);
    if (j.k === 'aw') {
      if (j.state !== 'secured') {
        A.push(['pos', 'Galvos atlošimas / žandikaulio stūmimas', 'partial', [{ k: 'aw', sev: Math.round(j.sev * 0.6 * 100) / 100 }], 'team', '10–30 s']);
        A.push(['npa', 'Nosiaryklės vamzdelis (NPA)', 'partial', [{ k: 'aw', sev: Math.round(j.sev * 0.4 * 100) / 100 }], 'team', '30 s']);
        A.push(['suct', 'Atsiurbimas', j.state, [{ k: 'aw', sev: Math.round(j.sev * 0.7 * 100) / 100 }], 'team', '15–30 s']);
        A.push(['sga', 'Supraglotinis (i-gel)', 'secured', [{ k: 'sga' }], 'team', '1 min']);
        A.push(['cric', 'Krikotiroidotomija', 'secured', [{ k: 'cric' }], 'team', '2–3 min']);
        A.push(['ett', 'Intubacija (RSI)', 'secured', [{ k: 'intub' }], 'team', '5–10 min']);
      }
      if (j.state === 'partial' || j.state === 'secured') A.push(['aww', 'Vėl užsikimšo', 'active', [{ k: 'aw', sev: j.sev }], 'instr', '']);
    }
    if (j.k === 'tam' && j.state !== 'drained') A.push(['pcd', 'Perikardiocentezė', 'drained', [{ k: 'pcd', drain: 150, dur: 120 }], 'team', '5–10 min']);
    if (j.k === 'pain') A.push(['painx', 'Skausmas praeina', 'stopped', [{ k: 'pain', sev: 0 }], 'instr', '']);
    // sunkumo keitimas (instruktorius)
    if (['bleed', 'aw', 'ptx', 'optx', 'htx', 'bronch', 'tbi', 'pain'].indexOf(j.k) >= 0) { A.push(['sevup', 'Stiprinti', '', null, 'instr', '']); A.push(['sevdn', 'Silpninti', '', null, 'instr', '']); }
    return A;
  }
  const STATES = { bleeding: 'Kraujuoja', rebleed: 'Vėl kraujuoja', tq: 'Turniketas užveržtas', tq_loose: 'Turniketas atsileidęs – kraujuoja', packed: 'Tamponuota', pdress: 'Spaudžiamasis tvarstis', stopped: 'Sustabdyta',
    active: 'Negydyta', retension: 'Vėl įsitempęs', decomp: 'Dekompresuota (adata)', thor: 'Pirštinė torakostomija – reikia dreno', relieved: 'Malšinamas (analgetikai)', occl: 'Okliuzinis tvarstis', drained: 'Drenuota', partial: 'Iš dalies atverta', secured: 'Kvėpavimo takai užtikrinti' };
  const BAD = ['bleeding', 'rebleed', 'tq_loose', 'active', 'retension'];
  // ── gydymas (MARCH-PAWS) – bendri veiksmai (vietiniai – ant sužalojimo kortelės) ──
  // [kodas, pavadinimas, lapas (o2|fluid|drug:<id>|null), trukmė, tipas (log|o2off|probe:…), aplinkos ('' – abi)]
  const TX = [
    ['M', 'Masyvus kraujavimas', [
      ['sweep', 'Kraujo paieška (rankomis per galūnes, kirkšnis, pažastis)', null, '1 min', 'log', ''],
      ['tqchk', 'Turniketų / tamponavimo patikra', null, '1 min', 'log', ''],
      ['txa', 'TXA 2 g IV/IO', 'drug:txa', '~20 min (≤ 1 ml/min)', '', ''],
      ['pelvic', 'Dubens diržas', null, '2 min', 'log', '']
    ]],
    ['A', 'Kvėpavimo takai', [
      ['recov', 'Šoninė (atsigavimo) padėtis', null, '30 s', 'log', ''],
      ['ett_g', 'Intubacija (RSI)', null, '5–10 min', 'rsi', 'role1']
    ]],
    ['R', 'Kvėpavimas', [
      ['o2', 'Deguonis', 'o2', '1 min', '', ''],
      ['o2off', 'Deguonis nuimtas', null, '', 'o2off', ''],
      ['bilat', 'Abipusė dekompresija (trauminis sustojimas)', null, '2 min', 'log', ''],
      ['bvm', 'Ventiliacija maišu (BVM)', null, 'nuolat', 'log', ''],
      ['vent', 'Dirbtinė plaučių ventiliacija (ventiliatorius)', null, '', 'log', 'role1']
    ]],
    ['C', 'Kraujotaka', [
      ['iv', 'IV kateteris', null, '1–2 min', 'log', ''], ['io', 'IO adata', null, '1 min', 'log', ''],
      ['fluid', 'Kraujas / skysčiai', 'fluid', '', '', ''],
      ['ca', 'Kalcio gliukonatas 10 % 30 ml', 'drug:ca', '10 min', '', ''],
      ['efast', 'e-FAST', null, '3–5 min', 'log', 'role1']
    ]],
    ['H', 'Hipotermija / galva', [
      ['hpmk', 'Hipotermijos prevencija (HPMK)', null, '2–3 min', 'log', ''],
      ['warm', 'Aktyvus šildymas, šilti skysčiai', null, '5 min', 'log', 'role1'],
      ['head30', 'Galva pakelta 30°', null, '', 'log', ''],
      ['hts', 'Hipertoninis NaCl 250 ml', 'drug:hts', '10–15 min', '', '']
    ]],
    ['P', 'Skausmas ir vaistai', [
      ['drug', 'Vaistai…', 'drug', '', '', ''],
      ['cwmp', 'Kovinės žaizdos vaistų paketas (CWMP)', null, '', 'log', 'medevac']
    ]],
    ['A2', 'Antibiotikai', [
      ['abx', 'Antibiotikas…', 'drug:abx', '', '', '']
    ]],
    ['W', 'Žaizdos, įtvarai, kita', [
      ['wound', 'Žaizdų tvarstymas / patikra', null, '', 'log', ''], ['splint', 'Įtvaras', null, '5 min', 'log', ''], ['eye', 'Akies apsauga (skydelis)', null, '', 'log', ''],
      ['cath', 'Šlapimo kateteris', null, '5 min', 'log', 'role1'], ['la', 'Vietinė nejautra (prieš torakostomiją / drenas)', null, '2 min', 'log', 'role1'], ['card', 'Nukentėjusiojo kortelė (DD 1380) užpildyta', null, '', 'log', '']
    ]],
    ['K', 'Gaivinimas', [
      ['cpr', 'KPR – krūtinės paspaudimai', null, 'nuolat', 'log', ''], ['defib', 'Defibriliacija', null, '', 'log', '']
    ]],
    ['Mon', 'Stebėjimas', [
      ['avpu', 'AVPU įvertintas ir įrašytas į kortelę', null, '', 'log', ''],
      ['probes', 'Visi davikliai prijungti (EKG, SpO₂, AKS)', null, '', 'probe:all:1', ''],
      ['ecgon', 'EKG elektrodai uždėti', null, '', 'probe:ecg:1', ''], ['spo2on', 'SpO₂ daviklis uždėtas', null, '', 'probe:spo2:1', ''], ['nibpon', 'AKS manžetė uždėta', null, '', 'probe:nibp:1', '']
    ]]
  ];
  const txFor = set => TX.map(([L, n, items]) => [L, n, items.filter(x => !x[5] || x[5] === set)]).filter(g => g[2].length);
  const O2DEV = [['NasalCannula', 'Kaniulės', [1, 2, 4, 6]], ['SimpleMask', 'Kaukė', [6, 8, 10]], ['NonRebreatherMask', 'Kaukė su rezervuaru', [10, 12, 15]]];
  const FLUIDS = [['Blood', 'Pilnas kraujas'], ['PackedRBC', 'Eritrocitų masė'], ['Plasma', 'Plazma'], ['Saline', 'NaCl 0,9 %'], ['LactatedRingers', 'Ringerio laktatas']];
  const VOLS = [250, 500, 1000];
  const RATES = [['pb', 'Slėgio maišas', 50], ['grav', 'Laša savaime', 25], ['15', 'Per 15 min', 0], ['30', 'Per 30 min', 0], ['60', 'Per 60 min', 0]];
  // vaistai pagal gidą: {id, n, pulse (Pulse medžiaga arba null – tik žurnale), g (grupė), r: [[būdas, [dozės], vnt]], kg: [[būdas, mg/kg, pavadinimas]], note}
  // MEDEVAC – MARCH gidas (TCCC 2026), Role 1 – ETC gidas. Dozės iš gidų (vaistai.js).
  const D = (id, n, pulse, g, r, note, kg, lo) => ({ id, n, pulse, g, r, note: note || '', kg: kg || [], lo: !!lo });   // lo – Pulse medžiagą turi, bet sąmoningai tik žurnale
  const DRUGS = {
    medevac: [
      D('ket', 'Ketaminas', 'Ketamine', 'Analgezija', [['IV', [25], 'mg'], ['IO', [25], 'mg'], ['IM', [100], 'mg'], ['IN', [50], 'mg']], 'IV/IO – lėtai per 1 min; kartoti kas 30 min pagal poreikį (MARCH)', [['IV', 0.2, 'analgezija 0,2 mg/kg'], ['IV', 0.3, 'analgezija 0,3 mg/kg']]),
      D('esket', 'Esketaminas', 'Ketamine', 'Analgezija', [['IN', [14, 28], 'mg']], 'modelyje – kaip ketaminas'),
      D('fen', 'Fentanilis', 'Fentanyl', 'Analgezija', [['IV', [50], 'mcg'], ['IO', [50], 'mcg'], ['IN', [100], 'mcg'], ['OTFC', [800], 'mcg']], 'ne TCCC 2026 – tik pagal vieneto SOP; OTFC modelyje ≈ 100 mcg IM', [['IV', 0.0005, '0,5 mcg/kg'], ['IV', 0.001, '1 mcg/kg']]),
      D('mor', 'Morfinas', 'Morphine', 'Analgezija', [['IV', [2.5], 'mg'], ['IM', [5, 10, 20], 'mg']], 'ne TCCC 2026 – tik pagal SOP; IV ne dažniau kas 10 min'),
      D('nal', 'Naloksonas', 'Naloxone', 'Analgezija', [['IV', [0.4], 'mg'], ['IO', [0.4], 'mg'], ['IM', [0.4], 'mg'], ['IN', [0.4], 'mg']], 'kartoti kas 2–3 min'),
      D('txa', 'TXA (traneksamo rūgštis)', null, 'Kraujavimas', [['IV', [2], 'g'], ['IO', [2], 'g']], 'vienkartinė dozė; po 3 val. neskirti'),
      D('ca', 'Kalcio gliukonatas 10 %', null, 'Kraujavimas', [['IV', [30], 'ml'], ['IO', [30], 'ml']], 'po pirmo kraujo produkto vieneto'),
      D('hts', 'Hipertoninis NaCl 3 %', null, 'Galva', [['IV', [250], 'ml'], ['IO', [250], 'ml']], 'tik smegenų išvaržos požymiai; kartoti po 20 min (maks. 2)'),
      D('ond', 'Ondansetronas', null, 'Kiti', [['IV', [4], 'mg'], ['IM', [4], 'mg'], ['PO', [4], 'mg']], ''),
      D('cro', 'Ceftriaksonas', null, 'Antibiotikai', [['IV', [2], 'g'], ['IO', [2], 'g'], ['IM', [2], 'g']], 'kai negali nuryti'),
      D('cfd', 'Cefadroksilis', null, 'Antibiotikai', [['PO', [1], 'g']], 'atviros kovinės žaizdos'),
      D('para', 'Paracetamolis', null, 'Analgezija', [['PO', [1000, 1300], 'mg']], 'CWMP dalis'),
      D('melox', 'Meloksikamas', null, 'Analgezija', [['PO', [15], 'mg']], 'CWMP dalis'),
      D('suz', 'Suzetriginas', null, 'Analgezija', [['PO', [100, 50], 'mg']], 'CWMP dalis (TCCC 2026)'),
      D('cfx', 'Cefaleksinas', null, 'Antibiotikai', [['PO', [500], 'mg']], 'alternatyva cefadroksiliui')
    ],
    role1: [
      D('ket', 'Ketaminas', 'Ketamine', 'Analgezija / anestezija', [['IV', [25], 'mg'], ['IO', [25], 'mg'], ['IM', [100, 300], 'mg'], ['IN', [50], 'mg']], 'analgezija 0,2–0,5 mg/kg, kartoti kas 30 min; sedacijai / indukcijai šoke dozę mažinti 50 % (ETC)', [['IV', 0.2, 'analgezija 0,2 mg/kg'], ['IV', 0.3, 'analgezija 0,3 mg/kg'], ['IV', 0.5, 'analgezija maks. 0,5 mg/kg'], ['IV', 1, 'sedacija 1 mg/kg'], ['IV', 2, 'sedacija / indukcija 2 mg/kg']]),
      D('fen', 'Fentanilis', 'Fentanyl', 'Analgezija / anestezija', [['IV', [50, 100], 'mcg'], ['IO', [50, 100], 'mcg'], ['IN', [100], 'mcg']], 'medicinos personalui', [['IV', 0.001, '1 mcg/kg']]),
      D('mor', 'Morfinas', 'Morphine', 'Analgezija / anestezija', [['IV', [2, 3], 'mg'], ['IO', [2, 3], 'mg'], ['IM', [10], 'mg']], 'nutraukti, kai KD < 10 k./min', [['IV', 0.1, '0,1 mg/kg']]),
      D('nal', 'Naloksonas', 'Naloxone', 'Analgezija / anestezija', [['IV', [0.1, 0.2], 'mg'], ['IM', [0.4, 2], 'mg'], ['IN', [1.8], 'mg']], 'ETC – maks. 2 mg'),
      D('mid', 'Midazolamas', 'Midazolam', 'Analgezija / anestezija', [['IV', [0.5, 2], 'mg'], ['IO', [0.5, 2], 'mg']], 'emergencijos reakcijai, traukuliams', [['IM', 0.1, '0,1 mg/kg IM']]),
      D('roc', 'Rokuroniumas', null, 'Analgezija / anestezija', [], 'RSI – modelyje tik žurnale: Pulse ventiliatorius neprijungtas, paralyžiaus neskaičiuojame (ventiliuokite garsiai)', [['IV', 0.6, 'intubacijai 0,6 mg/kg'], ['IV', 1, 'RSI 1 mg/kg']], 1),
      D('adr', 'Adrenalinas', 'Epinephrine', 'Gaivinimas', [['IV', [1], 'mg'], ['IO', [1], 'mg']], 'sustojus širdžiai – ETC gaivinimo algoritmas (ALS)'),
      D('txa', 'TXA (traneksamo rūgštis)', null, 'Kraujavimas', [['IV', [2], 'g'], ['IO', [2], 'g']], 'geriausia per 90 min nuo sužeidimo'),
      D('ca', 'Kalcio gliukonatas 10 %', null, 'Kraujavimas', [['IV', [30], 'ml'], ['IO', [30], 'ml']], 'kartoti kas 4 kraujo vienetus'),
      D('nor', 'Noradrenalinas', null, 'Kraujotaka', [], 'infuzomatu 0,05–1 mcg/kg/min, tik atkūrus tūrį – tik žurnale', [['IV', 0.0001, '0,1 mcg/kg/min']]),
      D('atr', 'Atropinas', null, 'Kraujotaka', [['IV', [0.5], 'mg']], ''),
      D('hts', 'Hipertoninis NaCl 3 %', null, 'Galva', [['IV', [250], 'ml'], ['IO', [250], 'ml']], 'kartoti po 20 min (maks. 2)'),
      D('man', 'Manitolis', null, 'Galva', [], 'jei šoko nėra ir sAKS > 110', [['IV', 250, '0,25 g/kg'], ['IV', 500, '0,5 g/kg'], ['IV', 1000, '1 g/kg']]),
      D('para', 'Paracetamolis', null, 'Kiti', [['IV', [1], 'g'], ['PO', [1000], 'mg']], '', [['IV', 15, '15 mg/kg']]),
      D('ins', 'Insulinas + gliukozė (hiperkalemija)', null, 'Kiti', [['IV', [10], 'IU']], '10 IU + 25 g gliukozės'),
      D('ond', 'Ondansetronas', null, 'Kiti', [['IV', [4], 'mg'], ['IM', [4], 'mg']], ''),
      D('meto', 'Metoklopramidas', null, 'Kiti', [['IV', [10], 'mg']], ''),
      D('glu', 'Gliukozė (hipoglikemija)', null, 'Kiti', [['IV', [200], 'ml']], ''),
      D('amx', 'Amoksiklavas', null, 'Antibiotikai', [['IV', [1.2], 'g']], ''),
      D('cro', 'Ceftriaksonas', null, 'Antibiotikai', [['IV', [2], 'g'], ['IM', [2], 'g']], ''),
      D('ert', 'Ertapenemas', null, 'Antibiotikai', [['IV', [1], 'g']], ''),
      D('mox', 'Moksifloksacinas', null, 'Antibiotikai', [['PO', [400], 'mg']], ''),
      D('cfd', 'Cefadroksilis', null, 'Antibiotikai', [['PO', [1], 'g']], '')
    ]
  };
  const drugsFor = set => DRUGS[set] || DRUGS.role1;
  const drugBy = (id, set) => drugsFor(set).find(d => d.id === id) || DRUGS.role1.concat(DRUGS.medevac).find(d => d.id === id);
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
    ['evac', 'Evakuacija atvyko – ATMISTER', 'evakuacija', 'role1'],
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
  // ≈ Pulse 4.3.1 tokios funkcijos neturi – rodiklių pokytis apytikslis (programėlės sprendimas)
  const APX = {
    'inj:burn': 'Pulse neturi nudegimų modelio – skysčių netekimas modeliuojamas kaip lėtas kraujavimas per odą',
    'inj:tbi': 'Pulse GST rodiklių beveik nekeičia – Cushingo reakciją (ŠSD ↓, AKS ↑, retas kvėpavimas) prideda programėlė',
    'inj:pain': 'Pulse neturi skausmo dirgiklio – modeliuojama ūmiu stresu (ŠSD, AKS ↑); analgetikus įvertina programėlė',
    'act:pdress': 'Pulse neturi tvarsčio – kraujavimas tik susilpninamas',
    'act:pos': 'Pulse neturi šios procedūros – obstrukcija sumažinama',
    'act:npa': 'Pulse neturi NPA – obstrukcija sumažinama',
    'act:suct': 'Pulse neturi atsiurbimo – obstrukcija šiek tiek sumažinama',
    'act:sga': 'Pulse intubacija be ventiliatoriaus netinka – modeliuojama kaip kvėpavimo takų atvėrimas',
    'act:cric': 'Pulse intubacija be ventiliatoriaus netinka – modeliuojama kaip kvėpavimo takų atvėrimas',
    'act:ett': 'Pulse ventiliatorius neprijungtas – modeliuojama kaip kvėpavimo takų atvėrimas (ventiliaciją sakykite garsiai)',
    'act:pcd': 'Pulse neturi perikardiocentezės – skystis iš perikardo siurbiamas 2 min',
    'act:tube': 'Pulse 4.3.1 drenas įtampos pneumotoraksą neišsprendžia – modeliuojama kaip dekompresija',
    'act:tqconv': 'Pulse nemodeliuoja reperfuzijos (K⁺, acidozė) – tik žurnale',
    'act:htube': 'Pulse 4.3.1 drenas pleuros kraujo nepašalina – drenavus sustabdomas tolesnis kaupimasis',
    'act:fthor': 'Pulse neturi pirštinės torakostomijos – modeliuojama kaip dekompresija',
    'act:seal': 'Uždaram pneumotoraksui lipdukas modelio nekeičia – tik žurnale',
    'act:burp': 'Modelyje – tik žurnale',
    'fl:LactatedRingers': 'Pulse neturi Ringerio tirpalo – lašinamas kaip NaCl 0,9 %',
    'drug:esket': 'Pulse neturi esketamino – modeliuojama kaip ketaminas',
    'route:OTFC': 'Pulse neturi transmukozinio vartojimo – ≈ 100 mcg į raumenį',
    'route:IN': 'Pulse neturi intranazalinio vartojimo – modeliuojama kaip į raumenį',
    'route:IO': 'IO modelyje – kaip IV'
  };
  const apx = key => APX[key] || '';
  return { APX, apx, SETTINGS, PATIENTS, LOCS, SEV, SIDES, INJ, injBy, locBy, cmpOf, injAct, injName, cardActions, STATES, BAD, TX, txFor, O2DEV, FLUIDS, VOLS, RATES, DRUGS, drugsFor, drugBy, EVENTS, MECH };
})();
