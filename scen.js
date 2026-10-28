'use strict';
// ───────── SIM – įtaisyti treniruočių scenarijai (kariniai) ─────────
// Etapas: n – pavadinimas, v – tikslinės monitoriaus reikšmės (hr, spo2, sys, dia, rr, temp, r – ritmas), p – pastaba instruktoriui,
// d – sek. pasiekti etapą iš ankstesnio (trendo trukmė), auto – sek. iki automatinio kito etapo, jei negydoma (kitas = i+1, arba nx, jei nurodyta).
// ev – instruktoriaus veiksmai: { n, st – etapo indeksas, shock – prieš tai iškrova }. sal / url – pagrindinis viešas šaltinis (išsamiau: scen-saltiniai.md).
// Reikšmės – mokymo tikslams, išvestos iš viešų šaltinių (ATLS, JTS/TCCC, ERC, tyrimai); laikas daug kur suspaustas (pažymėta „⏱“). Tai ne klinikinės gairės.
window.SIMS = [
  { id: 'hem', pav: 'Hemoraginis šokas I→IV kl. – šlaunies skeveldra', tema: 'C', sal: 'ATLS šoko klasės (8–9 leid.); Schiller/Convertino 2017 (LBNP)', url: 'https://www.ebm-journal.org/journals/experimental-biology-and-medicine/articles/10.1177/1535370217694099/full',
    aprasas: 'Skeveldra šlaunyje, turniketas uždėtas per laisvai – kraujavimas tęsiasi. Rodo, kaip ilgai AKS išlieka „normalus“, kol kompensacija staiga žlunga.',
    st: [
      { n: 'I kl. (<15 %)', v: { hr: 96, spo2: 97, sys: 124, dia: 84, rr: 18, temp: 36.4, r: 'sinus' }, p: '<750 ml. Rodikliai beveik normalūs, nerimas. Laukiama: turniketo patikra / antras turniketas, šoko vertinimas.', d: 0, auto: 120 },
      { n: 'II kl. (15–30 %)', v: { hr: 114, spo2: 97, sys: 118, dia: 92, rr: 24, temp: 36.2, r: 'sinus' }, p: 'ŠSD >100, AKS dar normalus, bet pulsinis spaudimas siaurėja (26). ⏱ Realiai priklauso nuo kraujavimo greičio (min–val.).', d: 90, auto: 120 },
      { n: 'III kl. (30–40 %)', v: { hr: 130, spo2: 95, sys: 88, dia: 66, rr: 32, temp: 35.9, r: 'sinus' }, p: 'Pirmą kartą krenta AKS, sumišęs, radialinis pulsas silpnas. Laukiama: TXA 2 g, kraujas (LTOWB), Ca po 1 vnt.', d: 90, auto: 120 },
      { n: 'IV kl. (>40 %)', v: { hr: 148, spo2: 92, sys: 64, dia: 44, rr: 38, temp: 35.5, r: 'sinus' }, p: '>2000 ml. Mieguistas, radialinio pulso nėra, SpO₂ signalas silpnas. Laukiama: masyvi transfuzija, skubi evakuacija.', d: 90, auto: 90 },
      { n: 'Dekompensacija – bradikardija', v: { hr: 48, spo2: 86, sys: 50, dia: 30, rr: 8, temp: 35.3, r: 'sinus' }, p: 'LBNP modeliuose žlugimą žymi staigi bradikardija ir AKS kritimas (Schiller 2017). Iki sustojimo – minutės.', d: 45, auto: 60 },
      { n: 'BEA', v: { hr: 40, spo2: 70, sys: 0, dia: 0, rr: 0, temp: 35.2, r: 'pea' }, p: 'Trauminis sustojimas: HOTT – kraujavimo kontrolė, kraujas, abipusė dekompresija (CGO TCA).', d: 30 },
      { n: 'Kraujavimas sustabdytas + kraujas', v: { hr: 106, spo2: 97, sys: 102, dia: 66, rr: 20, temp: 35.8, r: 'sinus' }, p: 'Po turniketo pataisymo, TXA, 1–2 vnt. kraujo ir Ca. TCCC tikslas: radialinis pulsas, sąmonė, sAKS ~100. Šildyti.', d: 120 }
    ],
    ev: [{ n: 'Turniketas pataisytas + TXA + kraujas + Ca', st: 6 }, { n: 'HOTT po BEA – grįžo kraujotaka', st: 6 }] },

  { id: 'jun', pav: 'Junkcinis kraujavimas – kirkšnies skeveldra', tema: 'C', sal: 'TCCC / JTS DCR (2023); ATLS', url: 'https://tccc.org.ua/files/downloads/module-11-hemorrhagic-shock-fluid-resuscitation-in-tactical-field-care-tfc.pdf',
    aprasas: 'Mina, skeveldra kirkšnyje – turniketo uždėti negalima. Arterinis kraujavimas: be tamponavimo šokas progresuoja per minutes.',
    st: [
      { n: 'Atvežtas', v: { hr: 124, spo2: 96, sys: 98, dia: 72, rr: 26, temp: 36.0, r: 'sinus' }, p: 'Pulsuojantis kraujavimas iš kirkšnies. Laukiama: tiesioginis spaudimas, žaizdos tamponavimas + 3 min spaudimo, junkcinis turniketas.', d: 0, auto: 90 },
      { n: 'Blogėja (III–IV kl.)', v: { hr: 142, spo2: 93, sys: 72, dia: 52, rr: 34, temp: 35.7, r: 'sinus' }, p: 'Neužtamponavus – greitas perėjimas į IV klasę. ⏱ Arterinis kraujavimas ~250–500 ml/min (Pulse hemorrhage modelis).', d: 60, auto: 90 },
      { n: 'BEA', v: { hr: 48, spo2: 70, sys: 0, dia: 0, rr: 0, temp: 35.5, r: 'pea' }, p: 'Išsikraujavimas. HOTT; ar kraujavimas sustabdytas?', d: 45 },
      { n: 'Užtamponuota', v: { hr: 120, spo2: 96, sys: 90, dia: 62, rr: 26, temp: 35.8, r: 'sinus' }, p: 'Kraujavimas sustojo, bet hipovolemija lieka. Laukiama: TXA, kraujas, šildymas, evakuacija (T1).', d: 60 },
      { n: 'Po kraujo', v: { hr: 104, spo2: 97, sys: 104, dia: 68, rr: 20, temp: 36.0, r: 'sinus' }, p: 'Po 2 vnt. LTOWB + 1 g Ca. Kas vienetą – pakartotinis vertinimas (radialinis pulsas, sąmonė, sAKS 100).', d: 120 }
    ],
    ev: [{ n: 'Tamponavimas + junkcinis turniketas', st: 3 }, { n: 'Kraujas + Ca', st: 4 }] },

  { id: 'tpx', pav: 'Įtampos pneumotoraksas – kvėpuoja pats (kulka krūtinėje)', tema: 'B', sal: 'Roberts 2015 Ann Surg (sisteminė apžvalga); Kheirabadi 2013 (kiaulių modelis)', url: 'https://pubmed.ncbi.nlm.nih.gov/25563887/',
    aprasas: 'Kulka dešinėje krūtinės pusėje, okliuzinis tvarstis uždėtas. Savarankiškai kvėpuojant pirmiausia krenta SpO₂ ir didėja KD, hipotenzija – vėlyvas požymis.',
    st: [
      { n: 'Pradžia', v: { hr: 118, spo2: 89, sys: 124, dia: 80, rr: 30, temp: 36.4, r: 'sinus' }, p: 'Dešinėje kvėpavimas susilpnėjęs, krūtinė kyla nevienodai. Hipoksija – 50 % savarankiškai kvėpuojančių (Roberts 2015).', d: 0, auto: 180 },
      { n: 'Blogėja', v: { hr: 136, spo2: 80, sys: 104, dia: 76, rr: 36, temp: 36.4, r: 'sinus' }, p: 'Įtampos pradžioje kiaulių modelyje ŠSD +24 %, VAS −16 %, MTI −23 % (Kheirabadi 2013). Kaklo venos, trachėjos poslinkis – vėlyvi. Laukiama: dekompresija.', d: 120, auto: 180, nx: 3 },
      { n: 'Po dekompresijos', v: { hr: 104, spo2: 95, sys: 120, dia: 78, rr: 22, temp: 36.4, r: 'sinus' }, p: 'Gerėja per 1–5 min. Toliau – pirštinė torakostomija / drenas; adata gali užsikimšti – stebėti pasikartojimą.', d: 60 },
      { n: 'Dekompensacija', v: { hr: 150, spo2: 70, sys: 76, dia: 56, rr: 8, temp: 36.3, r: 'sinus' }, p: 'Išsekimas, kvėpavimo sustojimas (9 % savarankiškai kvėpuojančių, Roberts 2015) ir hipotenzija. Dekompresija nedelsiant.', d: 90, auto: 60 },
      { n: 'BEA', v: { hr: 46, spo2: 60, sys: 0, dia: 0, rr: 0, temp: 36.2, r: 'pea' }, p: 'Obstrukcinis sustojimas – abipusė dekompresija (CGO TCA).', d: 30 }
    ],
    ev: [{ n: 'Dekompresija (adata / pirštinė torakostomija)', st: 2 }, { n: 'Abipusė dekompresija po BEA', st: 2 }] },

  { id: 'tpv', pav: 'Įtampos pneumotoraksas – ventiliuojamas (MEDEVAC)', tema: 'B', sal: 'Roberts 2015 Ann Surg; Leigh-Smith & Harris 2005 EMJ', url: 'https://pubmed.ncbi.nlm.nih.gov/25563887/',
    aprasas: 'Intubuotas sprogimo sužeistasis evakuacijos metu (teigiamo slėgio ventiliacija). Ventiliuojamiems įtampa vystosi per minutes, hipotenzija ir sustojimas daug dažnesni.',
    st: [
      { n: 'Intubuotas, stabilus', v: { hr: 96, spo2: 97, sys: 122, dia: 76, rr: 14, temp: 36.2, r: 'sinus' }, p: 'KD = ventiliavimo dažnis (14). Plaučių kontūzija kairėje.', d: 0, auto: 60 },
      { n: 'Staigus blogėjimas', v: { hr: 138, spo2: 84, sys: 82, dia: 60, rr: 14, temp: 36.2, r: 'sinus' }, p: 'Didėja ventiliavimo slėgis, krūtinė kairėje nekyla. Ventiliuojamiems hipoksija 92 %, hipotenzijos šansas ×12,6 (Roberts 2015).', d: 45, auto: 60 },
      { n: 'Obstrukcinis šokas', v: { hr: 150, spo2: 74, sys: 58, dia: 42, rr: 14, temp: 36.1, r: 'sinus' }, p: '70 % hipotenzijų / sustojimų – per kelias minutes nuo pasireiškimo. Dekompresija – nedelsiant, nelaukti RTG.', d: 45, auto: 45 },
      { n: 'BEA', v: { hr: 118, spo2: 60, sys: 0, dia: 0, rr: 10, temp: 36.0, r: 'pea' }, p: 'Pulso nėra, ritmas organizuotas (BEA). KD – maišo ventiliacija. Abipusė torakostomija.', d: 30 },
      { n: 'Po dekompresijos', v: { hr: 108, spo2: 94, sys: 112, dia: 72, rr: 14, temp: 36.0, r: 'sinus' }, p: 'Gerėja per 1–2 min. Pirštinė torakostomija ventiliuojamam – pirmo pasirinkimo; vėliau drenas.', d: 60 }
    ],
    ev: [{ n: 'Pirštinė torakostomija / adatinė dekompresija', st: 4 }] },

  { id: 'opx', pav: 'Atviras pneumotoraksas → įtampa po tvarsčiu', tema: 'B', sal: 'Kheirabadi 2013 J Trauma (USAISR kiaulių modelis, vožtuvinis vs be vožtuvo)', url: 'https://apps.dtic.mil/sti/tr/pdf/ADA614696.pdf',
    aprasas: 'Skeveldra krūtinėje, „siurbianti“ žaizda. Tvarstis be vožtuvo pradžioje padeda, bet esant oro nuotėkiui iš plaučio vystosi įtampa.',
    st: [
      { n: 'Atvira žaizda', v: { hr: 112, spo2: 88, sys: 128, dia: 82, rr: 32, temp: 36.5, r: 'sinus' }, p: 'Atviras PTX: krenta SpO₂, ŠSD ir AKS beveik nesikeičia (Kheirabadi 2013). Laukiama: okliuzinis tvarstis (vožtuvinis).', d: 0, auto: 240 },
      { n: 'Hipoksija didėja', v: { hr: 124, spo2: 82, sys: 122, dia: 80, rr: 36, temp: 36.4, r: 'sinus' }, p: 'Kvėpavimas sunkėja, girdimas oro siurbimas žaizdoje.', d: 120 },
      { n: 'Tvarstis be vožtuvo', v: { hr: 104, spo2: 94, sys: 126, dia: 80, rr: 24, temp: 36.4, r: 'sinus' }, p: 'Per ~5 min rodikliai grįžta prie pradinių. ⏱ Modelyje įtampa po tvarsčiu išsivystė po ~1,4 l oro (~30–40 min), čia suspausta.', d: 60, auto: 300 },
      { n: 'Įtampa po tvarsčiu', v: { hr: 132, spo2: 83, sys: 104, dia: 80, rr: 32, temp: 36.3, r: 'sinus' }, p: 'Pleuros slėgis ~+10 mm Hg, ŠSD +24 %, VAS −16 %, PaO₂ ~59 (Kheirabadi 2013). Laukiama: „atpūsti“ tvarstį / dekompresija.', d: 120, auto: 180 },
      { n: 'Dekompensacija', v: { hr: 146, spo2: 72, sys: 78, dia: 58, rr: 10, temp: 36.2, r: 'sinus' }, p: 'Kai kurie gyvūnai patyrė kvėpavimo sustojimą; nuėmus tvarstį kvėpavimas atsistatė.', d: 90 },
      { n: 'Tvarstis atidengtas / vožtuvinis', v: { hr: 100, spo2: 95, sys: 124, dia: 78, rr: 20, temp: 36.3, r: 'sinus' }, p: 'Vožtuvinis tvarstis neleido išsivystyti įtampai iki ~2 l oro (Kheirabadi 2013).', d: 60 }
    ],
    ev: [{ n: 'Okliuzinis tvarstis be vožtuvo', st: 2 }, { n: 'Tvarstis atidengtas / vožtuvinis / dekompresija', st: 5 }] },

  { id: 'hmt', pav: 'Masyvus hemotoraksas – skeveldra krūtinėje', tema: 'B', sal: 'ATLS (≥1500 ml / ≥200 ml/val.); Pulse hemothorax modelis', url: 'https://pulse.kitware.com/_respiratory_methodology.html',
    aprasas: 'Skeveldra kairėje krūtinės pusėje. Derinys: hipoksija (plaučio kompresija) + hipovolemija – drenas pagerina kvėpavimą, bet šokui reikia kraujo.',
    st: [
      { n: 'Atvežtas', v: { hr: 122, spo2: 91, sys: 100, dia: 72, rr: 30, temp: 36.2, r: 'sinus' }, p: 'Kairėje kvėpavimas susilpnėjęs, perkusija duslesnė, kaklo venos subliūškusios (priešingai nei įtampos PTX).', d: 0, auto: 180 },
      { n: 'Blogėja', v: { hr: 138, spo2: 86, sys: 80, dia: 58, rr: 36, temp: 35.9, r: 'sinus' }, p: '>1500 ml pleuroje. ⏱ Pulse modelyje masyvus hemotoraksas pasiekiamas per 1–5 val. (pagal greitį), čia suspausta.', d: 120, auto: 150 },
      { n: 'Prieš sustojimą', v: { hr: 152, spo2: 80, sys: 60, dia: 40, rr: 40, temp: 35.6, r: 'sinus' }, p: 'IV kl. šokas + hipoksija.', d: 90, auto: 90 },
      { n: 'BEA', v: { hr: 58, spo2: 65, sys: 0, dia: 0, rr: 0, temp: 35.5, r: 'pea' }, p: 'HOTT: hipovolemija + torakostomija.', d: 30 },
      { n: 'Drenas + kraujas', v: { hr: 112, spo2: 94, sys: 98, dia: 64, rr: 24, temp: 35.8, r: 'sinus' }, p: 'Iš dreno >1500 ml iš karto arba >200 ml/val. 2–4 val. – chirurgija. Kraujas + Ca, šildyti.', d: 120 }
    ],
    ev: [{ n: 'Torakostomija / drenas + kraujas', st: 4 }] },

  { id: 'tam', pav: 'Širdies tamponada – skeveldra krūtinėje', tema: 'C', sal: 'StatPearls „Cardiac Tamponade“ (CC BY-NC-ND); CGO TCA (JK GM)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK431090/',
    aprasas: 'Skeveldra „pavojaus zonoje“ (krūtinkaulis/epigastriumas). Ūminei tamponadai pakanka nedidelio kraujo kiekio; siaurėja pulsinis spaudimas, baigiasi BEA.',
    st: [
      { n: 'Pradžia', v: { hr: 118, spo2: 96, sys: 98, dia: 78, rr: 24, temp: 36.2, r: 'sinus' }, p: 'Tachikardija – ankstyviausias kompensacijos požymis. Siauras pulsinis spaudimas (20). e-FAST – skystis perikarde.', d: 0, auto: 150 },
      { n: 'Beko triada', v: { hr: 134, spo2: 94, sys: 78, dia: 64, rr: 28, temp: 36.1, r: 'sinus' }, p: 'Hipotenzija, išsipūtusios kaklo venos, duslūs tonai; paradoksinis pulsas >10 mm Hg.', d: 90, auto: 120 },
      { n: 'Prieš sustojimą', v: { hr: 146, spo2: 90, sys: 62, dia: 52, rr: 32, temp: 36.0, r: 'sinus' }, p: 'Pulsinis spaudimas ~10. Skysčiai – tik laikinai; vengti teigiamo slėgio ventiliacijos, jei įmanoma.', d: 60, auto: 60 },
      { n: 'BEA', v: { hr: 110, spo2: 80, sys: 0, dia: 0, rr: 0, temp: 36.0, r: 'pea' }, p: 'HOTT (tamponada). Torakotomija – tik apmokytai komandai ir jei sustojimas <15 min (CGO TCA).', d: 30 },
      { n: 'Po perikardo dekompresijos', v: { hr: 112, spo2: 96, sys: 104, dia: 66, rr: 20, temp: 36.0, r: 'sinus' }, p: 'Grįžo kraujotaka – skubiai į operacinę.', d: 60 }
    ],
    ev: [{ n: 'Perikardiocentezė / torakotomija', st: 4 }] },

  { id: 'aw', pav: 'Kvėpavimo takų obstrukcija – veido trauma', tema: 'A', sal: 'Benumof 1997 (per Weingart & Levitan 2012); Farmery & Roe', url: 'https://pemcincinnati.com/blog/wp-content/uploads/2016/10/Weingart-and-Levitan-Annals-2012-Preoxygenation-and-the-prevention-of-desaturation-during-emergency-airway-mgt.pdf',
    aprasas: 'Šarvuočio vairuotojas, veido trauma, kraujas burnoje. Neoksigenuotas pacientas po visiškos obstrukcijos desaturuoja per ~1 min; žemiau 90 % – staigus kritimas.',
    st: [
      { n: 'Dalinė obstrukcija', v: { hr: 124, spo2: 90, sys: 136, dia: 84, rr: 30, temp: 36.5, r: 'sinus' }, p: 'Burbuliavimas, kraujas ir dantys burnoje. Laukiama: atsiurbimas, sėdima / „pusiau gulima“ padėtis, nosiaryklės vamzdelis.', d: 0, auto: 60 },
      { n: 'Visiška obstrukcija', v: { hr: 138, spo2: 80, sys: 148, dia: 90, rr: 36, temp: 36.5, r: 'sinus' }, p: 'Impedansinis KD rodo pastangas, nors oro srauto nėra. Kambario oru desaturacija per 45–60 s (Benumof); su preoksigenacija būtų ~8 min sveikam / ~5 min sergančiam.', d: 45, auto: 45 },
      { n: 'Hipoksinė bradikardija', v: { hr: 46, spo2: 58, sys: 84, dia: 50, rr: 4, temp: 36.4, r: 'sinus' }, p: 'Stačioji kreivės dalis: nuo 90 % iki ~70 % – akimirksniu. Krikotirotomija nedelsiant.', d: 45, auto: 45 },
      { n: 'BEA', v: { hr: 30, spo2: 45, sys: 0, dia: 0, rr: 0, temp: 36.4, r: 'pea' }, p: 'Hipoksinis sustojimas. Kvėpavimo takai + ventiliacija – svarbiau nei paspaudimai.', d: 30 },
      { n: 'Po krikotirotomijos', v: { hr: 116, spo2: 93, sys: 128, dia: 80, rr: 16, temp: 36.4, r: 'sinus' }, p: 'Ventiliacija per vamzdelį. SpO₂ kyla su 30–60 s vėlavimu (pulsoksimetro latencija).', d: 60 }
    ],
    ev: [{ n: 'Krikotirotomija / kvėpavimo takai atverti', st: 4 }] },

  { id: 'bls', pav: 'Sprogimo plaučiai (blast lung)', tema: 'B', sal: 'CDC „Explosions and Blast Injuries“ (2003–2009); TCCC', url: 'https://webarchive.library.unt.edu/web/20090114232933/http://www.bt.cdc.gov/masscasualties/pdf/explosions-blast-injuries.pdf',
    aprasas: 'Karys 5 m nuo IED sprogimo uždaroje patalpoje, išorinių sužalojimų mažai. Iškart – vagalinė triada (apnėja, bradikardija, hipotenzija), vėliau progresuojanti hipoksija.',
    st: [
      { n: 'Iškart po sprogimo', v: { hr: 50, spo2: 86, sys: 90, dia: 56, rr: 6, temp: 36.4, r: 'sinus' }, p: 'Apnėja/bradipnėja, bradikardija, hipotenzija – pirminės sprogimo traumos triada (CDC).', d: 0, auto: 60 },
      { n: 'Po 10 min', v: { hr: 112, spo2: 90, sys: 118, dia: 74, rr: 28, temp: 36.4, r: 'sinus' }, p: 'Refleksas praėjo, liko dusulys, kosulys, hemoptizė. Laukiama: O₂, stebėti, RTG „drugelis“.', d: 90, auto: 240 },
      { n: 'Kontūzija progresuoja', v: { hr: 124, spo2: 84, sys: 112, dia: 70, rr: 34, temp: 36.2, r: 'sinus' }, p: '⏱ Realiai – valandos (požymiai gali atsirasti iki 48 val.). Atsargiai su skysčiais.', d: 180, auto: 180 },
      { n: 'Pneumotoraksas (PPV / skrydis)', v: { hr: 140, spo2: 76, sys: 82, dia: 60, rr: 38, temp: 36.1, r: 'sinus' }, p: 'Po intubacijos ar oro evakuacijos – pneumotoraksas / oro embolija. CDC: profilaktinis drenas prieš anesteziją ar skrydį.', d: 90 },
      { n: 'O₂ + drenas', v: { hr: 104, spo2: 93, sys: 118, dia: 72, rr: 22, temp: 36.2, r: 'sinus' }, p: 'Deguonis, dekompresija / drenas, ribotai skysčių.', d: 90 }
    ],
    ev: [{ n: 'O₂ + dekompresija / drenas', st: 4 }] },

  { id: 'tbi', pav: 'GSmT – išvaržos grėsmė (Kušingo triada)', tema: 'D', sal: 'StatPearls „Cushing Reflex“; JTS TBI PCC CPG', url: 'https://www.statpearls.com/point-of-care/20176',
    aprasas: 'Sprogimas, GKS 9. Didėjant intrakranijiniam spaudimui – hipertenzija su platėjančiu pulsiniu spaudimu, bradikardija ir netaisyklingas kvėpavimas.',
    st: [
      { n: 'GKS 9', v: { hr: 88, spo2: 95, sys: 136, dia: 82, rr: 16, temp: 36.8, r: 'sinus' }, p: 'Vyzdžiai vienodi. JTS tikslai: SpO₂ >90 %, sAKS >110, normotermija, galva 30°.', d: 0, auto: 300 },
      { n: 'Išvaržos pradžia', v: { hr: 68, spo2: 94, sys: 164, dia: 88, rr: 12, temp: 37.2, r: 'sinus' }, p: 'Kairysis vyzdys platėja, GKS 7. ⏱ Realiai – nuo minučių iki valandų.', d: 180, auto: 180 },
      { n: 'Kušingo triada', v: { hr: 48, spo2: 90, sys: 196, dia: 92, rr: 6, temp: 37.4, r: 'sinus' }, p: 'Pulsinis spaudimas >100, bradikardija, netaisyklingas kvėpavimas, ekstenzinis rigidiškumas. Laukiama: hipertoninis NaCl, galva 30°, laisva apykaklė, evakuacija.', d: 120, auto: 180 },
      { n: 'Kamieno nepakankamumas', v: { hr: 38, spo2: 72, sys: 70, dia: 38, rr: 2, temp: 36.9, r: 'sinus' }, p: 'Galutinė stadija: hipotenzija, apnėja. Ventiliacija; prognozė bloga.', d: 90 },
      { n: 'Po hipertoninio NaCl', v: { hr: 76, spo2: 98, sys: 148, dia: 84, rr: 14, temp: 37.0, r: 'sinus' }, p: 'Laikinas pagerėjimas (23,4 % 30 ml lėtai arba 3 % bolusas). Skubi evakuacija neurochirurgijai.', d: 120 }
    ],
    ev: [{ n: 'Hipertoninis NaCl + galva 30° + ventiliacija', st: 4 }] },

  { id: 'tbh', pav: 'GSmT + hemoraginis šokas – kuris AKS tikslas?', tema: 'D', sal: 'JTS DCR (2023) / TBI CPG; TCCC Modulis 11', url: 'https://nextgencombatmedic.com/2024/12/11/treating-tbi-from-the-aid-bag',
    aprasas: 'Galvos ir šlaunies sužalojimai po sprogimo. Diskusija: permisyvi hipotenzija (sAKS ~85–100) netinka GSmT – smegenims reikia sAKS >110.',
    st: [
      { n: 'Atvežtas', v: { hr: 132, spo2: 91, sys: 84, dia: 56, rr: 26, temp: 35.8, r: 'sinus' }, p: 'GKS 10, kraujavimas sustabdytas turniketu. Hipotenzija (<90) ir hipoksija (<90 %) didina GSmT mirštamumą.', d: 0, auto: 240 },
      { n: 'Negydomas – blogėja', v: { hr: 142, spo2: 88, sys: 72, dia: 46, rr: 30, temp: 35.5, r: 'sinus' }, p: 'GKS 7, antrinė smegenų žala. ⏱ Suspausta.', d: 120, auto: 180 },
      { n: 'BEA', v: { hr: 44, spo2: 65, sys: 0, dia: 0, rr: 0, temp: 35.3, r: 'pea' }, p: 'HOTT.', d: 60 },
      { n: 'Kraujas iki sAKS >110', v: { hr: 106, spo2: 96, sys: 114, dia: 70, rr: 18, temp: 35.9, r: 'sinus' }, p: 'Teisingas GSmT tikslas (JTS). GKS gerėja iki 11.', d: 120 },
      { n: 'Kraujas tik iki radialinio pulso', v: { hr: 118, spo2: 95, sys: 88, dia: 58, rr: 20, temp: 35.8, r: 'sinus' }, p: 'DCR tikslas be GSmT – čia per mažas: GKS toliau krenta. Debrifingui.', d: 120 }
    ],
    ev: [{ n: 'Kraujas, tikslas sAKS >110', st: 3 }, { n: 'Kraujas iki radialinio pulso (~85)', st: 4 }] },

  { id: 'ns', pav: 'Neurogeninis šokas – kaklo stuburo trauma', tema: 'D', sal: 'StatPearls „Neurogenic Shock“ (CC BY-NC-ND)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK459361/',
    aprasas: 'Kritimas iš transporterio, C5 sužalojimas: hipotenzija su bradikardija, šilta rausva oda. Pirmiausia atmesti kraujavimą.',
    st: [
      { n: 'Atvežtas', v: { hr: 54, spo2: 95, sys: 84, dia: 46, rr: 18, temp: 36.0, r: 'sinus' }, p: 'sAKS <90 ir ŠSD <80 (dažnai <60), oda šilta, priapizmas, diafragminis kvėpavimas. Hemoraginis šokas atmestas?', d: 0, auto: 300 },
      { n: 'Vazodilatacija + šilumos netekimas', v: { hr: 48, spo2: 94, sys: 76, dia: 40, rr: 20, temp: 35.3, r: 'sinus' }, p: 'Poikilotermija – greitai vėsta. ⏱ Suspausta.', d: 180, auto: 120 },
      { n: 'Atsiurbiant – vagalinė bradikardija', v: { hr: 34, spo2: 92, sys: 62, dia: 34, rr: 20, temp: 35.3, r: 'sinus' }, p: 'Atsiurbimas / vertimas sukelia bradikardiją (neslopinamas vagusas). Laukiama: atropinas.', d: 30 },
      { n: 'Po atropino', v: { hr: 68, spo2: 94, sys: 84, dia: 46, rr: 20, temp: 35.4, r: 'sinus' }, p: 'ŠSD atsistatė, AKS dar mažas.', d: 60 },
      { n: 'Skysčiai + noradrenalinas', v: { hr: 70, spo2: 96, sys: 120, dia: 68, rr: 18, temp: 36.0, r: 'sinus' }, p: 'Tikslas – VAS 85–90 (pirmos 7 d.). Saikingai skysčių, vazopresorius (noradrenalinas), šildyti.', d: 180 }
    ],
    ev: [{ n: 'Atropinas', st: 3 }, { n: 'Skysčiai + vazopresorius, šildymas', st: 4 }] },

  { id: 'brn', pav: 'Nudegimai 40 % + įkvėpimo trauma (val. suspaustos)', tema: 'E', sal: 'JTS Burn Resuscitation Flowsheet (2025); JTS Burn CPG', url: 'https://jts.health.mil/assets/docs/forms/JTS_Burn_Resuscitation_Flowchart.pdf',
    aprasas: 'Šarvuočio gaisras, 40 % KPP, suodžiai, užkimimas. Per valandas – nudegimų šokas ir kvėpavimo takų edema; laikas suspaustas (1 etapas ≈ 1–2 val.).',
    st: [
      { n: 'Po 15 min', v: { hr: 118, spo2: 95, sys: 132, dia: 84, rr: 24, temp: 36.4, r: 'sinus' }, p: 'Skausmas, tachikardija, AKS dar normalus. Apdegę antakiai, suodžiai – planuoti ankstyvą intubaciją. SpO₂ gali būti klaidingai normali apsinuodijus CO (pulsoksimetras neskiria karboksihemoglobino).', d: 0, auto: 180 },
      { n: 'Po 1–2 val.', v: { hr: 128, spo2: 92, sys: 118, dia: 76, rr: 28, temp: 35.9, r: 'sinus' }, p: 'Užkimimas stiprėja. Laukiama: RL 40 × 10 = 400 ml/val. („dešimties taisyklė“, 40–80 kg), šildymas.', d: 180, auto: 180 },
      { n: 'Po 4–6 val. be skysčių', v: { hr: 142, spo2: 86, sys: 88, dia: 58, rr: 34, temp: 35.3, r: 'sinus' }, p: 'Nudegimų šokas: diurezė <30 ml/val., stridoras. ⏱ Suspausta.', d: 180, auto: 180 },
      { n: 'Kvėpavimo takų obstrukcija', v: { hr: 150, spo2: 74, sys: 80, dia: 52, rr: 40, temp: 35.0, r: 'sinus' }, p: 'Edema – intubacija nebeįmanoma: krikotirotomija.', d: 120 },
      { n: 'Intubuotas + skysčiai', v: { hr: 112, spo2: 96, sys: 118, dia: 70, rr: 16, temp: 36.0, r: 'sinus' }, p: 'Titruoti RL iki diurezės 30–50 ml/val., VAS >65; max 250 ml/kg per 24 val. (JTS).', d: 180 }
    ],
    ev: [{ n: 'Ankstyva intubacija + RL pagal „dešimties taisyklę“', st: 4 }] },

  { id: 'hyp', pav: 'Hipotermija – ištrauktas iš upės (šveicarų stadijos)', tema: 'E', sal: 'Pasquier 2019 SJTREM (CC BY); Pasquier 2021 (gyvybiniai rodikliai); WMS 2019', url: 'https://sjtrem.biomedcentral.com/track/pdf/10.1186/s13049-019-0636-0',
    aprasas: 'Karys įlūžo per ledą forsuojant upę, ištrauktas po ~40 min. ŠSD vidutiniškai −2,5/min, sAKS −4,4 mm Hg, KD −0,5/min kiekvienam °C (Pasquier 2021). Laikas suspaustas.',
    st: [
      { n: 'HT I – sąmoningas, dreba (33,5 °C)', v: { hr: 96, spo2: 95, sys: 132, dia: 84, rr: 20, temp: 33.5, r: 'sinus' }, p: 'Drebulys = dažniausiai >30 °C, sustojimo rizika maža. Izoliuoti, šildyti liemenį, horizontaliai.', d: 0, auto: 240 },
      { n: 'HT II – sumišęs (30,5 °C)', v: { hr: 56, spo2: 91, sys: 104, dia: 64, rr: 10, temp: 30.5, r: 'sinus' }, p: 'Drebulys liovėsi, GKS 9–14. SpO₂ signalas silpnas (šalta periferija). ⏱ Suspausta.', d: 180, auto: 240 },
      { n: 'HT III – be sąmonės (27 °C)', v: { hr: 40, spo2: 86, sys: 84, dia: 50, rr: 6, temp: 27.0, r: 'af' }, p: 'Prieširdžių virpėjimas, didelė sustojimo rizika <30 °C. Minimaliai judinti – vežti į ECLS centrą (<28 °C).', d: 180, auto: 300 },
      { n: 'HT IV – VF', v: { hr: 0, spo2: 80, sys: 0, dia: 0, rr: 0, temp: 26.8, r: 'vf' }, p: 'Šiurkštus perkėlimas / „afterdrop“. KPR; <30 °C – ne daugiau 3 defibriliacijų, kol nesušils.', d: 20 },
      { n: 'Atšildomas', v: { hr: 70, spo2: 95, sys: 102, dia: 62, rr: 12, temp: 32.5, r: 'sinus' }, p: 'Po ECLS / aktyvaus šildymo. Prieširdžių aritmijos šildant dažnos ir praeina savaime.', d: 240 }
    ],
    ev: [{ n: 'Šiurkštus perkėlimas / vertikali padėtis', st: 3 }, { n: 'KPR + defibriliacija + ECLS šildymas', st: 4 }] },

  { id: 'ana', pav: 'Anafilaksija po antibiotiko (ilgalaikė priežiūra)', tema: 'C', sal: 'RCUK 2021 anafilaksija; Pumphrey 2000 (laikas iki sustojimo)', url: 'https://www.resus.org.uk/print/pdf/node/11323',
    aprasas: 'Ilgalaikės priežiūros metu suleistas IV antibiotikas. Jatrogeninės anafilaksijos mediana iki sustojimo – 5 min (Pumphrey 2000), todėl laikas čia beveik realus.',
    st: [
      { n: 'Po 2 min', v: { hr: 118, spo2: 95, sys: 104, dia: 62, rr: 24, temp: 36.8, r: 'sinus' }, p: 'Paraudimas, dilgėlinė, lūpų tinimas (odos požymių gali nebūti ~20 %). Laukiama: sustabdyti vaistą, adrenalinas 0,5 mg IM.', d: 0, auto: 90 },
      { n: 'Anafilaksinis šokas', v: { hr: 142, spo2: 88, sys: 72, dia: 38, rr: 32, temp: 36.8, r: 'sinus' }, p: 'Švokštimas, hipotenzija. Paguldyti, kojas pakelti, O₂, skysčių bolusas.', d: 60, auto: 90 },
      { n: 'Prieš sustojimą', v: { hr: 156, spo2: 80, sys: 54, dia: 28, rr: 36, temp: 36.8, r: 'sinus' }, p: 'Jatrogeninėse reakcijose vyrauja šokas.', d: 60, auto: 60 },
      { n: 'BEA', v: { hr: 120, spo2: 65, sys: 0, dia: 0, rr: 0, temp: 36.8, r: 'pea' }, p: 'ALS + adrenalinas IV, dideli skysčių kiekiai.', d: 30 },
      { n: 'Po 1 adrenalino dozės', v: { hr: 126, spo2: 92, sys: 88, dia: 50, rr: 26, temp: 36.8, r: 'sinus' }, p: 'Dalinis atsakas. RCUK: kartoti IM adrenaliną po 5 min, jei A/B/C problemos išlieka.', d: 90 },
      { n: 'Po 2 dozių + skysčių', v: { hr: 108, spo2: 96, sys: 106, dia: 64, rr: 20, temp: 36.8, r: 'sinus' }, p: 'Jei po 2 dozių negerėja – refrakterinė: adrenalino infuzija (gydytojas). Stebėti ≥6–12 val.', d: 120 }
    ],
    ev: [{ n: 'Adrenalinas 0,5 mg IM', st: 4 }, { n: 'Antra dozė po 5 min + 1 l skysčių', st: 5 }] },

  { id: 'sep', pav: 'Sepsis – 2–3 ilgalaikės priežiūros para', tema: 'PCC', sal: 'Surviving Sepsis Campaign 2021; Sepsis-3 (qSOFA)', url: 'https://sccm.org/sepsisguidelines',
    aprasas: 'Užteršta šlaunies žaizda, evakuacija vėluoja. Para suspausta į ~20 min: qSOFA (KD ≥22, sAKS ≤100, sąmonė) → septinis šokas (VAS <65).',
    st: [
      { n: 'Para 2 – rytas', v: { hr: 108, spo2: 95, sys: 112, dia: 66, rr: 22, temp: 38.6, r: 'sinus' }, p: 'Žaizda parausta, pūliuoja. KD 22 – jau 1 qSOFA kriterijus.', d: 0, auto: 300 },
      { n: 'Sepsis (qSOFA ≥2)', v: { hr: 122, spo2: 93, sys: 96, dia: 52, rr: 26, temp: 39.4, r: 'sinus' }, p: 'Sumišęs, diurezė mažėja. Laukiama: antibiotikai per 1 val., žaizdos revizija, telekonsultacija. ⏱ ~6–12 val. suspausta.', d: 240, auto: 300 },
      { n: 'Septinis šokas', v: { hr: 136, spo2: 90, sys: 78, dia: 40, rr: 30, temp: 39.8, r: 'sinus' }, p: 'VAS ~53. Skysčiai (iki 30 ml/kg), vazopresorius iki VAS ≥65 (SSC 2021).', d: 240, auto: 300 },
      { n: 'Refrakterinis šokas', v: { hr: 148, spo2: 86, sys: 66, dia: 34, rr: 34, temp: 37.5, r: 'sinus' }, p: 'Temperatūra krenta – blogas prognozinis požymis (gali pereiti į hipotermiją). Evakuacijos prioritetas – urgentinis.', d: 240 },
      { n: 'Antibiotikai + skysčiai', v: { hr: 112, spo2: 95, sys: 102, dia: 58, rr: 22, temp: 38.4, r: 'sinus' }, p: 'VAS ~73. Stebėti kas 15–30 min, diurezę.', d: 300 }
    ],
    ev: [{ n: 'Antibiotikai + skysčiai (+ vazopresorius)', st: 4 }] },

  { id: 'cru', pav: 'Crush sindromas – išlaisvinus iš griuvėsių', tema: 'PCC', sal: 'JTS Crush Syndrome PCC CPG (vertimas tccc.org.ua)', url: 'https://tccc.org.ua/en/guide/crush-syndrome-under-prolonged-field-care-pcc',
    aprasas: 'Karys 4 val. prispaustas sienos po apšaudymo. Išlaisvinus – reperfuzija ir hiperkalemija: bradikardija, platūs QRS, VT/VF per minutes.',
    st: [
      { n: 'Prispaustas', v: { hr: 104, spo2: 96, sys: 122, dia: 78, rr: 22, temp: 35.8, r: 'sinus' }, p: 'Prieš išlaisvinimą: IV/IO, 2 l kristaloidų bolusas, paruošti Ca gliukonatą.', d: 0 },
      { n: 'Išlaisvintas – reperfuzija', v: { hr: 120, spo2: 95, sys: 92, dia: 58, rr: 24, temp: 35.8, r: 'sinus' }, p: 'Skystis „išteka“ į galūnę, K⁺ patenka į kraujotaką.', d: 30, auto: 60 },
      { n: 'Hiperkalemija – bradikardija', v: { hr: 44, spo2: 94, sys: 78, dia: 46, rr: 22, temp: 35.8, r: 'hyk' }, p: 'Monitoriuje: bradikardija, P bangų nebėra, platūs QRS, aukšti smailūs T (hiperkalemija, JTS). Laukiama: Ca gliukonatas 10 % 10 ml per 2–3 min, insulinas + gliukozė, salbutamolis.', d: 45, auto: 60 },
      { n: 'Skilvelinė tachikardija', v: { hr: 170, spo2: 90, sys: 70, dia: 40, rr: 24, temp: 35.8, r: 'vt' }, p: 'Plačių kompleksų tachikardija.', d: 20, auto: 45 },
      { n: 'VF', v: { hr: 0, spo2: 80, sys: 0, dia: 0, rr: 0, temp: 35.8, r: 'vf' }, p: 'Defibriliacija + Ca IV + hiperkalemijos gydymas.', d: 15 },
      { n: 'Po Ca + insulino/gliukozės', v: { hr: 92, spo2: 96, sys: 108, dia: 66, rr: 20, temp: 35.9, r: 'sinus' }, p: 'Ca veikia iš karto, 30–60 min; insulinas – po ~20 min, 4–6 val. Gali tekti kartoti. Diurezė 100–200 ml/val.', d: 60 }
    ],
    ev: [{ n: 'Išlaisvinimas', st: 1 }, { n: 'Ca gliukonatas + insulinas/gliukozė', st: 5 }, { n: 'Defibriliacija + Ca', st: 5, shock: true }] },

  { id: 'ehs', pav: 'Šilumos smūgis – žygis su apranga', tema: 'E', sal: 'WikEM „Heat stroke“ (šaltinis – ACSM/CHAMP); Korey Stringer Institute', url: 'https://wikem.org/wiki/Heat_Stroke',
    aprasas: 'Karys sukniubo 12 km žygio pabaigoje karštą dieną. Temperatūra >40 °C + CNS sutrikimas; šaldymas vandenyje ~0,2 °C/min – vienintelis lemiamas veiksmas.',
    st: [
      { n: 'Sukniubo', v: { hr: 142, spo2: 96, sys: 104, dia: 58, rr: 30, temp: 41.2, r: 'sinus' }, p: 'Sumišęs, agresyvus, gali prakaituoti. Laukiama: šaldymas vietoje (ledinis vanduo / brezentas) – „pirma šaldyti, paskui vežti“.', d: 0, auto: 300 },
      { n: 'Traukuliai, hipotenzija', v: { hr: 158, spo2: 92, sys: 84, dia: 44, rr: 36, temp: 42.0, r: 'sinus' }, p: 'Kiekviena šaldymo delsimo minutė didina mirštamumą. ⏱ Suspausta.', d: 240, auto: 240 },
      { n: 'Kraujotakos kolapsas', v: { hr: 170, spo2: 88, sys: 66, dia: 34, rr: 40, temp: 42.4, r: 'sinus' }, p: 'Rabdomiolizė, DIK grėsmė.', d: 180, auto: 120 },
      { n: 'VF', v: { hr: 0, spo2: 80, sys: 0, dia: 0, rr: 0, temp: 42.3, r: 'vf' }, p: 'ALS + šaldymas tęsiamas.', d: 30 },
      { n: 'Šaldomas vandenyje (10 min)', v: { hr: 122, spo2: 97, sys: 108, dia: 60, rr: 24, temp: 39.2, r: 'sinus' }, p: 'Šaldymas vandenyje ~0,2 °C/min: per 10 min ~−2 °C. Tikslas – 39 °C per 30 min.', d: 600, auto: 240 },
      { n: 'Atvėsintas – stabdyti', v: { hr: 104, spo2: 98, sys: 114, dia: 66, rr: 20, temp: 38.8, r: 'sinus' }, p: 'Nutraukti šaldymą ~39 °C, kad neperšaltų. Stebėti diurezę (rabdomiolizė).', d: 180 }
    ],
    ev: [{ n: 'Šaldymas vandenyje / ledu', st: 4 }] },

  { id: 'opi', pav: 'Kvėpavimo slopinimas po opioidų (skausmo malšinimas)', tema: 'B', sal: 'NHS Scotland Right Decisions – opioidų sukeltas kvėpavimo slopinimas', url: 'https://www.rightdecisions.scot.nhs.uk/shared-content/palliative-care/palliative-care/opioids/life-threatening-opioid-induced-respiratory-depression-requiring-naloxone/',
    aprasas: 'Sužeistasis su blauzdos lūžiu gavo fentanilio, vėliau pakartotinę dozę (+ ketaminas). Pavojinga riba – KD <8 ir SpO₂ <85 %.',
    st: [
      { n: 'Po fentanilio', v: { hr: 88, spo2: 95, sys: 118, dia: 74, rr: 12, temp: 36.4, r: 'sinus' }, p: 'Skausmas sumažėjo, mieguistas. Kas 15 min – sąmonė, KD, SpO₂.', d: 0, auto: 180 },
      { n: 'Sedacija, KD 8', v: { hr: 76, spo2: 89, sys: 108, dia: 66, rr: 8, temp: 36.4, r: 'sinus' }, p: 'Sunkiai pažadinamas, siauri vyzdžiai. ⏱ Suspausta.', d: 120, auto: 120 },
      { n: 'Hipoventiliacija', v: { hr: 70, spo2: 80, sys: 102, dia: 62, rr: 4, temp: 36.3, r: 'sinus' }, p: 'Gyvybei pavojinga (KD <8, SpO₂ <85 %). Laukiama: kvėpavimo takai, BVM, naloksonas.', d: 90, auto: 90 },
      { n: 'Apnėja – hipoksinė bradikardija', v: { hr: 42, spo2: 60, sys: 84, dia: 48, rr: 0, temp: 36.3, r: 'sinus' }, p: 'Ventiliuoti BVM pirmiausia.', d: 60, auto: 60 },
      { n: 'BEA', v: { hr: 30, spo2: 45, sys: 0, dia: 0, rr: 0, temp: 36.2, r: 'pea' }, p: 'Hipoksinis sustojimas – ALS.', d: 30 },
      { n: 'Po BVM + naloksono', v: { hr: 96, spo2: 95, sys: 124, dia: 78, rr: 14, temp: 36.3, r: 'sinus' }, p: 'Naloksonas IV veikia per 1–2 min (IM 2–5 min), trunka 15–90 min – trumpiau nei opioidas: gali vėl užmigti. Titruoti iki KD ≥8, ne iki sąmonės.', d: 90 }
    ],
    ev: [{ n: 'BVM ventiliacija + naloksonas', st: 5 }] },

  { id: 'vf', pav: 'Skilvelių virpėjimas – elektros trauma', tema: 'C', sal: 'StatPearls „Electrical Injuries“ (CC BY-NC-ND); ERC ALS', url: 'https://www.ncbi.nlm.nih.gov/books/NBK448087/',
    aprasas: 'Karys palietė pažeistą generatoriaus kabelį (žemos įtampos kintamoji srovė). VF galima jau nuo 50–120 mA.',
    st: [
      { n: 'VF', v: { hr: 0, spo2: 85, sys: 0, dia: 0, rr: 0, temp: 36.4, r: 'vf' }, p: 'Saugumas (srovė išjungta?) → KPR, defibriliacija kuo greičiau.', d: 0, auto: 240 },
      { n: 'Asistolija (negydomas)', v: { hr: 0, spo2: 60, sys: 0, dia: 0, rr: 0, temp: 36.3, r: 'asys' }, p: 'Be defibriliacijos VF per kelias minutes pereina į smulkiabangį VF / asistoliją.', d: 120 },
      { n: 'Po defibriliacijos – ROSC', v: { hr: 112, spo2: 92, sys: 98, dia: 60, rr: 10, temp: 36.4, r: 'sinus' }, p: 'Grįžo savaiminė kraujotaka. Ventiliacija, 12 der. EKG, ieškoti nudegimų (įėjimo/išėjimo).', d: 20 },
      { n: 'Stabilizuotas', v: { hr: 96, spo2: 97, sys: 118, dia: 72, rr: 14, temp: 36.4, r: 'sinus' }, p: 'Monitoruoti – galimos vėlyvos aritmijos (rizika maža po 24–48 val.).', d: 120 }
    ],
    ev: [{ n: 'Defibriliacija + KPR', st: 2, shock: true }] },

  { id: 'tca', pav: 'Trauminis sustojimas – BEA (HOTT)', tema: 'C', sal: 'JK GM CGO „Traumatic Cardiac Arrest“; FPHC RCSEd 2024', url: 'https://cgo.mod.uk/clinical-guidelines-for-operations/resuscitation-guidelines/traumatic-cardiac-arrest/',
    aprasas: 'Sprogimas: kojų amputacijos ir krūtinės sužalojimas. Mokoma HOTT sekos: kraujavimas → kvėpavimo takai → abipusė torakostomija → kraujas; paspaudimai – antraeiliai.',
    st: [
      { n: 'Prieš sustojimą', v: { hr: 150, spo2: 78, sys: 58, dia: 36, rr: 36, temp: 35.4, r: 'sinus' }, p: 'IV kl. šokas + įtampos PTX dešinėje.', d: 0, auto: 60 },
      { n: 'BEA', v: { hr: 96, spo2: 60, sys: 0, dia: 0, rr: 0, temp: 35.3, r: 'pea' }, p: 'Gyvybės požymių nėra, ritmas organizuotas. MARCH: turniketai, i-gel, abipusė torakostomija, kraujas + Ca, TXA.', d: 30, auto: 240 },
      { n: 'BEA – lėtėja', v: { hr: 44, spo2: 50, sys: 0, dia: 0, rr: 0, temp: 35.2, r: 'pea' }, p: 'Laikas bėga: sprendimas dėl beviltiškumo ~20 min (CGO).', d: 120, auto: 240 },
      { n: 'Asistolija', v: { hr: 0, spo2: 40, sys: 0, dia: 0, rr: 0, temp: 35.0, r: 'asys' }, p: 'Prognozė labai bloga.', d: 60 },
      { n: 'Po torakostomijos – silpnas pulsas', v: { hr: 132, spo2: 86, sys: 64, dia: 40, rr: 12, temp: 35.3, r: 'sinus' }, p: 'Įtampa pašalinta, hipovolemija lieka. KD – ventiliacija 12–18/min.', d: 30 },
      { n: 'Kraujas + Ca – ROSC', v: { hr: 116, spo2: 95, sys: 96, dia: 60, rr: 14, temp: 35.5, r: 'sinus' }, p: 'Šildyti, skubi evakuacija į chirurgiją.', d: 120 }
    ],
    ev: [{ n: 'Abipusė torakostomija', st: 4 }, { n: 'Kraujas + Ca + kraujavimo kontrolė', st: 5 }] },

  { id: 'norm', pav: 'Normalūs rodikliai', tema: '–', sal: 'Tipinės suaugusiojo ramybės reikšmės', url: '', aprasas: 'Pradinė būsena prieš scenarijų.', st: [
    { n: 'Norma', v: { hr: 78, spo2: 98, sys: 122, dia: 78, rr: 14, temp: 36.6, r: 'sinus' }, p: 'Pradinė būsena.', d: 0 }
  ], ev: [] }
];
