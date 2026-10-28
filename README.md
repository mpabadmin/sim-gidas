# SIM – paciento monitoriaus simuliatorius (1040 medkuopa)

Neprisijungus veikianti programėlė (PWA) treniruotėms: https://sim.1040medkuopa.lt

- Rodikliai: EKG (II), ŠSD, SpO₂ su pletizmograma, neinvazinis AKS, KD su kreive, T (be EtCO₂).
- Instruktoriaus pultas monitoriuje arba kitame telefone (WebRTC, susiejimas QR kodais, be serverio).
- Scenarijai: `scen.js` (SIM) ir `scen-import.js` – sugeneruota iš ETC ir March gidų: `python3 tools/build_import.py`.
- Nauja versija: pakeisti `VERSION` faile `sw.js` ir `VER` faile `app.js`.

Mokymo priemonė – ne medicinos prietaisas.
