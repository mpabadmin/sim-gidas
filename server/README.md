# SIM Pulse serveris

Serveris skaičiuoja paciento fiziologiją [Kitware Pulse Physiology Engine](https://pulse.kitware.com) varikliu
(atviro kodo, Apache 2.0) ir siunčia rodiklius SIM monitoriui. SIM programėlė be serverio veikia kaip anksčiau;
serveris reikalingas tik skilčiai **Pulse**.

```
Instruktoriaus telefonas ──(MQTT ryšys, kaip iki šiol)──► Monitoriaus telefonas ──(WebSocket wss://…/ws)──► Pulse serveris (Azure)
     veiksmas „Pilnas kraujas“                         siunčia veiksmą serveriui                    skaičiuoja kas 2 s
                                                         ◄────────── ŠSD, AKS, SpO₂, KD, T, kraujo tūris ──────────
```

## Diegimas į Azure (apie 20 min, vienkartinai)

1. Atidarykite https://portal.azure.com ir prisijunkite paskyra, kurioje yra ne pelno organizacijų kreditai.
2. Viršuje paspauskite Cloud Shell piktogramą `>_` ir pasirinkite **Bash**
   (pirmą kartą paprašys sukurti saugyklą – sutikite; jei siūlo „No storage account required“ – irgi tinka).
3. Įklijuokite ir paspauskite Enter:
   ```bash
   git clone https://github.com/mpabadmin/sim-gidas && bash sim-gidas/server/azure/diegti.sh
   ```
4. Skriptas pats sukuria išteklių grupę `sim-pulse-rg`, konteinerių registrą, sustato atvaizdą Azure debesyje
   (nieko siųstis į kompiuterį nereikia) ir paleidžia Azure Container Apps programą su HTTPS adresu.
5. Pabaigoje parodomas **adresas**, **žetonas** ir nuoroda `https://sim.1040medkuopa.lt/#/nustatymai?pulse=…&pt=…`.
   Atidarykite ją instruktoriaus ir monitoriaus telefonuose – nustatymai išsaugomi automatiškai.
   Pakanka ir instruktoriaus telefone: pradedant modeliavimą adresas perduodamas monitoriui.
6. Skripto pabaigoje yra **savitikra** – sąrašas, kurie veiksmai (kraujavimas, infuzijos, dekompresija, vaistai…)
   veikia su šia Pulse versija. Nukopijuokite šią išvestį ir atsiųskite – pagal ją bus pataisyti nepalaikomi veiksmai.

Atnaujinti (po programėlės pakeitimų): Cloud Shell `cd sim-gidas && git pull && bash server/azure/diegti.sh`
– adresas ir žetonas išlieka (`~/.sim-pulse.env`).

### Kaina
- Container Apps su `MIN=0`: kai niekas nesijungia, konteineris išsijungia; mokama tik už veikimo laiką
  (1 vCPU, 2 GiB – apie 0,10 €/val.; pirmos ~50 val./mėn. dažniausiai nemokamos).
- Konteinerių registras Basic – apie 5 €/mėn.
- Pirmas prisijungimas po pertraukos užtrunka 30–90 s (konteineris „pabunda“), toliau veikia iš karto.
- Norint, kad būtų paruoštas iš anksto: `MIN=1 bash sim-gidas/server/azure/diegti.sh` (tada mokama visą laiką, ~30–80 €/mėn.);
  po pratybų vėl paleisti su `MIN=0`.
- Viską pašalinti: `az group delete -n sim-pulse-rg --yes`.

### Jei atvaizdas nesusistato
Numatytasis `Dockerfile` remiasi oficialiu Kitware atvaizdu `kitware/pulse:4.3.1`. Jei jis nepasiekiamas ar jame
nėra Python sąsajos, sustatyti iš šaltinio (~1 val.): `DOCKERFILE=Dockerfile.source bash sim-gidas/server/azure/diegti.sh`.

## Kitur (ne Azure)
Bet kuriame Linux kompiuteryje ar virtualioje mašinoje su Docker:
```bash
cd server && docker build -t sim-pulse . && docker run -p 8080:8080 -e SIM_TOKEN=slaptas sim-pulse
```
Telefonams reikia HTTPS (`wss://`) – prieš serverį naudokite pvz. Caddy ar Cloudflare Tunnel.

Be Pulse (sąsajos patikrai, supaprastintas testinis modelis):
`FORCE_MOCK=1 SIM_TOKEN=t PORT=8080 python3 pulse_server.py` (tik Python 3, jokių priklausomybių).

## Aplinkos kintamieji
| Kintamasis | Reikšmė |
|---|---|
| `PORT` | prievadas (8080) |
| `SIM_TOKEN` | žetonas; be jo prisijungti negalima |
| `MAX_SESSIONS` | kiek monitorių vienu metu (3) |
| `KEEP_DETACHED_S` | kiek sekundžių laikyti sesiją atsijungus monitoriui (900) |
| `FORCE_MOCK` | `1` – testinis variklis vietoj Pulse |
| `PULSE_BIN` | Pulse `bin` katalogas, jei nerandamas automatiškai |

## Sąsaja
- `GET /health`, `GET /info` (variklis, būsenos, junginiai, medžiagos, palaikomi veiksmai, kraujavimo vietos `hem_cmp`), `GET /selftest?token=…`.
- WebSocket `/ws?token=…`, JSON žinutės:
  - monitorius → serveris: `hello`, `start {state, acts[], speed, ff}` (`ff` – „praėjo s nuo sužeidimo“, modelis prasukamas), `resume {sid}`, `act {id, a}`, `speed {x}`, `skip {s}` (praleisti s modelio laiko), `pause`, `run`, `stop`;
  - serveris → monitorius: `info`, `started {sid, state, simt, resumed, engine}`, `ff {done, tot}`, `vit {simt, v, alive, speed, eff, skip?}`, `ack {id, ok, msg, simt}`, `dead`, `gone`, `stopped`, `err`.
- Veiksmai (`a.k`): `hem`/`hem_stop` (cmp, sev), `inf`/`inf_stop` (cmp: Blood, PackedRBC, Saline; LactatedRingers → Saline; ml, rate ml/min),
  `o2`/`o2_off` (dev, flow), `tpx` (side, sev, open), `ndc`, `occl`, `tube` (krūtinės drenas), `htx` (hemotoraksas: side, sev), `aw` (sev),
  `intub`/`cric`/`sga` (≈ obstrukcijos pašalinimas), `bolus` (sub, mg, route IV/IM), `tbi` (≈ Cushingo reakcija pridedama), `eff` (rate ml/min; veikia nuo ~40),
  `pcd` (≈ perikardiocentezė: drain ml/min, dur s), `burn` (≈ kraujavimas per odą), `bronch`, `asthma`, `stress`, `pain` (≈ ūmus stresas), `arrest` (rhythm: Asystole, CoarseVentricularFibrillation, NormalSinus = ROSC).
- ≈ – Pulse 4.3.1 tokios funkcijos neturi; serveris pateikia apytikslį sprendimą ir `ack.msg` prasideda „apytiksliai:“.

Mokymo priemonė – ne medicinos prietaisas. Pulse modelis apytikslis; rezultatai nėra klinikinės rekomendacijos.
