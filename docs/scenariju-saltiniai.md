# SIM – scenarijų šaltiniai (parametrų kitimas laike)

Data: 2026-10-28. Monitoriaus parametrai: ŠSD, SpO₂, sAKS/dAKS, KD, T, ritmas (be EtCO₂).
Principas: skaičiai ir laiko eiga paimti iš šaltinių ir perfrazuoti. Teksto neperkopijuota. Kai šaltinis duoda tik kryptį (↑/↓), reikšmės parinktos fiziologiškai nuosekliai ir tai pažymėta. „⏱“ scenarijuose reiškia suspaustą laiką.

## 1. Šaltiniai

### Fiziologijos varikliai (atviras kodas)
| Šaltinis | Ką duoda | Laiko skalė | Licencija / naudojimas | URL |
|---|---|---|---|---|
| Pulse Physiology Engine (Kitware) – Hemorrhage | MAP/MTI pagal netekto kraujo %; Guyton šoko grupės (neprogresuojantis → negrįžtamas); „class 1–4“ scenarijai (šlaunies, žasto arterija, blužnis); 2 kl. pvz.: 250 ml/min × 4 min, paskui 500 ml kraujo | min | Apache-2.0: galima naudoti ir cituoti | https://pulse.kitware.com/md__hemorrhage.html |
| Pulse – Respiratory methodology | Kaip modeliuojami įtampos PTX, okliuzinis tvarstis, adatinė dekompresija; hemotoraksas: lentelė „sunkumas → srautas → laikas iki vidutinio/masyvaus“ (pvz., 0,9 = 0,2 l/val. → masyvus per 300 min; 1,0 → per 60 min); KD ribos (<10 / >20) | min–val. | Apache-2.0 | https://pulse.kitware.com/_respiratory_methodology.html |
| Pulse – TCCC iteration data | TCCC kombinacijos: kvėpavimo takų obstrukcija, kraujavimas, įtampos PTX + intervencijos (adata, krūtinės tvarstis, NaCl) | – | Apache-2.0. Tai API puslapis, skaičių jame nėra | https://pulse.kitware.com/group___t_c_c_c_iteration_data.html |
| Pulse – About / validacija | Validacijos metodika (gera <10 %, vidutinė <30 %); fiziologijos sistemų sąrašas | – | Apache-2.0 | https://pulse.kitware.com/_about_pulse.html |
| BioGears – Combat Multitrauma Validation (ARA) | 22 m. kario laiko eilutė: kairės pusės įtampos PTX + šlaunies kraujavimas 350 ml/min → spaudimas → adata → turniketas → 500 ml NaCl → morfinas. Kiekviename etape ŠSD, AKS, VAS, KD, SpO₂ (0–730 s) | s–min | Apache-2.0 (BioGears). PDF turi vidinių neatitikimų (BV, KD) – naudoti tik kaip orientyrą | https://ara.com/wp-content/plugins/ara-biogears-widget/documentation/CombatMultitraumaValidation.pdf |
| HumMod | Netikrinta (laiko neužteko) | – | – | – |

### Klinikiniai / tyrimų šaltiniai su kiekybine eiga
| Šaltinis | Ką duoda | Laikas | Licencija | URL |
|---|---|---|---|---|
| ATLS šoko klasės (8 leid., lentelė per Clinical Anesthesia) | I–IV kl.: kraujo netekimas ml/%, ŠSD <100 / >100 / >120 / ≥140, AKS, pulsinis spaudimas, KD 14–20 / 20–30 / 30–40 / >35, diurezė, sąmonė | – | Autorių teisės ACS. Perfrazuoti skaičiai | https://download.skyscape.com/download/ota/lonestar/B05376C5-D44B-4B4E-8D71-4AC734FA707C/clinanes.ed7/content/HTML/3/tn21.htm |
| ATLS 10 leid. (WikEM lentelė) | Ta pati lentelė, bet tik rodyklės (be skaičių) | – | WikEM; licencija puslapyje nenurodyta | https://wikem.org/wiki/Template:Hemorrhagic_shock_classes |
| Mutschler ir kt., Resuscitation 2013 (TraumaRegister DGU, n=36 504) | **Įspėjimas:** tik 9,3 % pacientų atitiko ATLS klasę pagal visus 3 kriterijus; tachikardija dažnai nepasireiškia | – | Santrauka | https://read.qxmd.com/read/22835498/a-critical-reappraisal-of-the-atls-classification-of-hypovolaemic-shock-does-it-really-reflect-clinical-reality |
| Schiller, Howard, Convertino. Exp Biol Med 2017 (LBNP hemoragijos modelis) | VAS 94→83 (LT, 924 s) / 86 (HT, 1445 s), vėliau staigus kritimas ~30 % ir presinkopė per 10 s; dekompensacija = staigi bradikardija; LT ~450 ml ekv., HT ~1200 ml | s–min | © SEBM; cituoti | https://www.ebm-journal.org/journals/experimental-biology-and-medicine/articles/10.1177/1535370217694099/full |
| Roberts, Leigh-Smith ir kt. Ann Surg 2015 (įtampos PTX sisteminė apžvalga) | Hipoksija: savarankiškai kvėpuojantys 50 %, ventiliuojami 91,8 %; kvėpavimo sustojimas 9,3 % savarankiškų; hipotenzijos šansas ventiliuojamiems ×12,6, sustojimo ×17,7; 70,4 % ventiliuojamųjų dekompensavo „per minutes“; 39,6 % ventiliuojamųjų be pulso | min | Santrauka (PubMed) | https://pubmed.ncbi.nlm.nih.gov/25563887/ |
| Leigh-Smith & Harris, EMJ 2005 „Tension pneumothorax – time for a re-think?“ | Apžvalga: savarankiškai kvėpuojant ir ventiliuojant – skirtinga eiga (pilno teksto per PMC gauti nepavyko – captcha) | – | BMJ | https://emj.bmj.com/content/22/1/8 |
| Kheirabadi ir kt. J Trauma 2013 (USAISR, kiaulės, vožtuvinis vs be vožtuvo tvarstis) | Atviras PTX: SpO₂↓, ŠSD/VAS beveik nesikeičia; tvarstis grąžina per 5 min; be vožtuvo įtampa po ~1,4 l oro: ŠSD 151→187, VAS 87→79, MTI 6,0→4,8, pleuros slėgis ~+10, PaO₂ 59; vožtuvinis – be pokyčių iki ~2 l | 5 min žingsniai | „Approved for public release“ (DTIC) | https://apps.dtic.mil/sti/tr/pdf/ADA614696.pdf |
| Benumof, Dagg, Benumof. Anesthesiology 1997 (per Weingart & Levitan, Ann Emerg Med 2012) | Laikas iki SpO₂ <90 % po preoksigenacijos: sveikas ~8 min, vidutiniškai sergantis ~5 min, nutukęs ~2,7 min; kambario oru ~45–60 s; žemiau 88–90 % – staigus kritimas; Farmery & Roe: iki 85 % sergančiam 23 s, sveikam 502 s | s–min | Straipsnis (PDF universiteto tinklaraštyje) | https://pemcincinnati.com/blog/wp-content/uploads/2016/10/Weingart-and-Levitan-Annals-2012-Preoxygenation-and-the-prevention-of-desaturation-during-emergency-airway-mgt.pdf |
| Pasquier ir kt. SJTREM 2019 (šveicarų hipotermijos stadijos) | Stadijos 1–4 (35–32 / <32–28 / <28–24 / <24 °C), stadijas atitiko tik 61 % pacientų, optimalios ribos 32,1 / 27,5 / 24,1 °C; sustojimo rizika <30 °C | – | **CC BY 4.0** | https://sjtrem.biomedcentral.com/track/pdf/10.1186/s13049-019-0636-0 |
| Pasquier ir kt. High Alt Med Biol 2021 „Vital signs in accidental hypothermia“ (n=216) | Kiekvienam −1 °C: ŠSD −2,54/min, sAKS −4,36 mm Hg, KD −0,50/min (regresija) | – | Santrauka (uždara prieiga) | https://serval.unil.ch/notice/serval:BIB_F162D7C6A778 |
| Musi ir kt. Resuscitation 2021, Revised Swiss System (per EMCrit PDF) | Stadijos pagal AVPU ir gyvybės požymius; drebulys ≈ >30 °C | – | EMCrit PDF | https://emcrit.org/wp-content/uploads/2023/08/Hypothermia-Staging.pdf |
| WMS hipotermijos gairės 2019 (AFP santrauka) | Stadijos, „afterdrop“, gelbėjimo kolapsas, <30 °C ne daugiau 1 (WMS) / 3 (ERC) defibriliacijų | – | AAFP | https://www.aafp.org/pubs/afp/issues/2020/1101/p571.html |
| JTS CPG: Crush Syndrome PCC (ukrainiečių TCCC vertimas) | EKG eiga: bradikardija, smailūs T, ilgas PR, platūs QRS, VES/VT; K⁺ >5,5; Ca gliukonatas 10 ml 10 % (veikia iš karto, 30–60 min), insulinas + gliukozė (~20 min, 4–6 val.); 2 l bolusas prieš išlaisvinimą, paskui 1 l/val. | min–val. | JTS = JAV valstybės kūrinys (viešas); vertimas tccc.org.ua | https://tccc.org.ua/en/guide/crush-syndrome-under-prolonged-field-care-pcc |
| TCCC modulis 11 – hemoraginio šoko skysčiai (Deployed Medicine, vertimas) | Tikslai: sąmonė, radialinis pulsas, sAKS 100; LTOWB prioritetas; Ca 1 g po 1 vnt.; TXA 2 g | – | CoTCCC/JTS (viešas) | https://tccc.org.ua/files/downloads/module-11-hemorrhagic-shock-fluid-resuscitation-in-tactical-field-care-tfc.pdf |
| JTS TBI CPG (per NextGen Combat Medic 2024 santrauką) | GSmT tikslai: sAKS >110, SpO₂ >90 %; išvaržos požymiai; 23,4 % NaCl 30 ml | – | Santrauka; originalai jts.health.mil | https://nextgencombatmedic.com/2024/12/11/treating-tbi-from-the-aid-bag |
| JTS Burn Resuscitation Flowsheet (2025) | „Dešimties taisyklė“ (%KPP × 10 ml/val., 40–80 kg), diurezė 30–50 ml/val., VAS >65, max 250 ml/kg per 24 val., stebėjimo lapas 1–70 val. | val. | JAV valstybės kūrinys (viešas) | https://jts.health.mil/assets/docs/forms/JTS_Burn_Resuscitation_Flowchart.pdf |
| JTS CPG sąrašas | Visos CPG (DCR, TBI, burns, hypothermia, PCC) | – | Viešas | https://jts.health.mil/index.cfm/PI_CPGs/cpgs |
| JK GM CGO „Traumatic Cardiac Arrest“ | HOTT/MARCH seka, abipusė torakostomija, ventiliacija 12–18/min, torakotomija tik jei sustojimas <15 min, beviltiškumo sprendimas ~20 min | min | © Crown (sąlygas tikrinti) | https://cgo.mod.uk/clinical-guidelines-for-operations/resuscitation-guidelines/traumatic-cardiac-arrest/ |
| FPHC RCSEd 2024 TCA pozicija | Ikihospitalinis TCA valdymas | – | PMC (atviras) | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11686978/ |
| RCUK 2021 anafilaksija | IM adrenalinas, kartoti po 5 min; refrakterinė = po 2 dozių; odos požymių nėra ~20 % | min | RCUK | https://www.resus.org.uk/print/pdf/node/11323 |
| Pumphrey, Clin Exp Allergy 2000 | Mediana iki sustojimo: jatrogeninė 5 min, vabzdžiai 15 min, maistas 30 min; jatrogeninėse vyrauja šokas | min | Santrauka | https://read.qxmd.com/read/10931122/lessons-for-management-of-anaphylaxis-from-a-study-of-fatal-reactions |
| StatPearls: Neurogenic Shock | sAKS <90, ŠSD <80, šilta oda, VAS 85–90 pirmas 7 d., atropinas, noradrenalinas | d–sav. | **CC BY-NC-ND 4.0** | https://www.ncbi.nlm.nih.gov/books/NBK459361/ |
| StatPearls: Cardiac Tamponade | Beko triada, paradoksinis pulsas >10, tachikardija – pirmas požymis, BEA | – | CC BY-NC-ND 4.0 | https://www.ncbi.nlm.nih.gov/books/NBK431090/ |
| StatPearls: Electrical Injuries | Žemos įtampos kintamoji srovė → VF (nuo 50–120 mA); vėlyvos aritmijos maža tikimybė po 24–48 val. | – | CC BY-NC-ND 4.0 | https://www.ncbi.nlm.nih.gov/books/NBK448087/ |
| StatPearls / UMEM: Cushing reflex | Hipertenzija su platėjančiu pulsiniu spaudimu, bradikardija, netaisyklingas kvėpavimas | – | CC BY-NC-ND 4.0 | https://www.statpearls.com/point-of-care/20176 |
| CDC „Explosions and Blast Injuries: A Primer“ (archyvas) | Sprogimo plaučių triada (apnėja, bradikardija, hipotenzija); požymiai gali atsirasti iki 48 val.; profilaktinis drenas prieš anesteziją ar skrydį | min–val. | JAV valstybės kūrinys | https://webarchive.library.unt.edu/web/20090114232933/http://www.bt.cdc.gov/masscasualties/pdf/explosions-blast-injuries.pdf |
| WikEM: Heat stroke | >40 °C + CNS; šaldymas vandenyje ~0,2 °C/min, tikslas 39 °C per 30 min, 0,15–0,25 °C/min | min | WikEM (CC BY-SA – patikrinti) | https://wikem.org/wiki/Heat_Stroke |
| NHS Scotland Right Decisions: opioidų sukeltas kvėpavimo slopinimas | Pavojinga: KD <8 ir SpO₂ <85 %; naloksonas 100 µg IV kas 2 min (veikia per 1–2 min, IM per 2–5 min), trunka 15–90 min | min | NHS | https://www.rightdecisions.scot.nhs.uk/shared-content/palliative-care/palliative-care/opioids/life-threatening-opioid-induced-respiratory-depression-requiring-naloxone/ |
| Surviving Sepsis Campaign 2021 | VAS ≥65, antibiotikai per 1 val. esant šokui, 30 ml/kg; Sepsis-3 qSOFA | val. | SCCM/ESICM (CC BY-NC) | https://sccm.org/sepsisguidelines |

### Atviros simuliacijų scenarijų bibliotekos
| Šaltinis | Kas | Licencija | URL |
|---|---|---|---|
| EMSimCases (Kanada) | Recenzuoti nemokami SM scenarijai su vitalinių rodiklių kitimu | Creative Commons (tipas nenurodytas) | https://iceblog.royalcollege.ca/?p=167771 |
| MedEdPORTAL | Recenzuoti scenarijai (daug traumos / ICU) | dažnai CC BY-NC-SA | https://doaj.org/article/8e2818d011d54591b810fdbfa18c8a44 |
| MDPI Healthcare 2022 – „Intraoperative tension pneumothorax… simulation case“ | Atviras scenarijus su vitalinių rodiklių eiga | CC BY | https://mdpi.com/2227-9032/10/9/1787 |
| Virtual Resus Room – ready-to-run cases | Nemokami scenarijai | tikrinti | https://sites.google.com/view/virtualresusroom/ready-to-run-cases/adult |

Pastaba: scenarijų bibliotekomis remtasi tik kaip struktūros pavyzdžiu (etapai → intervencijos). Tekstai neperkelti.

## 2. Scenarijai ir jų šaltiniai

| id | Scenarijus | Pagrindiniai šaltiniai | Laikas |
|---|---|---|---|
| hem | Hemoraginis šokas I→IV kl. | ATLS lentelė; Schiller/Convertino 2017 (dekompensacijos bradikardija); TCCC mod. 11; CGO TCA; Mutschler 2013 (įspėjimas) | ⏱ suspaustas (etapas ~1,5–2 min) |
| jun | Junkcinis kraujavimas | TCCC mod. 11; Pulse hemorrhage (srautai); ATLS | artimas realiam (arterinis) |
| tpx | Įtampos PTX – kvėpuoja pats | Roberts 2015; Kheirabadi 2013; Leigh-Smith 2005; CGO TCA | ⏱ šiek tiek suspaustas |
| tpv | Įtampos PTX – ventiliuojamas | Roberts 2015 (×12,6 / ×17,7, „per minutes“); BioGears multitrauma | realus (min) |
| opx | Atviras PTX → įtampa po tvarsčiu | Kheirabadi 2013 | ⏱ 30–40 min → 5 min |
| hmt | Masyvus hemotoraksas | ATLS (≥1500 ml / 200 ml/val.); Pulse hemothorax lentelė | ⏱ 1–5 val. → min |
| tam | Širdies tamponada | StatPearls Cardiac Tamponade; CGO TCA | min |
| aw | Kvėpavimo takų obstrukcija | Benumof 1997 / Weingart & Levitan 2012; Farmery & Roe | realus (s–min) |
| bls | Sprogimo plaučiai | CDC Blast primer | ⏱ valandos → min |
| tbi | GSmT – Kušingo triada | StatPearls Cushing; JTS TBI CPG | ⏱ |
| tbh | GSmT + hemoraginis šokas (AKS tikslai) | JTS DCR / TBI (sAKS >110); TCCC mod. 11 (sAKS 100) | ⏱ |
| ns | Neurogeninis šokas | StatPearls Neurogenic Shock | ⏱ |
| brn | Nudegimai 40 % + inhaliacija | JTS Burn flowsheet / CPG | ⏱ val. → 3 min/etapas |
| hyp | Hipotermija (šveicarų stadijos) | Pasquier 2019 (CC BY); Pasquier 2021 regresija; Musi 2021; WMS 2019 | ⏱ |
| ana | Anafilaksija po antibiotiko | RCUK 2021; Pumphrey 2000 (5 min) | beveik realus |
| sep | Sepsis PCC 2–3 para | SSC 2021; Sepsis-3 | ⏱ para → ~20 min |
| cru | Crush sindromas | JTS Crush PCC CPG | realus (min po išlaisvinimo) |
| ehs | Šilumos smūgis | WikEM / ACSM / KSI (0,2 °C/min) | šaldymas realus, blogėjimas ⏱ |
| opi | Opioidų sukeltas kvėpavimo slopinimas | NHS Scotland Right Decisions | ⏱ šiek tiek |
| vf | VF – elektros trauma | StatPearls Electrical Injuries; ERC ALS | realus |
| tca | Trauminis sustojimas – BEA (HOTT) | CGO TCA; FPHC RCSEd 2024 | realus |
| norm | Norma | – | – |

## 3. Pastabos ir apribojimai
- Šoko klasės ir hipotermijos stadijos yra idealizuotos. Realūs pacientai jas atitinka retai (Mutschler 2013: 9 %; Pasquier 2019: 61 %). Instruktoriui verta tai paminėti debrifinge.
- Kai šaltinis duoda tik kryptį, absoliučios reikšmės (pvz., tamponados pulsinis spaudimas, sprogimo plaučių SpO₂) parinktos pagal fiziologiją, ne iš duomenų.
- Gyvūnų duomenys (Kheirabadi – kiaulės, bazinis ŠSD ~150) perkelti kaip santykiniai pokyčiai (%), ne absoliučios reikšmės.
- Sustojimo etapuose SpO₂ reikšmė formali: monitorius be perfuzijos rodo „--“.
- Monitoriaus ritmai, kurių SIM neturi (smailūs T, sinusinė banga), aprašyti pastabose. Hiperkalemijai būtų galima naudoti `jun`/`avb3`, jei variklis juos palaiko.
- Nepasiekti (blokuoti arba captcha): PMC pilni tekstai (Leigh-Smith 2005, Mutschler), ccforum, Nelson 2013 kiaulių modelio santrauka (bohrium). Pulse validacijos puslapiuose įtampos PTX ir obstrukcijos skaitinių duomenų nėra – jie yra variklio scenarijų CSV (gitlab.kitware.com/physiology/engine, `data/human/adult/validation`), bet šių failų netikrinau.
