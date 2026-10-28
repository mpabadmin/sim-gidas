'use strict';
// ───────── SIM – įtaisyti treniruočių scenarijai (kariniai) ─────────
// Kiekvienas etapas – tikslinės monitoriaus reikšmės (hr, spo2, sys, dia, rr, temp, r – ritmas) ir trumpa pastaba instruktoriui.
// Reikšmės – mokymo tikslams pagal tipinę fiziologiją (ATLS / ETC šoko klasės, TCCC); tai ne klinikinės gairės.
window.SIMS = [
  { id: 'hem', pav: 'Hemoraginis šokas – šlaunies skeveldra', tema: 'C', st: [
    { n: 'Atvežtas', v: { hr: 128, spo2: 95, sys: 94, dia: 66, rr: 24, temp: 35.8, r: 'sinus' }, p: 'Turniketas uždėtas, kraujuoja per turniketą. Laukiama: turniketo patikra / antras, šoko vertinimas, prieiga, TXA, kraujas.' },
    { n: 'Kraujavimas sustabdytas, kraujas', v: { hr: 106, spo2: 97, sys: 108, dia: 70, rr: 20, temp: 36.0 }, p: 'Po kraujo vieneto ir kalcio. Tikslas – sAKS pagal ETC / radialinis pulsas.' },
    { n: 'Negydomas – blogėja', v: { hr: 148, spo2: 92, sys: 72, dia: 44, rr: 32, temp: 35.2 }, p: 'IV klasė: sumišęs, blyškus. Jei nieko nedaroma – BEA.' },
    { n: 'BEA', v: { hr: 52, spo2: 92, sys: 0, dia: 0, rr: 0, r: 'pea' }, p: 'Trauminis širdies sustojimas: HOTT (hipovolemija) – kraujavimo kontrolė, kraujas, abipusė dekompresija.' }
  ] },
  { id: 'tpx', pav: 'Įtampos pneumotoraksas – kulka krūtinėje', tema: 'B', st: [
    { n: 'Pradžia', v: { hr: 118, spo2: 89, sys: 112, dia: 74, rr: 30, temp: 36.4, r: 'sinus' }, p: 'Dešinėje kvėpavimas susilpnėjęs, krūtinė kyla nevienodai. Okliuzinis tvarstis uždėtas.' },
    { n: 'Blogėja', v: { hr: 142, spo2: 80, sys: 78, dia: 52, rr: 38 }, p: 'Išsipūtusios kaklo venos, trachėja pasislinkusi (vėlyvas požymis). Laukiama: dekompresija.' },
    { n: 'Po dekompresijos', v: { hr: 104, spo2: 95, sys: 114, dia: 74, rr: 22 }, p: 'Pagerėjo per 1–2 min. Toliau – pirštinė torakostomija / drenas, stebėti pasikartojimą.' },
    { n: 'Negydomas – BEA', v: { hr: 46, spo2: 70, sys: 0, dia: 0, rr: 0, r: 'pea' }, p: 'Obstrukcinis širdies sustojimas – abipusė dekompresija nedelsiant.' }
  ] },
  { id: 'tbi', pav: 'Galvos smegenų trauma – išvaržos grėsmė', tema: 'D', st: [
    { n: 'Pradžia', v: { hr: 86, spo2: 96, sys: 138, dia: 84, rr: 16, temp: 36.6, r: 'sinus' }, p: 'Sprogimas, GKS 9, vyzdžiai vienodi. Tikslai: SpO₂, sAKS ir CO₂ pagal ETC.' },
    { n: 'Kušingo reakcija', v: { hr: 50, spo2: 91, sys: 186, dia: 98, rr: 8 }, p: 'Kairysis vyzdys platus, nereaguoja, GKS 6. Laukiama: KT apsauga, galva 30°, hipertoninis NaCl / manitolis pagal gydytoją.' },
    { n: 'Po neuroprotekcijos', v: { hr: 72, spo2: 98, sys: 148, dia: 86, rr: 14 }, p: 'Laikinas pagerėjimas – skubi evakuacija neurochirurgijai.' }
  ] },
  { id: 'tam', pav: 'Širdies tamponada – skeveldra krūtinėje', tema: 'C', st: [
    { n: 'Pradžia', v: { hr: 128, spo2: 95, sys: 88, dia: 72, rr: 26, temp: 36.2, r: 'sinus' }, p: 'Žaizda pavojaus zonoje, išsipūtusios kaklo venos, siauras pulsinis spaudimas. e-FAST – skystis perikarde.' },
    { n: 'Blogėja', v: { hr: 146, spo2: 92, sys: 68, dia: 58, rr: 32 }, p: 'Bekas: hipotenzija, išsipūtusios venos, duslūs tonai.' },
    { n: 'BEA', v: { hr: 110, spo2: 90, sys: 0, dia: 0, rr: 0, r: 'pea' }, p: 'HOTT (tamponada) – gydytojo sprendimu torakotomija.' },
    { n: 'Po dekompresijos', v: { hr: 112, spo2: 96, sys: 98, dia: 64, rr: 20, r: 'sinus' }, p: 'Grįžo kraujotaka – skubiai į operacinę.' }
  ] },
  { id: 'aw', pav: 'Kvėpavimo takų obstrukcija – veido trauma', tema: 'A', st: [
    { n: 'Pradžia', v: { hr: 122, spo2: 90, sys: 132, dia: 82, rr: 30, temp: 36.5, r: 'sinus' }, p: 'Burnoje kraujas ir dantys, burbuliavimas. Laukiama: Escape (KT), atsiurbimas, padėtis.' },
    { n: 'Blogėja', v: { hr: 138, spo2: 79, sys: 144, dia: 88, rr: 36 }, p: 'Kaukė neveiksminga, intubacija nepavyko – CICO.' },
    { n: 'Prieš sustojimą', v: { hr: 44, spo2: 62, sys: 82, dia: 50, rr: 4 }, p: 'Hipoksinė bradikardija – krikotiroidotomija nedelsiant.' },
    { n: 'Po krikotiroidotomijos', v: { hr: 112, spo2: 96, sys: 124, dia: 78, rr: 16 }, p: 'Ventiliacija per vamzdelį, patvirtinti kapnografija (gide).' }
  ] },
  { id: 'brn', pav: 'Nudegimai 30 % ir įkvėpimo trauma', tema: 'E', st: [
    { n: 'Pradžia', v: { hr: 114, spo2: 94, sys: 128, dia: 80, rr: 26, temp: 36.3, r: 'sinus' }, p: 'Šarvuočio gaisras. Apdegę antakiai, suodžiai, užkimęs balsas – ankstyva intubacija.' },
    { n: 'Po 2 val.', v: { hr: 124, spo2: 91, sys: 108, dia: 68, rr: 30, temp: 35.8 }, p: 'Diurezė maža. Skysčiai pagal Parkland, titruoti pagal diurezę; šildyti.' },
    { n: 'Stabilizuotas', v: { hr: 104, spo2: 97, sys: 118, dia: 72, rr: 18, temp: 36.4 }, p: 'Intubuotas, skysčiai titruojami.' }
  ] },
  { id: 'hyp', pav: 'Hipotermija – ištrauktas iš vandens', tema: 'E', st: [
    { n: 'Pradžia', v: { hr: 52, spo2: 92, sys: 92, dia: 58, rr: 10, temp: 31.8, r: 'sinus' }, p: 'Drebulys liovėsi, mieguistas. SpO₂ signalas silpnas (šalta periferija). Švelniai elgtis, šildyti.' },
    { n: 'Prieširdžių virpėjimas', v: { hr: 44, spo2: 90, sys: 84, dia: 50, rr: 8, temp: 30.6, r: 'af' }, p: 'Vertimas sukėlė aritmiją – minimaliai judinti.' },
    { n: 'Skilvelių virpėjimas', v: { hr: 0, spo2: 88, sys: 0, dia: 0, rr: 0, r: 'vf' }, p: 'Širdies sustojimas hipotermijos metu – gaivinimas, šildymas.' },
    { n: 'Atšildomas', v: { hr: 72, spo2: 96, sys: 108, dia: 66, rr: 14, temp: 34.2, r: 'sinus' }, p: 'Aktyvus šildymas.' }
  ] },
  { id: 'ana', pav: 'Anafilaksija po antibiotiko', tema: 'C', st: [
    { n: 'Pradžia', v: { hr: 136, spo2: 89, sys: 76, dia: 40, rr: 30, temp: 36.8, r: 'sinus' }, p: 'Po IV antibiotiko – bėrimas, švokštimas, lūpų tinimas. Laukiama: sustabdyti vaistą, adrenalinas IM.' },
    { n: 'Po adrenalino', v: { hr: 112, spo2: 95, sys: 102, dia: 64, rr: 22 }, p: 'Gerėja. Stebėti – reakcija gali kartotis.' }
  ] },
  { id: 'vf', pav: 'Skilvelių virpėjimas – elektros trauma', tema: 'C', st: [
    { n: 'VF', v: { hr: 0, spo2: 90, sys: 0, dia: 0, rr: 0, temp: 36.4, r: 'vf' }, p: 'Netrauminis sustojimas – ALS: defibriliacija.' },
    { n: 'Po defibriliacijos', v: { hr: 108, spo2: 94, sys: 96, dia: 60, rr: 12, r: 'sinus' }, p: 'Grįžo savaiminė kraujotaka.' }
  ] },
  { id: 'sep', pav: 'Sepsis – 2 ilgalaikės priežiūros para', tema: 'PCC', st: [
    { n: 'Pradžia', v: { hr: 116, spo2: 94, sys: 98, dia: 56, rr: 24, temp: 38.9, r: 'sinus' }, p: 'Žaizda parausta, pūliuoja. Diurezė mažėja.' },
    { n: 'Septinis šokas', v: { hr: 134, spo2: 91, sys: 78, dia: 40, rr: 30, temp: 39.6 }, p: 'Teleconsultacija, antibiotikai, skysčiai / vazopresoriai pagal gydytoją.' },
    { n: 'Gerėja', v: { hr: 102, spo2: 96, sys: 108, dia: 64, rr: 20, temp: 38.0 }, p: 'Stebėti kas 15–30 min.' }
  ] },
  { id: 'norm', pav: 'Normalūs rodikliai', tema: '–', st: [
    { n: 'Norma', v: { hr: 78, spo2: 98, sys: 122, dia: 78, rr: 14, temp: 36.6, r: 'sinus' }, p: 'Pradinė būsena.' }
  ] }
];
