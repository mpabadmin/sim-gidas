// ───────── Pulse komentarai instruktoriui: kai modelis rodo kritinę būklę – galimos priežastys ir ką daryti ─────────
// Vertinama monitoriaus pusėje pagal Pulse rodiklius ir pažymėtus veiksmus. Tai mokymo užuominos, ne diagnozė.
const PULSE_CM = (() => {
  const ago = (t, t0) => { const m = Math.round((t - t0) / 60); return m < 1 ? 'ką tik' : 'prieš ' + m + ' min'; };
  const r0 = n => Math.round(n);
  // kontekstas iš veiksmų sąrašo [{a, t}]
  function ctx(list, t) {
    const c = { tpx: {}, aw: 0, tbi: 0, eff: 0, burn: 0, arrest: '', drugs: [], cryst: 0, blood: 0, intub: false, o2: false, hem: 0 };
    list.forEach(({ a, t: ta }) => {
      switch (a.k) {
        case 'tpx': c.tpx[a.side || 'L'] = { sev: +a.sev || 0.6, open: !!a.open, t: ta }; break;
        case 'ndc': if (c.tpx[a.side || 'L']) c.tpx[a.side || 'L'].done = ta; break;
        case 'occl': if (c.tpx[a.side || 'L'] && c.tpx[a.side || 'L'].open) c.tpx[a.side || 'L'].done = ta; break;
        case 'aw': c.aw = +a.sev || 0; break;
        case 'intub': c.intub = true; c.aw = 0; break;
        case 'o2': c.o2 = true; break;
        case 'o2_off': c.o2 = false; break;
        case 'tbi': c.tbi = +a.sev || 0.5; break;
        case 'eff': c.eff = +a.rate || 0; c.effT = ta; break;
        case 'burn': c.burn = +a.tbsa || 0; break;
        case 'arrest': c.arrest = a.rhythm === 'NormalSinus' ? '' : (a.rhythm || 'Asystole'); c.arrT = ta; break;
        case 'bolus': c.drugs.push({ s: a.sub, mg: +a.mg, r: a.route || 'IV', t: ta }); break;
        case 'inf': if (a.cmp === 'Blood' || a.cmp === 'PackedRBC' || a.cmp === 'Plasma') c.blood += +a.ml || 0; else c.cryst += +a.ml || 0; break;
        case 'hem': c.hem = Math.max(c.hem, +a.sev || 0); break;
      }
    });
    c.tpxOpen = Object.keys(c.tpx).filter(s => !c.tpx[s].done);
    const last = (names, win) => c.drugs.filter(d => names.indexOf(d.s) >= 0 && t - d.t <= win).pop();
    c.opioid = last(['Morphine', 'Fentanyl'], 2400);
    c.nalox = last(['Naloxone'], 900);
    c.ket = last(['Ketamine'], 600);
    c.mid = last(['Midazolam'], 2400);
    c.epi = last(['Epinephrine'], 1200);
    return c;
  }
  const side = s => s === 'R' ? 'dešinėje' : 'kairėje';
  // taisyklės: grąžina {id, lvl, title, why[], todo[]} arba null
  function rules(v, c, x) {
    const out = [], loss = x.bv0 && v.bv ? x.bv0 - v.bv : 0, lossP = x.bv0 ? loss / x.bv0 : 0, t = x.t;
    const shockWhy = (why, todo) => {
      if (x.hems.length || lossP > 0.15) {
        why.push(`Kraujo netekimas ≈ ${r0(loss / 50) * 50} ml (${r0(lossP * 100)} % tūrio${lossP > 0.4 ? ', IV klasė' : lossP > 0.3 ? ', III klasė' : lossP > 0.15 ? ', II klasė' : ''})${x.hems.length ? ' – kraujavimas vis dar nesustabdytas' : ''}.`);
        if (x.hems.length) todo.push('Sustabdyti kraujavimą: turniketas, tamponavimas, spaudimas.');
        todo.push('Pilnas kraujas / eritrocitai (ne kristaloidai).');
      }
      if (c.tpxOpen.length) { why.push(`Neišspręstas įtampos pneumotoraksas ${c.tpxOpen.map(side).join(' ir ')} – obstrukcinis šokas.`); todo.push('Adatinė dekompresija pažeistoje pusėje.'); }
      if (c.eff > 0) { why.push('Skystis perikarde (tamponada) – širdis negali prisipildyti.'); todo.push('Perikardiocentezė / skubi chirurginė pagalba.'); }
      if (c.burn > 0.15) { why.push(`Nudegimai ${r0(c.burn * 100)} % – plazmos netekimas.`); todo.push('Skysčiai pagal nudegimų skaičiuoklę.'); }
      if (c.mid && t - c.mid.t < 1200) why.push(`Midazolamas ${ago(t, c.mid.t)} – kraujagyslių išsiplėtimas, AKS mažėja.`);
      if (c.opioid && t - c.opioid.t < 1200 && lossP > 0.15) why.push(`Opioidas (${c.opioid.s === 'Fentanyl' ? 'fentanilis' : 'morfinas'}) ${ago(t, c.opioid.t)} šokinio paciento AKS sumažina labiau.`);
      if (c.cryst >= 1000 && lossP > 0.2) why.push(`Sulašinta ${c.cryst} ml kristaloidų – kraujas praskiedžiamas, krešėjimas blogėja.`);
    };
    // 1. širdies sustojimas / nėra pulso
    if (!x.live || (v.hr != null && v.hr < 20) || (v.sys != null && v.sys < 30)) {
      const why = [], todo = [];
      if (c.arrest) why.push(`Instruktorius sukėlė širdies sustojimą (${c.arrest === 'Asystole' ? 'asistolija' : 'skilvelių virpėjimas'}) ${ago(t, c.arrT)}.`);
      if (lossP > 0.35) why.push(`Masyvus kraujo netekimas ≈ ${r0(loss / 50) * 50} ml (${r0(lossP * 100)} %) – nukraujavimas.`);
      if (c.tpxOpen.length) why.push(`Nedekompresuotas įtampos pneumotoraksas ${c.tpxOpen.map(side).join(' ir ')}.`);
      if (c.eff > 0) why.push('Širdies tamponada.');
      if (x.minSpo2 < 70) why.push(`Ilgalaikė hipoksija (SpO₂ buvo ${r0(x.minSpo2)} %).`);
      if (c.aw > 0) why.push('Neatverti kvėpavimo takai.');
      if (c.opioid || c.mid) why.push('Vaistais nuslopintas kvėpavimas → hipoksija.');
      if (c.tbi >= 0.6) why.push('Sunki galvos smegenų trauma.');
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra.');
      todo.push('Trauminis sustojimas: pirmiausia grįžtamos priežastys – kraujavimo kontrolė ir kraujas, abipusė adatinė dekompresija, kvėpavimo takai ir ventiliacija.');
      todo.push('KPR pagal ALS; SpO₂ be pulso – nepatikimas.');
      if (c.arrest && c.arrest !== 'Asystole') todo.push('Skilvelių virpėjimas – defibriliacija.');
      out.push({ id: 'arrest', lvl: 'crit', title: 'Širdies sustojimas – nėra pulso', why, todo });
      return out;   // kiti komentarai šiuo metu nebeaktualūs
    }
    // 2. apnėja / labai retas kvėpavimas
    if (v.rr != null && v.rr < 7) {
      const why = [], todo = [];
      if (c.ket && c.ket.r === 'IV' && t - c.ket.t < 400) { why.push(`Ketaminas ${c.ket.mg} mg IV ${ago(t, c.ket.t)}: greita injekcija gali sukelti trumpalaikę apnėją; dažniausiai praeina per 1–3 min.`); todo.push('Atverti kvėpavimo takus, ventiliuoti maišu su O₂; kitą kartą ketaminą leisti lėtai (per ~1 min).'); }
      if (c.opioid) { why.push(`Opioidas (${c.opioid.s === 'Fentanyl' ? 'fentanilis' : 'morfinas'} ${c.opioid.s === 'Fentanyl' ? r0(c.opioid.mg * 1000) + ' mcg' : c.opioid.mg + ' mg'}) ${ago(t, c.opioid.t)} slopina kvėpavimo centrą${c.nalox ? '; naloksono poveikis trumpesnis už opioido – slopinimas gali grįžti' : ''}.`); todo.push('Naloksonas 0,4 mg IV, prireikus kartoti kas 2–3 min; ventiliacija maišu.'); }
      if (c.mid) { why.push(`Midazolamas ${ago(t, c.mid.t)} – kvėpavimo slopinimas (ypač kartu su opioidais ar ketaminu).`); todo.push('Ventiliacija maišu; stebėti SpO₂.'); }
      if (c.tbi >= 0.6) { why.push('Sunki galvos smegenų trauma – didėjantis intrakranijinis spaudimas slopina kvėpavimo centrą.'); todo.push('Ventiliacija, galva pakelta 30°, skubi evakuacija.'); }
      if (lossP > 0.35 || (v.sys != null && v.sys < 60)) { why.push('Gilus šokas – retas, agoninis kvėpavimas prieš sustojimą.'); todo.push('Kraujavimo kontrolė ir kraujas nedelsiant.'); }
      if (c.aw > 0) { why.push('Kvėpavimo takų obstrukcija.'); todo.push('Atverti kvėpavimo takus (manevrai, NPA), prireikus krikotirotomija.'); }
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra – gali būti modelio ypatumas; vertinkite kliniškai.');
      out.push({ id: 'apnea', lvl: 'crit', title: `Apnėja / labai retas kvėpavimas (KD ${r0(v.rr)})`, why, todo });
    }
    // 3. hipoksija
    if (v.spo2 != null && v.spo2 < 88) {
      const why = [], todo = [];
      if (c.tpxOpen.length) { why.push(`Įtampos pneumotoraksas ${c.tpxOpen.map(side).join(' ir ')} – plautis subliuškęs.`); todo.push(c.tpxOpen.some(k => c.tpx[k].open) ? 'Okliuzinis tvarstis; jei blogėja – adatinė dekompresija.' : 'Adatinė dekompresija.'); }
      if (c.aw > 0) { why.push('Kvėpavimo takų obstrukcija.'); todo.push('Atverti kvėpavimo takus, NPA, atsiurbti; prireikus krikotirotomija.'); }
      if (v.rr != null && v.rr < 10) { why.push(`Hipoventiliacija (KD ${r0(v.rr)})${c.opioid || c.mid ? ' dėl vaistų' : ''}.`); todo.push('Ventiliacija maišu' + (c.opioid ? ', naloksonas.' : '.')); }
      if (c.eff > 0 || (v.sys != null && v.sys < 80)) why.push('Maža širdies išstūma – audiniai gauna mažai deguonies.');
      if (c.intub && !c.o2) why.push('Intubuotas pacientas kvėpuoja savarankiškai be papildomo O₂.');
      if (!c.o2) todo.push('Deguonis.');
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra.');
      out.push({ id: 'hypox', lvl: v.spo2 < 80 ? 'crit' : 'warn', title: `Hipoksija (SpO₂ ${r0(v.spo2)} %)`, why, todo });
    }
    // 4. šokas
    if (v.sys != null && (v.sys < 90 || (v.hr > 120 && v.sys < 100))) {
      const why = [], todo = [];
      shockWhy(why, todo);
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra.');
      out.push({ id: 'shock', lvl: v.sys < 70 ? 'crit' : 'warn', title: `Šokas (AKS ${r0(v.sys)}/${r0(v.dia)}, ŠSD ${r0(v.hr)})`, why, todo });
    }
    // 5. ryški tachikardija be šoko
    else if (v.hr != null && v.hr > 140) {
      const why = [], todo = [];
      if (c.epi) why.push(`Adrenalinas ${c.epi.mg} mg ${c.epi.r} ${ago(t, c.epi.t)} – laikina tachikardija ir hipertenzija.`);
      if (c.ket) why.push(`Ketaminas ${ago(t, c.ket.t)} – simpatinė stimuliacija (ŠSD ir AKS ↑).`);
      if (c.tpxOpen.length) { why.push('Didėjantis įtampos pneumotoraksas.'); todo.push('Adatinė dekompresija.'); }
      if (c.aw > 0 || (v.spo2 != null && v.spo2 < 92)) why.push('Hipoksija / kvėpavimo nepakankamumas.');
      if (x.hems.length || lossP > 0.15) { why.push(`Kompensuojamas kraujo netekimas ≈ ${r0(loss / 50) * 50} ml – AKS dar laikosi, bet netrukus kris.`); todo.push('Sustabdyti kraujavimą, ruošti kraują.'); }
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra (skausmas, stresas modelyje nevertinami).');
      out.push({ id: 'tachy', lvl: 'warn', title: `Ryški tachikardija (ŠSD ${r0(v.hr)})`, why, todo });
    }
    // 6. bradikardija
    if (v.hr != null && v.hr >= 20 && v.hr < 50) {
      const why = [], todo = [];
      if (c.tbi >= 0.6) { why.push('Sunki GST – Cushingo reakcija (bradikardija, hipertenzija, nereguliarus kvėpavimas).'); todo.push('Ventiliacija, galva 30°, skubi neurochirurginė evakuacija.'); }
      if (c.opioid || c.mid) why.push('Opioidų / benzodiazepinų poveikis.');
      if (v.spo2 != null && v.spo2 < 80) { why.push('Gili hipoksija – bradikardija prieš sustojimą.'); todo.push('Oksigenacija ir ventiliacija nedelsiant.'); }
      if (lossP > 0.4) why.push('Dekompensuotas hemoraginis šokas – priešmirtinė bradikardija.');
      if (!why.length) why.push('Aiškios priežasties tarp pažymėtų veiksmų nėra.');
      out.push({ id: 'brady', lvl: v.hr < 40 ? 'crit' : 'warn', title: `Bradikardija (ŠSD ${r0(v.hr)})`, why, todo });
    }
    // 7. hipotermija
    if (v.temp != null && v.temp < 35) out.push({ id: 'cold', lvl: 'warn', title: `Hipotermija (T ${String(v.temp.toFixed(1)).replace('.', ',')} °C)`, why: ['Kraujo netekimas, šalti skysčiai, aplinka.'], todo: ['Šildymas (HPMK), šildyti skysčiai ir kraujas.'] });
    return out;
  }
  // būsena per sesiją
  let S = null;
  function reset() { S = { bv0: 0, minSpo2: 100, active: {}, off: {}, list: [] }; }
  reset();
  // kviečiama su kiekvienu rodiklių paketu; grąžina naujus komentarus
  function evaluate(v, list, x) {
    if (!v) return [];
    if (!S.bv0 && v.bv) S.bv0 = v.bv;
    if (v.spo2 != null && v.hr > 20) S.minSpo2 = Math.min(S.minSpo2, v.spo2);
    const c = ctx(list, x.t), now = rules(v, c, { bv0: S.bv0, minSpo2: S.minSpo2, t: x.t, live: x.live, hems: x.hems || [] });
    const ids = now.map(r => r.id), fresh = [];
    now.forEach(r => {
      if (!S.active[r.id]) { S.active[r.id] = true; r.t = x.t; S.list.unshift(r); fresh.push(r); }
      else { const old = S.list.find(o => o.id === r.id && !o.end); if (old) { old.title = r.title; old.why = r.why; old.todo = r.todo; old.lvl = r.lvl; } }
      delete S.off[r.id];
    });
    // komentaras užsidaro, kai būklė praeina ≥ 60 s modelio laiko
    Object.keys(S.active).forEach(id => {
      if (ids.indexOf(id) >= 0) return;
      if (S.off[id] == null) S.off[id] = x.t;
      else if (x.t - S.off[id] >= 60) { delete S.active[id]; delete S.off[id]; const o = S.list.find(o => o.id === id && !o.end); if (o) o.end = x.t; }
    });
    S.list = S.list.slice(0, 12);
    return fresh;
  }
  const list = () => S.list.slice(0, 6).map(o => ({ id: o.id, lvl: o.lvl, title: o.title, why: o.why, todo: o.todo, t: o.t, end: o.end }));
  return { evaluate, list, reset, ctx, rules };
})();
