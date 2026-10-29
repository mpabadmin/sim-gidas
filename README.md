# SIM – paciento monitoriaus simuliatorius (1040 medkuopa)

Neprisijungus veikianti programėlė (PWA) treniruotėms: https://sim.1040medkuopa.lt

- Rodikliai: EKG (II), ŠSD, SpO₂ su pletizmograma, neinvazinis AKS, KD su kreive, T (be EtCO₂).
- Ritmai: sinusinis, PV, SVT, mazginis, AV blokada III°, hiperkalemija (platūs QRS), SkT, SkV, asistolija, BEA; defibriliacija ir sinchronizuota kardioversija, stimuliacija (pacing), judesio ir KPR artefaktai.
- Instruktoriaus pultas (monitoriaus stalčius arba kitas telefonas): skiltys Rodikliai · Scenarijus · Veiksmai · Žurnalas · Nustatymai · Ryšys.
  Greitos komandos (Blogėja, Gerėja, Šokas ↑, Hipoksija ↑, Stabilizuoti), mėgstami nustatymai, +/− laikymas, slankikliai, „Keisti iš karto“.
- Scenarijų eiga: ankstesnis / kitas etapas, automatinis keitimas (`auto`, `nx`), scenarijaus laikai (`d`), intervencijų mygtukai (`ev`, `shock: true` – prieš etapą iškrova).
- Žurnalas: sesijos laikmatis, pauzė, visi pakeitimai ir pažymėti veiksmai su laiku, tendencijų grafikas, ataskaitos kopijavimas.
- Nustatymai (`#/nustatymai`, saugomi telefone, keičiami ir nuotoliniu būdu): aliarmų ribos, garsumas, kreivės greitis, EKG amplitudė, rodomos kreivės / skaičiai, dideli skaičiai, kontrastingos spalvos, laikmatis, paciento žymė, ekranas neužgęsta.
- Ryšys: MQTT per WebSocket (vieši brokeriai, `relay.js`), atsarginis – WebRTC su QR kodais (`rtc.js`).
- Scenarijai: `scen.js` (SIM) ir `scen-import.js` – sugeneruota iš ETC ir March gidų: `python3 tools/build_import.py`.
- Pulse fiziologijos modelis (nebūtina): skiltis **Pulse** – rodikliai skaičiuojami Kitware Pulse varikliu serveryje, gydymo veiksmai (kraujas, dekompresija, vaistai) keičia rodiklius; rodoma įprasta procedūros trukmė ir likęs laikas. Serveris ir diegimas į Azure – [`server/README.md`](server/README.md).
- Nauja versija: pakeisti `VERSION` faile `sw.js` ir `VER` faile `app.js`.

## Žinutės (instruktorius → monitorius)
`apply` (v, d, r, l, s; nauja: sc, td, mk, ev, auto), `rh`, `probe`, `opt`, `nibp` (stat), `nmode`, `label`, `mute` (off), `reset`,
nauja: `cfg`, `mark`, `shock` (sync), `pace`, `art`, `pause`, `ses`, `play`, `test`, `ping`, `dump`, `pulse` (op: start, resume, act, istop, speed, pause, stop, probe).
Monitorius → instruktorius: `snap` (papildyta cfg, pl, art, pace, pause, mute, el, ln, lg, hrs, au – ar monitoriaus garsas įjungtas, pu – Pulse būsena), `pong`, `dump`.

Mokymo priemonė – ne medicinos prietaisas.
