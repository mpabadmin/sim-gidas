'use strict';
// ───────── Telefono modelis (taisyklių, be Pulse) – vietinis variklis telefone ─────────
// Kalba tuo pačiu protokolu kaip Pulse serveris (server/pulse_server.py): hello → info, start → started, act → ack,
// kas ~1 s – vit; speed, skip, pause/run, stop, resume. Todėl monitoriaus logika (pulse.js) ta pati abiem varikliams.
// Fiziologija supaprastinta, mokomoji (≈ visas variklis): netektas kraujas → ATLS šoko klasės; pneumotorakso įtampos
// indeksas; hemotoraksas; deguonis; temperatūra; vaistai; sustojimas ir HOTT. Skaičiai – TCCC / ETC / ATLS mokomosios reikšmės.
const PLOCAL = (() => {
  const ENGINE = 'Telefono modelis', VERSION = 'r3 · 2026-11';
  const KEY = 'sim-plocal';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (x, P) => { if (x <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const a = P[i - 1], b = P[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return P[P.length - 1][1]; };
  // didžiausias kraujavimo greitis (ml/min) skyriui, kai sunkumas 1,0
  const HEM_MAX = { RightLeg: 250, LeftLeg: 250, RightArm: 150, LeftArm: 150, Spleen: 150, Liver: 200, Aorta: 1000, VenaCava: 600, SmallIntestine: 60, LargeIntestine: 60, Splanchnic: 100, RightKidney: 80, LeftKidney: 80, Skin: 40, Muscle: 80 };
  // sunkumas → dalis (lengvas 0,2 → 15 ml/min, vidutinis 0,45 → 40, sunkus 0,7 → 100, masyvus 1,0 → 250 – šlauniai)
  const SEVF = [[0, 0], [0.2, 0.06], [0.45, 0.16], [0.7, 0.4], [1, 1]];
  const HTXR = [[0, 0], [0.2, 5], [0.45, 15], [0.7, 40], [1, 100]];
  // ATLS: deficito dalis → [ŠSD, sAKS, dAKS, KD]
  const ATLS = [[0, 80, 124, 80, 14], [0.15, 96, 122, 86, 18], [0.30, 115, 108, 82, 24], [0.40, 132, 86, 60, 30], [0.50, 145, 64, 42, 36], [0.56, 60, 45, 25, 10]];
  const atls = d => { d = Math.max(0, d); for (let i = 1; i < ATLS.length; i++) if (d <= ATLS[i][0]) { const a = ATLS[i - 1], b = ATLS[i], t = (d - a[0]) / (b[0] - a[0]); return [1, 2, 3, 4].map(k => a[k] + (b[k] - a[k]) * t); } return ATLS[ATLS.length - 1].slice(1); };
  // vaistai: [veikimo trukmės konstanta min (eksponentinis mažėjimas), „vieneto“ dozė mg]
  // naloksonas veikia trumpiau nei opioidai (30 min prieš 45 / 90) – galimas pakartotinis slopinimas
  const DRUG = { ket: [15, 25], fen: [45, 0.05], mor: [90, 5], nal: [30, 0.4], mid: [60, 2], adr: [3, 1], roc: [45, 50], hts: [120, 1], man: [120, 1] };
  // veikimo pradžia pagal vartojimo būdą: laikas (min), per kurį pasiekiama pusė poveikio (Hill n = 3: ~10 % – po pusės šio laiko, ~90 % – po dvigubo).
  // Fentanilis IV / IO 2–3 min (pikas ≈ 5), IN ≈ 10; morfinas IV 5–10 (pikas 15–20), IM 15–30; ketaminas IV ≈ 1, IM ≈ 5, IN ≈ 10; naloksonas IV 1–2, IM / IN 3–5.
  const ONSET = { fen: { IV: 2.5, IN: 8, IM: 8, OTFC: 10 }, mor: { IV: 7, IM: 20 }, ket: { IV: 0.7, IM: 4, IN: 8 }, nal: { IV: 1, IM: 4, IN: 4 }, mid: { IV: 2, IM: 8, IN: 6 }, adr: { IV: 0.3, IM: 3 } };
  const onsetOf = (id, r) => { const O = ONSET[id]; if (!O) return 0; r = r === 'IO' ? 'IV' : r; return O[r] != null ? O[r] : O.IV != null ? O.IV : 0; };
  const ramp = (id, r, min) => { const h = onsetOf(id, r); if (!(h > 0)) return 1; if (min <= 0) return 0; const q = Math.pow(min / h, 3); return q / (1 + q); };
  const SUB = { Ketamine: 'ket', Fentanyl: 'fen', Morphine: 'mor', Naloxone: 'nal', Midazolam: 'mid', Epinephrine: 'adr' };
  const O2B = { NasalCannula: f => Math.min(4, 0.75 * f), SimpleMask: f => Math.min(7, 3 + 0.35 * f), NonRebreatherMask: f => Math.min(8.5, 4 + 0.3 * f) };
  const BLOODY = { Blood: 0.9, PackedRBC: 0.9, Plasma: 0.8 };
  // kristaloidai: mažėjanti nauda – pirmas litras ~0,3, antras ~0,15, toliau ~0,05 (likusi dalis išeina iš kraujagyslių); nudegimų plazmos netekimą keičia ~1:1
  const CRED = c => 0.3 * Math.min(c, 1000) + 0.15 * clamp(c - 1000, 0, 1000) + 0.05 * Math.max(0, c - 2000);
  // preoksigenacijos efektyvumas pagal deguonies padidinimą (o2b): kaniulės 4 ≈ 0,1, kaukė 6 ≈ 0,4, kaukė 10 ≈ 0,6, kaukė su rezervuaru 15 – 1,0
  const PREOX = b => b > 2 ? Math.pow(clamp((b - 2) / 6.5, 0, 1), 1.3) : 0;
  const SUPPORTED = ['hem', 'hem_stop', 'inf', 'inf_stop', 'o2', 'o2_off', 'tpx', 'ndc', 'occl', 'burp', 'aw', 'intub', 'cric', 'sga', 'bolus', 'drug', 'tx', 'tbi', 'eff', 'burn', 'arrest', 'vf', 'rosc', 'pcd', 'htx', 'tube', 'bronch', 'asthma', 'stress', 'pain', 'temp'];

  function fresh(kg, t0, sex, age) {
    return { t: 0, kg, sex: sex === 'F' ? 'F' : 'M', age: age || 25, bv0: (sex === 'F' ? 65 : 70) * kg, lost: 0, inB: 0, inP: 0, inC: 0, hem: {}, inf: {}, ptx: {}, htx: {}, aw: 0, secured: false, vent: false, para: 0,
      tbi: 0, tbiBase: 0, effR: 0, effR0: 0, effRe: 0, effV: 0, burn: 0, burnT0: 0, plos: 0, bronch: 0, pain: 0, o2: null, T: t0 || 36.6, amb: null, hpmk: false, warm: false, drugs: [], ind: null,
      arrest: null, pT: 0, sT: 0, s60T: 0, rT: 0, alive: true, spo2: 97, map: 93, apn: 0, o2T: 0 };
  }

  // ── veiksmai ──
  function apply(E, a) {
    if (a && a.L && typeof a.L === 'object') a = a.L;   // telefono modelio variantas (Pulse gauna a be L)
    const k = a.k, side = a.side === 'R' ? 'R' : 'L';
    switch (k) {
      case 'hem': {
        const sev = clamp(+a.sev || 0, 0, 1);
        if (sev <= 0 && !(+a.rate > 0)) delete E.hem[a.cmp]; else E.hem[a.cmp || 'RightLeg'] = { sev, rate: +a.rate > 0 ? +a.rate : null };
        return [true, ''];
      }
      case 'hem_stop': delete E.hem[a.cmp]; return [true, ''];
      case 'inf': E.inf[a.cmp || 'Saline'] = [clamp(+a.ml || 500, 0, 5000), clamp(+a.rate || 50, 1, 1000)]; return [true, ''];
      case 'inf_stop': delete E.inf[a.cmp]; return [true, ''];
      case 'o2': E.o2 = { dev: a.dev || 'NasalCannula', flow: +a.flow || 2 }; return [true, ''];
      case 'o2_off': E.o2 = null; return [true, ''];
      case 'tpx': {
        const sev = clamp(+a.sev || 0, 0, 1), P = E.ptx[side] || { idx: 0, rate: 0, open: false, drained: false };
        if (sev <= 0) { delete E.ptx[side]; return [true, '']; }
        P.open = !!a.open; P.drained = false; P.sev = sev; P.vent = false; P.unv = false;
        P.idx = Math.max(P.idx, a.idx != null ? clamp(+a.idx, 0, 1) : sev * 0.4);
        P.rate = a.rate != null ? +a.rate : sev / 12;   // indekso augimas per min. (vidutinis ~20 min iki pilnos įtampos)
        E.ptx[side] = P; return [true, ''];
      }
      case 'ndc': {   // adatinė dekompresija; fthor – pirštinė torakostomija (išlieka atvira)
        const P = E.ptx[side]; if (!P) return [true, 'pneumotorakso nėra – modelis nesikeičia'];
        if (a.fthor) { P.idx = 0; P.rate = 0; P.open = true; P.thor = true; }   // atvira krūtinė iki dreno
        else { P.idx = Math.min(P.idx, 0.1); P.rate = (P.sev || 0.45) / 40; P.ndc = (P.ndc || 0) + 1; }
        return [true, ''];
      }
      // krūtinės lipdukas: numatytasis – ventiliuojamas (oras išeina, įtampa nesivysto, PTX mažėja); be vožtuvo (unv) – oras kaupiasi, gali išsivystyti įtampa
      case 'occl': { const P = E.ptx[side]; if (P && (P.open || a.unv) && !P.drained) { P.open = false; P.unv = !!a.unv; P.vent = !a.unv; P.rate = a.unv ? (P.sev || 0.45) / 20 : 0; } return [true, '']; }
      case 'burp': { const P = E.ptx[side]; if (P && !P.drained) P.idx = Math.min(P.idx, 0.15); return [true, '']; }   // „atpūsti“ lipduką – įtampa atslūgsta (be vožtuvo vėl kaupsis)
      case 'tube': {
        const P = E.ptx[side]; if (P) { P.idx = 0; P.rate = 0; P.drained = true; P.open = false; }
        const H = E.htx[side]; if (H) { H.out = (H.out || 0) + H.vol; H.vol = 0; H.drained = true; }
        else E.htx[side] = { vol: 0, rate: 0, out: 0, drained: true };
        return [true, ''];
      }
      case 'htx': {
        const H = E.htx[side] || { vol: 0, rate: 0, out: 0, drained: false };
        H.rate = +a.rate > 0 ? +a.rate : lerp(clamp(+a.sev || 0, 0, 1), HTXR); E.htx[side] = H; return [true, ''];
      }
      case 'aw': E.aw = clamp(+a.sev || 0, 0, 1); if (E.aw > 0) E.secured = false; return [true, ''];
      case 'intub': case 'cric': case 'sga': E.aw = 0; E.secured = true; E.vent = true; return [true, ''];
      case 'tbi': E.tbi = E.tbiBase = clamp(+a.sev || 0, 0, 1); return [true, ''];
      case 'eff': E.effR = E.effR0 = Math.max(0, +a.rate || 0); E.effRe = 0; return [true, ''];   // rate 0 – chirurgiškai sustabdyta
      // perikardiocentezė – laikinai: skystis vėl kaupiasi po ~20 min (60 % pradinio greičio), kol nesustabdoma chirurgiškai
      case 'pcd': E.effV = Math.max(0, E.effV - Math.abs(+a.drain || 150)); if (E.effR > 0 || E.effRe) { E.effR0 = E.effR0 || E.effR; E.effR = 0; E.effRe = E.t + 1200; } return [true, ''];
      case 'burn': { const b = clamp(+a.tbsa || 0, 0, 1); if (b > 0 && !E.burn) E.burnT0 = E.t; E.burn = b; return [true, '']; }
      case 'bronch': case 'asthma': E.bronch = clamp(+a.sev || 0, 0, 1); return [true, ''];
      case 'pain': case 'stress': E.pain = clamp(+a.sev || 0, 0, 1); return [true, ''];
      case 'temp': if (a.v != null) E.T = clamp(+a.v || 36.6, 28, 40); if (a.amb !== undefined) E.amb = a.amb == null || !isFinite(a.amb) ? null : +a.amb; return [true, ''];
      case 'bolus': { const id = SUB[a.sub]; if (!id) return [false, 'nežinomas vaistas']; E.drugs.push([id, E.t, +a.mg || 0, a.route || '']); return [true, '']; }
      case 'drug': {
        const id = a.id, mg = +a.mg || 0;
        if (DRUG[id]) E.drugs.push([id, E.t, mg, a.route || '']);
        if (id === 'esket') E.drugs.push(['ket', E.t, mg * 2, a.route || 'IN']);
        // sedacijos / indukcijos dozė (≥ 0,5 mg/kg IV / IO) – šoke gali sumažinti AKS; analgezijos dozės (25 mg IV, 100 mg IM, 50 mg IN, esketaminas) – ne
        if (id === 'ket' && (a.route === 'IV' || a.route === 'IO' || !a.route) && mg / E.kg >= 0.5) E.ind = { t: E.t, k: Math.min(2, mg / E.kg) };
        if (id === 'roc') { E.para0 = E.t + 60; E.para = E.t + 45 * 60; }   // paralyžius po ~60 s, trunka ~45 min (be ventiliacijos – apnėja)
        if (id === 'hts' || id === 'man') E.tbi = Math.max(0, E.tbi - 0.25);
        return [true, ''];
      }
      case 'tx': {   // procedūros, kurias Pulse tik žymi žurnale – taisyklių modelis į jas atsižvelgia
        const c = a.id;
        if (c === 'hpmk') E.hpmk = true;
        if (c === 'warm') { E.warm = true; E.hpmk = true; }
        if (c === 'bvm' || c === 'vent') E.vent = true;
        if (c === 'ett_g') { E.secured = true; E.vent = true; E.aw = 0; }
        return [true, ''];
      }
      case 'arrest': {
        const r = a.rhythm || '';
        if (r === 'NormalSinus') { E.arrest = null; E.pT = 0; E.sT = 0; return [true, '']; }
        E.arrest = { t0: E.t, forced: /Fibrillation/.test(r) ? 'vf' : 'asys' };
        return [true, ''];
      }
    }
    return [false, 'nežinomas veiksmas'];
  }

  // ── vienas žingsnis (dt s) ──
  // vaisto poveikis „vienetais“: dozė × veikimo pradžios kreivė (pagal būdą) × mažėjimas
  const dEff = (E, id) => { const D = DRUG[id]; if (!D) return 0; let s = 0; E.drugs.forEach(x => { if (x[0] === id && E.t >= x[1]) { const mn = (E.t - x[1]) / 60; s += (x[2] / D[1]) * ramp(id, x[3], mn) * Math.exp(-mn / D[0]); } }); return s; };
  // kraujotakos tūrio deficitas: kraujo netekimas (atėmus kraują, plazmą ir mažėjančią kristaloidų naudą) + nudegimų plazmos netekimas (kristaloidai ~1:1)
  function deficit(E) {
    const pl = E.plos || 0, cB = Math.max(0, E.inC - pl);
    return (Math.max(0, E.lost - 0.9 * E.inB - 0.8 * E.inP - CRED(cB)) + Math.max(0, pl - E.inC)) / E.bv0;
  }
  function step(E, dt) {
    if (!E.alive) return;
    E.t += dt; const m = dt / 60;
    // praskiedimo koagulopatija: > 2 l kristaloidų (be nudegimų dalies) – kraujavimas ×1,1–1,3
    const cB = Math.max(0, E.inC - (E.plos || 0)), fac = clamp(E.map / 90, 0.4, 1.1), coag = (E.T < 35 ? 1.2 : 1) * (1 + 0.3 * clamp((cB - 2000) / 2000, 0, 1));
    let loss = 0;
    Object.keys(E.hem).forEach(c => { const h = E.hem[c]; loss += (h.rate != null ? h.rate : (HEM_MAX[c] || 100) * lerp(h.sev, SEVF)) * fac * coag; });
    Object.keys(E.htx).forEach(s => { const H = E.htx[s], r = H.rate * fac * coag * m; if (H.drained) H.out += r; else H.vol += r; loss += H.rate * fac * coag; });
    E.lost += loss * m;
    // nudegimai: plazmos išėjimas iš kraujagyslių ~2 ml/kg/% per 24 val., daugiausia pirmomis valandomis (eksponentiškai, τ 12 val.)
    if (E.burn > 0) E.plos = (E.plos || 0) + E.burn * 100 * E.kg * 2 / (0.8647 * 720) * Math.exp(-(E.t - (E.burnT0 || 0)) / 43200) * m;
    Object.keys(E.inf).forEach(c => { const v = E.inf[c], d = Math.min(v[0], v[1] * m); v[0] -= d;
      if (BLOODY[c]) { if (c === 'Plasma') E.inP += d; else E.inB += d; } else E.inC += d;
      if (!E.warm) E.T -= d * 0.0002;
      if (v[0] <= 0.1) delete E.inf[c]; });
    if (E.effRe && E.t >= E.effRe) { E.effR = (E.effR0 || 40) * 0.6; E.effRe = 0; }   // tamponada vėl kaupiasi po perikardiocentezės
    E.effV += E.effR * m;
    Object.keys(E.ptx).forEach(s => { const P = E.ptx[s]; if (!P.open && !P.drained && P.rate > 0) P.idx = Math.min(1, P.idx + P.rate * m); if (P.open) P.idx = Math.min(P.idx, 0.4); if (P.vent && !P.drained) P.idx = Math.max(0.08, P.idx - 0.03 * m); });
    // temperatūra: aktyvus šildymas – iki ~37 °C (be perkaitimo); vėsimas – pagal aplinką (jei nurodyta), kitaip ≤ 1 °C/val.; HPMK – ~4 kartus lėčiau
    if (E.warm) { if (E.T < 37) E.T = Math.min(37, E.T + 1.5 / 60 * m); }
    else {
      let cool = E.amb != null ? clamp(0.05 * (E.T - E.amb), 0, 3) * (1 + E.burn) : Math.min(1, (0.5 + 0.5 * Math.min(1, deficit(E) / 0.3)) * (1 + E.burn));
      // HPMK: nuostoliai ~4 kartus mažesni ir kūno šiluma juos kompensuoja – temperatūra artėja prie pusiausvyros (~36,2 °C;
      // giliame šoke žemesnės – šilumos gamyba mažėja), žemiau jos lėtai atšyla (Ready-Heat). Kitaip ilgas scenarijus nukrenta iki < 32 °C.
      if (E.hpmk) { const teq = 36.2 - 2.5 * Math.min(1, deficit(E) / 0.4); cool = E.T > teq ? cool * 0.25 * Math.min(1, (E.T - teq) / 0.6) : -0.3 * Math.min(1, (teq - E.T) / 0.6); }
      E.T -= cool / 60 * m;
    }
    E.T = clamp(E.T, 28, 40);
    // GST: hipoksija ir hipotenzija blogina
    if (E.tbiBase > 0 && (E.spo2 < 90 || E.map < 65)) E.tbi = Math.min(1, E.tbi + 0.01 * m);
    const V = vitals(E, true);
    E.map = V.map;
    // deguonies atsargos (preoksigenacija): kaupiasi kvėpuojant su O₂ (pilnai – per ~3 min su kauke su rezervuaru), oru išsivalo per ~1,5 min
    // atsargos artėja prie prietaiso ribos (kaukė su rezervuaru 15 l/min – 300; paprasta kaukė 6 l/min – ~115), τ 60 s; oru išsivalo per ~1,5 min
    if (V._apnea) { /* apnėjos metu atsargos nekinta */ }
    else if (V._o2b > 0 && V.rr > 0) { const tgt = 300 * PREOX(V._o2b), o = E.o2T || 0; E.o2T = o < tgt ? o + (tgt - o) * Math.min(1, dt / 60) : Math.max(tgt, o - 2 * dt); }
    else E.o2T = Math.max(0, (E.o2T || 0) - 2 * dt);
    if (V._apnea) {
      // apnėja: plokščia dalis (oru ≈ 60 s; po O₂ – iki 3–5 min pagal preoksigenaciją; šoke / kraujuojant – trumpiau), tada sigmoidinis kritimas
      if (!E.apT) { E.apT = dt; E.ap0 = E.spo2; const sh = clamp(1 - 1.2 * deficit(E), 0.4, 1); E.apTp = (60 + 240 * Math.min(1, (E.o2T || 0) / 300)) * sh * clamp((E.spo2 - 80) / 16, 0.15, 1); E.apK = 90 * clamp(1 - deficit(E), 0.6, 1); }
      else E.apT += dt;
      const u = Math.max(0, E.apT - E.apTp);
      E.spo2 = 40 + (E.ap0 - 40) * Math.exp(-Math.pow(u / E.apK, 2));
    } else {
      E.apT = 0;
      // SpO₂ artėja prie tikslo: kyla greitai (τ 20 s), krenta lėčiau (deguonies atsargos; dalinė obstrukcija – dar lėčiau)
      const tau = V._spo2t >= E.spo2 ? 20 : V._aw > 0 ? 60 + 120 * V._aw : 30;
      E.spo2 += (V._spo2t - E.spo2) * Math.min(1, dt / tau);
    }
    // sustojimas
    const p = V._p;
    E.pT = p >= 0.99 ? E.pT + dt : 0;
    E.sT = E.spo2 < 50 ? E.sT + dt : 0;
    E.s60T = E.spo2 < 60 ? (E.s60T || 0) + dt : 0;   // hipoksinis sustojimas: SpO₂ < 60 % > 2,5 min (apnėja / visiška obstrukcija) arba > 4 min (dalinė)
    const d = deficit(E);
    const cause = d > 0.52 || E.pT > 180 || E.sT > 120 || E.s60T > (V._apnea ? 150 : 240) || E.effV > 350 || (V.sys < 35 && !E.arrest);
    if (!E.arrest && cause) E.arrest = { t0: E.t, forced: '', hr0: V.hr };
    if (E.arrest && !E.arrest.forced) {
      const ok = d < 0.45 && p < 0.3 && V._spo2ok > 80 && E.effV < 200 && (E.vent || E.secured);   // HOTT: kraujavimas, tūris, dekompresija, ventiliacija
      E.rT = ok ? E.rT + dt : 0;
      if (E.rT > 60) { E.arrest = null; E.rT = 0; E.pT = 0; E.sT = 0; }          // priežastys pašalintos (HOTT) – ROSC
      else if (E.t - E.arrest.t0 > 1200) E.alive = false;                     // > 20 min be ROSC – negrįžtama (CGO: sprendimas ~20 min)
    }
  }
  function vitals(E, internal) {
    const d = deficit(E);
    let [hr, sys, dia, rr] = atls(d);
    const ag = Math.max(0, (E.age || 25) - 40); sys += ag * 0.4; dia += ag * 0.2; hr -= ag * 0.15;   // vyresnis – aukštesnis AKS, mažesnė tachikardija
    const sides = Object.values(E.ptx).map(P => P.drained ? 0 : P.idx).sort((a, b) => b - a), p = Math.min(1.2, (sides[0] || 0) + 0.5 * (sides[1] || 0));
    hr += 25 * Math.min(1, p); rr += 12 * Math.min(1, p);
    if (p > 0.6) { const f = Math.min(1, (p - 0.6) / 0.4); sys -= 40 * f; dia -= 25 * f; }
    if (E.effV > 100) { const f = Math.min(1, (E.effV - 100) / 200); hr += 35 * f; sys -= 50 * f; dia -= 15 * f; }
    const htxV = Object.values(E.htx).reduce((s, H) => s + (H.drained ? 0 : H.vol), 0);
    if (htxV > 1000) sys -= Math.min(20, 10 * (htxV - 1000) / 1000);
    // naloksonas – konkurencinis antagonistas: 40 mcg ≈ pusė opioido poveikio, 0,4 mg ≈ 90 % (veikia trumpiau nei opioidas)
    const ket = dEff(E, 'ket'), nal = dEff(E, 'nal'), opi = (dEff(E, 'fen') + dEff(E, 'mor')) * (1 - nal / (nal + 0.1)), mid = dEff(E, 'mid'), epi = dEff(E, 'adr');
    // kvėpavimo slopinimas: standartinė dozė (fentanilis 50–100 mcg, morfinas 5–10 mg) sveikam 80 kg – KD −2…−4;
    // ryškus – didelės / kartotinės dozės arba sinergija (midazolamas, GST, hipovolemija), skaičiuojama mcg/kg
    const xo = opi * (80 / E.kg) * (1 + 0.15 * mid) * (1 + 0.8 * E.tbi) * (1 + 3 * Math.min(0.4, d)), rdep = 14 * xo / (xo + 6.6);
    const anal = Math.min(1, ket + 0.8 * opi);
    hr += 12 * E.pain * (1 - anal); sys += 10 * E.pain * (1 - anal); rr += 4 * E.pain * (1 - anal);
    rr += 12 * E.bronch;
    // ketaminas: simpatinis poveikis (ŠSD, AKS ↑); indukcijos dozė (≥ 0,5 mg/kg IV / IO) šoke – hipotenzija: veikimo pradžia ~1 min, sklandžiai praeina per ~10–15 min (be šuolio)
    const shF = clamp((d - 0.15) / 0.15, 0, 1), ind = E.ind && typeof E.ind === 'object' ? E.ind : null;
    if (ind) { const mn = (E.t - ind.t) / 60, f = ramp('ket', 'IV', mn) * Math.exp(-mn / 5) * ind.k * shF; sys -= 32 * f; dia -= 18 * f; }
    hr += 8 * Math.min(1.5, ket); sys += 8 * Math.min(1.5, ket);
    hr += 35 * epi; sys += 35 * epi;
    // opioidų / midazolamo hipotenzija – mažėja ir diastolinis (proporcingai), pulsinis spaudimas nesiaurėja
    { const ds = (5 + 10 * d) * opi + 6 * mid, pr = sys > 0 ? clamp(dia / sys, 0.4, 0.8) : 0.65; rr -= rdep + 0.8 * mid; sys -= ds; dia -= ds * pr; }
    const aw = E.secured ? 0 : E.aw, awFull = aw >= 0.9;
    if (aw > 0) { rr += 10 * aw; hr += 20 * aw; }
    if (E.T < 32) hr -= (32 - E.T) * 10;   // gili hipotermija – bradikardija
    if (E.tbi > 0.6 && sys > 90) { const f = (E.tbi - 0.6) / 0.4; hr -= 40 * f; sys += 45 * f; rr = Math.max(6, rr - 8 * f); }
    const para = E.para && E.t >= (E.para0 || 0) && E.t < E.para;
    let apnea = false;
    if (para || rr < 4) { if (E.vent || E.secured) rr = 14; else { rr = 0; apnea = true; } }
    // visiška obstrukcija (≥ 0,9): pastangos matomos (impedansinis KD), bet oro srauto nėra – deguonies prisotinimas kaip apnėjos metu (O₂ kaukė nepadeda)
    if (awFull && !apnea) { apnea = true; rr = rr * clamp((E.spo2 - 30) / 40, 0.15, 1); }
    rr = Math.max(0, rr);
    // SpO₂ tikslas
    let o2b = E.o2 && O2B[E.o2.dev] ? O2B[E.o2.dev](E.o2.flow) : 0;
    if (E.vent && E.secured) o2b = Math.max(o2b, 4);
    let st = 98 - 20 * Math.min(1, p) - Math.min(20, htxV / 100) - 50 * aw - 25 * E.bronch - (d > 0.4 ? 3 + 10 * (d - 0.4) : 0) - (rr > 0 && rr < 8 ? (8 - rr) * 4 : 0) + o2b * (1 - 0.4 * Math.min(1, p)) * (1 - 0.5 * aw);
    if (apnea) st = 40;
    st = clamp(st, 30, 100);
    const st0 = st;
    if (E.spo2 < 70 && !E.arrest) hr -= Math.min(50, (70 - E.spo2) * 2);   // hipoksinė bradikardija
    let out;
    if (!E.alive) out = { hr: 0, sys: 0, dia: 0, map: 0, spo2: null, rr: 0 };
    else if (E.arrest) {
      const at = E.t - E.arrest.t0;
      if (E.arrest.forced === 'vf' || E.arrest.forced === 'asys' || at > 600) out = { hr: 0, sys: 0, dia: 0, map: 0, spo2: Math.round(E.spo2), rr: 0 };
      else out = { hr: Math.round(Math.max(30, Math.min(110, E.arrest.hr0 || 90) - at / 10)), sys: 12, dia: 8, map: 9, spo2: Math.round(E.spo2), rr: 0 };   // BEA (dažnis – nuo buvusio prieš sustojimą)
      st = 35;
    } else {
      sys = Math.max(0, sys); dia = clamp(dia, 0, sys - 8);
      out = { hr: Math.round(clamp(hr, 0, 220)), sys: Math.round(sys), dia: Math.round(Math.max(0, dia)), map: Math.round(dia + (sys - dia) / 3), spo2: Math.round(clamp(E.spo2, 30, 100)), rr: Math.round(rr) };
    }
    out.temp = Math.round(E.T * 10) / 10;
    out.bv = Math.round(E.bv0 * (1 - d)); out.bv0 = Math.round(E.bv0);
    out.lost = Math.round(E.lost);
    out.htx = {}; Object.keys(E.htx).forEach(s => { out.htx[s] = { vol: Math.round(E.htx[s].vol), out: Math.round(E.htx[s].out), drained: !!E.htx[s].drained }; });
    out.ptx = {}; Object.keys(E.ptx).forEach(s => { out.ptx[s] = Math.round(E.ptx[s].idx * 100) / 100; });
    out.co = Math.round(Math.max(0.5, 5.2 * (1 - d * 1.4) - Math.min(1, p) * 1.5) * 10) / 10;
    out.plos = Math.round(E.plos || 0);
    if (internal) { out._spo2t = st; out._spo2ok = st0; out._p = p; out._apnea = apnea; out._o2b = o2b; out._aw = aw; }
    return out;
  }
  const advance = (E, s) => { const n = Math.max(1, Math.round(s)); for (let i = 0; i < n && E.alive; i++) step(E, s / n); return E.alive; };

  // ── sesija (imituoja serverį) ──
  let S = null, sock = null, loopT = null, lastWall = 0, lastSend = 0, saveT = 0;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = () => { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const info = () => ({ t: 'info', engine: ENGINE, version: VERSION, pulse: false, local: true, sessions: S ? 1 : 0, max: 1, states: ['Soldier@0s.json', 'StandardMale@0s.json', 'StandardFemale@0s.json', 'Underweight@0s.json', 'Overweight@0s.json'],
    compounds: ['Blood', 'PackedRBC', 'Plasma', 'Saline', 'LactatedRingers'], substances: Object.keys(SUB), supported: SUPPORTED.reduce((o, k) => (o[k] = true, o), {}), hem_cmp: Object.keys(HEM_MAX) });
  function emit(m) { const s = sock; if (!s) return; setTimeout(() => { if (s.readyState === 1 && s.onmessage) s.onmessage({ data: JSON.stringify(m) }); }, 0); }
  const vit = extra => { const v = S.frozen && S.v0 ? S.v0 : vitals(S.E); S.v = v; emit(Object.assign({ t: 'vit', simt: Math.round(S.E.t * 10) / 10, v, alive: S.E.alive, speed: S.speed }, extra || {})); };
  function tick() {
    if (!S || S.stopped) return;
    const now = Date.now(), dw = Math.min(5, (now - lastWall) / 1000); lastWall = now;
    if (!S.paused && S.frozen) { S.E.t += dw * S.speed; if (now - lastSend >= 950) { lastSend = now; vit(); } }
    else if (!S.paused && S.E.alive) {
      const wasAlive = S.E.alive;
      advance(S.E, dw * S.speed);
      if (now - lastSend >= 950) { lastSend = now; vit(); }
      if (wasAlive && !S.E.alive) { vit(); emit({ t: 'dead', simt: Math.round(S.E.t) }); }
    }
    if (now - saveT > 2000) { saveT = now; save(); }
  }
  function startLoop() { stopLoop(); lastWall = Date.now(); loopT = setInterval(tick, 250); }
  function stopLoop() { if (loopT) clearInterval(loopT); loopT = null; }
  function onMsg(m) {
    switch (m.t) {
      case 'hello': emit(info()); break;
      case 'start': {
        const kg = clamp(+m.kg || 80, 30, 200);
        S = { sid: 'L' + Date.now().toString(36), E: fresh(kg, +m.temp0 || 36.6, m.sex, +m.age), speed: clamp(+m.speed || 1, 0.25, 20), paused: false, stopped: false, frozen: !!m.frozen };
        if (m.amb != null && isFinite(m.amb)) S.E.amb = +m.amb;   // aplinkos temperatūra (jei scenarijuje nurodyta)
        (m.acts || []).forEach(a => { const r = apply(S.E, a); if (!r[0]) emit({ t: 'ack', id: a.id || 'init', ok: false, msg: r[1], simt: 0 }); });
        const ff = clamp(+m.ff || 0, 0, 7200);
        if (ff >= 1) advance(S.E, ff);
        // tęsinys po Pulse ryšio nutrūkimo: veiksmai pakartojami jų laiku, tada prasukama iki dabar
        if (Array.isArray(m.replay)) {
          m.replay.forEach(r => { const d = (+r.t || 0) - S.E.t; if (d > 0.05) advance(S.E, d); if (S.E.alive && r && r.a) apply(S.E, r.a); });
          const d = clamp(+m.to || 0, 0, 86400) - S.E.t; if (d > 0.05) advance(S.E, d);
          S.paused = !!m.paused;
        }
        if (S.frozen) S.v0 = vitals(S.E);   // rankinis režimas: pradiniai rodikliai iš modelio, toliau keičia instruktorius
        save(); emit(Object.assign({ t: 'started', sid: S.sid, state: m.state || '', simt: Math.round(S.E.t), engine: ENGINE }, m.cont ? { resumed: true, cont: 1, paused: S.paused, speed: S.speed } : {}));
        vit(); startLoop();
        if (!S.E.alive) emit({ t: 'dead', simt: Math.round(S.E.t) });
        break;
      }
      case 'resume': {
        const L0 = S && S.sid === m.sid ? S : load();
        if (L0 && L0.sid === m.sid && !L0.stopped) { S = L0; emit({ t: 'started', sid: S.sid, simt: Math.round(S.E.t), resumed: true, engine: ENGINE, paused: S.paused, speed: S.speed }); vit(); startLoop(); if (!S.E.alive) emit({ t: 'dead', simt: Math.round(S.E.t) }); }
        else emit({ t: 'gone', sid: m.sid });
        break;
      }
      case 'act': {
        if (!S) { emit({ t: 'err', msg: 'Sesija nepradėta' }); break; }
        const r = S.E.alive ? apply(S.E, m.a || {}) : [false, 'pacientas miręs – pradėkite iš naujo'];
        emit({ t: 'ack', id: m.id, ok: r[0], msg: r[1], simt: Math.round(S.E.t * 10) / 10 });
        break;
      }
      case 'speed': if (S) S.speed = clamp(+m.x || 1, 0.25, 20); break;
      case 'freeze': if (S) { S.frozen = true; S.v0 = vitals(S.E); save(); vit(); } break;   // rankinis režimas: nuo šiol rodikliai nebekinta (keičia instruktorius)
      case 'skip': if (S && S.frozen) { S.E.t += clamp(+m.s || 300, 1, 7200); vit(); save(); }
      else if (S && S.E.alive) { const was = S.E.alive; advance(S.E, clamp(+m.s || 300, 1, 7200)); vit(); if (was && !S.E.alive) emit({ t: 'dead', simt: Math.round(S.E.t) }); save(); } break;
      case 'pause': if (S) S.paused = true; break;
      case 'run': if (S) { S.paused = false; lastWall = Date.now(); } break;
      case 'stop': if (S) { S.stopped = true; save(); } stopLoop(); emit({ t: 'stopped' }); break;
    }
  }
  // WebSocket imitacija
  function socket() {
    const s = { readyState: 0, onopen: null, onmessage: null, onclose: null,
      send(str) { let m; try { m = JSON.parse(str); } catch (e) { return; } onMsg(m); },
      close() { if (s.readyState === 3) return; s.readyState = 3; if (sock === s) sock = null; stopLoop(); if (S && !S.stopped) save(); setTimeout(() => s.onclose && s.onclose({ code: 1000 }), 0); } };
    if (sock && sock !== s) { try { sock.readyState = 3; } catch (e) {} }
    sock = s;
    setTimeout(() => { s.readyState = 1; s.onopen && s.onopen(); }, 0);
    return s;
  }
  // testams: tiesioginis variklis
  // ar vaistas keičia telefono modelio rodiklius (kiti – tik žurnale)
  const fx = id => !!DRUG[id] || id === 'esket';
  return { socket, ENGINE, VERSION, fx, _fresh: fresh, _apply: apply, _advance: advance, _vitals: vitals, _deficit: deficit };
})();
if (typeof module !== 'undefined') module.exports = PLOCAL;
