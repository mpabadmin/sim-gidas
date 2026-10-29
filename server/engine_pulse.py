"""Kitware Pulse Physiology Engine adapteris (Python API, PyPulse).

Pulse Python API skirtingose versijose (4.1–4.4) šiek tiek skiriasi, todėl kiekvienas veiksmas kuriamas
atsargiai: neprieinamas veiksmas pažymimas kaip nepalaikomas, o serveris jo nesiūlo (žr. /selftest).
Duomenų šaknis – Pulse install `bin` katalogas (jame PyPulse*.so, states/, substances/).
"""
import glob
import math
import os
import sys

BIN = None


def find_install():
    """Suranda Pulse `bin` ir `python` katalogus (PULSE_BIN aplinkos kintamasis arba paieška)."""
    cands = []
    if os.environ.get('PULSE_BIN'):
        cands.append(os.environ['PULSE_BIN'])
    for root in ('/pulse', '/opt/pulse', '/source', '/workspace', '/usr/local', '/home'):
        cands += [os.path.dirname(p) for p in glob.glob(os.path.join(root, '**', 'PyPulse*.so'), recursive=True)[:5]]
        if cands:
            break
    for b in cands:
        if glob.glob(os.path.join(b, 'PyPulse*')) and os.path.isdir(os.path.join(b, 'states')):
            py = None
            for c in (os.path.join(b, '..', 'python'), os.path.join(b, 'python'), b):
                if os.path.isfile(os.path.join(c, 'pulse', 'engine', 'PulseEngine.py')):
                    py = os.path.abspath(c)
                    break
            if py is None:
                hits = glob.glob(os.path.join(os.path.dirname(b), '**', 'pulse', 'engine', 'PulseEngine.py'), recursive=True)
                if hits:
                    py = os.path.abspath(os.path.join(os.path.dirname(hits[0]), '..', '..'))
            return os.path.abspath(b), py
    return None, None


def setup():
    """Paruošia importą; grąžina (bin, version) arba kelia ImportError."""
    global BIN
    b, py = find_install()
    if not b:
        raise ImportError('Pulse install nerastas (PyPulse*.so + states/)')
    for p in (b, py):
        if p and p not in sys.path:
            sys.path.insert(0, p)
    os.chdir(b)  # senesnės versijos duomenis ieško santykiniu keliu
    BIN = b
    from pulse.engine import PulseEngine as PE  # noqa: F401
    ver = getattr(PE, 'version', None) or getattr(PE, '__version__', None) or ''
    try:
        ver = ver() if callable(ver) else ver
    except Exception:
        ver = ''
    return b, str(ver or '4.x')


def states():
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(BIN, 'states', '*@0s.json')))


def compounds():
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(BIN, 'substances', 'compounds', '*.json')))


def substances():
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(BIN, 'substances', '*.json')))


VITALS = [  # (raktas, Pulse savybė, vieneto klasė, vienetas)
    ('hr', 'HeartRate', 'FrequencyUnit', 'Per_min'),
    ('sys', 'SystolicArterialPressure', 'PressureUnit', 'mmHg'),
    ('dia', 'DiastolicArterialPressure', 'PressureUnit', 'mmHg'),
    ('map', 'MeanArterialPressure', 'PressureUnit', 'mmHg'),
    ('spo2', 'OxygenSaturation', None, None),
    ('rr', 'RespirationRate', 'FrequencyUnit', 'Per_min'),
    ('temp', 'CoreTemperature', 'TemperatureUnit', 'C'),
    ('bv', 'BloodVolume', 'VolumeUnit', 'mL'),
    ('co', 'CardiacOutput', 'VolumePerTimeUnit', 'L_Per_min'),
]
CORE = 7  # pirmi 7 – būtini; kiti – jei versija palaiko


def _pa():
    import pulse.cdm.patient_actions as pa
    return pa


def _enum(name):
    for mod in ('pulse.cdm.patient_actions', 'pulse.cdm.enums', 'pulse.cdm.engine', 'pulse.cdm.patient', 'pulse.cdm.mechanical_ventilator'):
        try:
            m = __import__(mod, fromlist=[name])
            if hasattr(m, name):
                return getattr(m, name)
        except Exception:
            pass
    raise AttributeError(name)


class _IntEnum:
    """Enum pakaitalas su sveikojo skaičiaus reikšme (taiso Pulse Python enum su kortežo reikšme)."""
    def __init__(self, e):
        self.name = e.name
        self.value = e.value[0] if isinstance(e.value, tuple) else e.value

    def __eq__(self, o):
        return getattr(o, 'name', o) == self.name

    def __hash__(self):
        return hash(self.name)


def _fix_enums(x):
    from enum import Enum
    fixed = False
    names = set(getattr(x, '__dict__', {}).keys())
    for c in type(x).__mro__:
        names.update(getattr(c, '__slots__', ()))
    for n in names:
        try:
            v = getattr(x, n)
        except Exception:
            continue
        if isinstance(v, Enum) and isinstance(v.value, tuple):
            setattr(x, n, _IntEnum(v))
            fixed = True
    return fixed


def _err(ex):
    import traceback
    tb = traceback.extract_tb(ex.__traceback__)
    where = f' ({os.path.basename(tb[-1].filename)}:{tb[-1].lineno} {tb[-1].line})' if tb else ''
    return f'{type(ex).__name__}: {ex}{where}'[:300]


def _u(cls, unit):
    from pulse.cdm import scalars
    return getattr(getattr(scalars, cls), unit)


SIDE = {'L': 'Left', 'R': 'Right'}


def hem_compartments():
    try:
        e = _enum('eHemorrhage_Compartment')
        return [m.name for m in e]
    except Exception:
        return []


def tbi_overlay(v, tbi, clock):
    """Sunkios GST poveikis (Pulse 4.3.1 SEBrainInjury rodiklių beveik nekeičia): didėjant intrakranijiniam spaudimui
    per ~5–20 min – Cushingo reakcija: bradikardija, hipertenzija, retas nereguliarus kvėpavimas. Lengva GST (<0,5) – be poveikio."""
    if not tbi or not v or v.get('hr') in (None, 0):
        return v
    sev, t0 = tbi
    if sev < 0.5 or (v.get('sys') or 0) < 40:
        return v
    k = (sev - 0.5) / 0.5                                   # 0..1
    f = max(0.0, min(1.0, (clock - t0) / (1200 - 700 * k)))  # pilnas poveikis per 20 min (sev 0,5) … 8 min (sev 1)
    f *= 0.4 + 0.6 * k
    out = dict(v)
    out['hr'] = max(35.0, v['hr'] * (1 - 0.45 * f))
    if v.get('sys') is not None:
        out['sys'] = v['sys'] + 55 * f
    if v.get('dia') is not None:
        out['dia'] = v['dia'] + 20 * f
    if v.get('map') is not None:
        out['map'] = v['map'] + 32 * f
    if v.get('rr') is not None:
        wob = math.sin(clock / 9.0) * 3 * f                  # nereguliarus kvėpavimas
        out['rr'] = max(4.0, v['rr'] * (1 - 0.5 * f) + wob)
    return out
_CACHE = {}


def _known(kind, name):
    """Ar junginys/medžiaga yra šios Pulse versijos duomenyse. Pulse process_action() grąžina None ir apie nežinomą
    pavadinimą tik rašo į žurnalą, todėl be šios patikros klientas gautų ack ok=True, nors niekas nevyksta."""
    if kind not in _CACHE:
        try:
            _CACHE[kind] = set(compounds() if kind == 'c' else substances())
        except Exception:
            _CACHE[kind] = set()
    return not _CACHE[kind] or name in _CACHE[kind]


# Pulse 4.3.1 neturi šių junginių – artimiausias pakaitalas (pranešama ack žinutėje)
COMPOUND_ALT = {'LactatedRingers': 'Saline'}


class PulseEngine:
    name = 'Pulse'

    def __init__(self, version='4.x'):
        self.version = version
        self.e = None
        self.keys = []
        self.alive = True
        self.t = 0.0
        self.clock = 0.0      # modeliavimo laikas (pagal advance)
        self.later = []       # [(laikas, veiksmas)] – atidėti veiksmai (pvz. drenavimo pabaiga)
        self.tbi = None       # (sunkumas, pradžia) – GST poveikis rodikliams (Pulse 4.3.1 jo beveik nerodo)

    def load(self, state):
        from pulse.engine.PulseEngine import PulseEngine as PE
        from pulse.cdm.engine import SEDataRequest, SEDataRequestManager
        path = os.path.join(BIN, 'states', state)
        if not os.path.isfile(path):
            raise FileNotFoundError(state)
        e = None
        try:
            from pulse.engine.PulseEngine import eModelType
            e = PE(eModelType.HumanAdultWholeBody, BIN + '/')
        except Exception:
            for args in ((), ):
                try:
                    e = PE(data_root_dir=BIN + '/')
                except Exception:
                    e = PE(*args)
        try:
            e.log_to_console(False)
        except Exception:
            pass
        for n in (len(VITALS), CORE):
            reqs = []
            for _, prop, c, u in VITALS[:n]:
                reqs.append(SEDataRequest.create_physiology_request(prop, unit=_u(c, u) if c else None))
            try:
                if e.serialize_from_file(path, SEDataRequestManager(reqs)):
                    self.keys = [v[0] for v in VITALS[:n]]
                    break
            except Exception:
                continue
        else:
            raise RuntimeError('Pulse nepavyko įkelti būsenos ' + state)
        self.e = e
        self.e.advance_time_s(0.0) if hasattr(self.e, 'advance_time_s') else None
        return True

    def vitals(self):
        d = self.e.pull_data()
        if isinstance(d, dict):
            vals = list(d.values())
        else:
            vals = list(d)
        if len(vals) == len(self.keys) + 1:
            self.t = float(vals[0])
            vals = vals[1:]
        out = {}
        for k, v in zip(self.keys, vals):
            try:
                v = float(v)
                out[k] = v if math.isfinite(v) else None
            except Exception:
                out[k] = None
        if out.get('spo2') is not None and out['spo2'] <= 1.0:
            out['spo2'] *= 100.0
        return tbi_overlay(out, self.tbi, self.clock)

    def advance(self, dt):
        ok = self.e.advance_time_s(float(dt))
        self.clock += float(dt)
        if ok is False:
            self.alive = False
        if self.later and self.alive:
            due = [x for x in self.later if x[0] <= self.clock]
            self.later = [x for x in self.later if x[0] > self.clock]
            for _, a in due:
                try:
                    self.apply(a)
                except Exception:
                    pass
        return self.alive

    # ── veiksmai ──
    def build(self, a):
        pa, k = _pa(), a.get('k')
        if k in ('hem', 'hem_stop'):
            x = pa.SEHemorrhage()
            cmp = _enum('eHemorrhage_Compartment')
            if not hasattr(cmp, a.get('cmp', 'RightLeg')):
                raise ValueError(f'kraujavimo vietos {a.get("cmp")} šioje Pulse versijoje nėra')
            x.set_compartment(getattr(cmp, a.get('cmp', 'RightLeg')))
            x.get_severity().set_value(0.0 if k == 'hem_stop' else max(0.0, min(1.0, float(a.get('sev', 0.5)))))
            return x
        if k in ('inf', 'inf_stop'):
            x = pa.SESubstanceCompoundInfusion()
            c = a.get('cmp', 'Saline')
            if not _known('c', c) and _known('c', COMPOUND_ALT.get(c, '?')):
                c = COMPOUND_ALT[c]
            if not _known('c', c):
                raise ValueError(f'junginio {c} šioje Pulse versijoje nėra')
            x.set_compound(c)
            rate = 0.0 if k == 'inf_stop' else float(a.get('rate', 50))
            x.get_rate().set_value(rate, _u('VolumePerTimeUnit', 'mL_Per_min'))
            x.get_bag_volume().set_value(float(a.get('ml', 500)), _u('VolumeUnit', 'mL'))
            return x
        if k in ('o2', 'o2_off'):
            x = pa.SESupplementalOxygen()
            dev = _enum('eDevice')
            x.set_device(getattr(dev, a.get('dev', 'NonRebreatherMask')) if k == 'o2' else getattr(dev, 'NullDevice', getattr(dev, 'None', None)))
            x.get_flow().set_value(float(a.get('flow', 10)) if k == 'o2' else 0.0, _u('VolumePerTimeUnit', 'L_Per_min'))
            try:
                x.get_volume().set_value(math.inf, _u('VolumeUnit', 'L'))
            except Exception:
                pass
            return x
        if k == 'tpx':
            x = pa.SETensionPneumothorax()
            x.set_side(getattr(_enum('eSide'), SIDE[a.get('side', 'L')]))
            x.set_type(getattr(_enum('eGate'), 'Open' if a.get('open') else 'Closed'))
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.6)))))
            return x
        if k == 'ndc':
            x = pa.SENeedleDecompression()
            x.set_side(getattr(_enum('eSide'), SIDE[a.get('side', 'L')]))
            x.set_state(getattr(_enum('eSwitch'), 'On'))
            return x
        if k == 'occl':
            x = pa.SEChestOcclusiveDressing()
            x.set_side(getattr(_enum('eSide'), SIDE[a.get('side', 'L')]))
            x.set_state(getattr(_enum('eSwitch'), 'On'))
            return x
        if k == 'aw':
            x = pa.SEAirwayObstruction()
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.0)))))
            return x
        if k in ('intub', 'cric', 'sga'):
            # Pulse 4.3.1: SEIntubation savaime kvėpuojančiam pacientui obstrukcijos nepanaikina (bandymai: SpO₂ toliau krenta,
            # KD ↑) – užtikrinti kvėpavimo takai modeliuojami kaip obstrukcijos pašalinimas
            x = pa.SEAirwayObstruction()
            x.get_severity().set_value(0.0)
            return x
        if k == 'bolus':
            x = pa.SESubstanceBolus()
            route = _enum('eSubstance_Administration') if hasattr(pa, 'eSubstance_Administration') else _enum('eSubstanceAdministration')
            x.set_admin_route(getattr(route, 'Intramuscular' if a.get('route') == 'IM' else 'Intravenous'))
            if not a.get('sub') or not _known('s', a.get('sub')):
                raise ValueError(f'medžiagos {a.get("sub")} šioje Pulse versijoje nėra')
            x.set_substance(a.get('sub'))
            x.get_dose().set_value(1.0, _u('VolumeUnit', 'mL'))
            x.get_concentration().set_value(float(a.get('mg', 1)), _u('MassPerVolumeUnit', 'mg_Per_mL'))
            return x
        if k == 'tbi':
            x = pa.SEBrainInjury()
            try:
                x.set_type(getattr(_enum('eBrainInjuryType' if hasattr(pa, 'eBrainInjuryType') else 'eBrainInjury_Type'), 'Diffuse'))
            except Exception:
                pass
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.5)))))
            return x
        if k in ('eff', 'pcd'):
            # pcd – perikardiocentezė: skystis siurbiamas neigiamu greičiu, po 'dur' s sustabdoma (atidėtas veiksmas)
            x = pa.SEPericardialEffusion()
            rate = -abs(float(a.get('drain', 150))) if k == 'pcd' else float(a.get('rate', 5))
            x.get_effusion_rate().set_value(rate, _u('VolumePerTimeUnit', 'mL_Per_min'))
            return x
        if k == 'burn' and not hasattr(pa, 'SEBurnWound'):
            # Pulse 4.3.1 Python sąsajoje nudegimo veiksmo nėra – plazmos netekimą apytiksliai modeliuojame lėtu „kraujavimu“ per odą
            return self.build({'k': 'hem', 'cmp': 'Skin' if hasattr(_enum('eHemorrhage_Compartment'), 'Skin') else 'Muscle',
                               'sev': max(0.02, min(0.2, float(a.get('tbsa', 0.3)) * 0.2))})
        if k == 'burn':
            x = pa.SEBurnWound()
            x.get_total_body_surface_area().set_value(max(0.0, min(1.0, float(a.get('tbsa', 0.3)))))
            return x
        if k == 'arrest':
            x = pa.SEArrhythmia() if hasattr(pa, 'SEArrhythmia') else pa.SECardiacArrest()
            if hasattr(x, 'set_rhythm'):
                hr_ = _enum('eHeartRhythm')
                want = a.get('rhythm', 'Asystole')
                alts = {'CoarseVentricularFibrillation': ['CoarseVentricularFibrillation', 'VentricularFibrillation', 'FineVentricularFibrillation', 'Asystole'],
                        'PulselessVentricularTachycardia': ['PulselessVentricularTachycardia', 'CoarseVentricularFibrillation', 'Asystole'],
                        'NormalSinus': ['NormalSinus']}.get(want, [want])
                name = next((n for n in alts if hasattr(hr_, n)), None)
                if not name:
                    raise ValueError(f'ritmo {want} šioje Pulse versijoje nėra')
                x.set_rhythm(getattr(hr_, name))
            else:
                x.set_state(getattr(_enum('eSwitch'), 'On'))
            return x
        if k in ('htx', 'tube'):
            x = getattr(pa, 'SEHemothorax' if k == 'htx' else 'SETubeThoracostomy')()
            x.set_side(getattr(_enum('eSide'), SIDE[a.get('side', 'L')]))
            if k == 'htx':
                # bandymai su Pulse 4.3.1: sunkumas (severity) rodiklių nekeitė – naudojamas kraujo tekėjimo į pleurą greitis
                if hasattr(x, 'get_flow_rate'):
                    x.get_flow_rate().set_value(float(a.get('sev', 0.5)) * 200, _u('VolumePerTimeUnit', 'mL_Per_min'))
                else:
                    x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.5)))))
            # drenas – Pulse numatytasis drenavimo greitis (nustačius 200 ml/min bandymuose hemodinamika griuvo)
            return x
        if k in ('bronch', 'asthma', 'stress'):
            x = getattr(pa, {'bronch': 'SEBronchoconstriction', 'asthma': 'SEAsthmaAttack', 'stress': 'SEAcuteStress'}[k])()
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.5)))))
            return x
        if k == 'pain' and not hasattr(pa, 'SEPainStimulus'):
            # Pulse 4.3.1 Python sąsajoje skausmo dirgiklio nėra – simpatinę reakciją modeliuojame ūmiu stresu
            x = pa.SEAcuteStress()
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.6)))))
            return x
        if k == 'pain':
            x = pa.SEPainStimulus()
            x.set_location(str(a.get('loc') or 'LeftLeg'))
            x.get_severity().set_value(max(0.0, min(1.0, float(a.get('sev', 0.6)))))
            return x
        raise KeyError(k)

    def apply(self, a):
        k = a.get('k')
        if k == 'tbi':
            sev = max(0.0, min(1.0, float(a.get('sev', 0.5))))
            self.tbi = (sev, self.clock) if sev > 0 else None
        if k == 'pcd':
            self.later.append((self.clock + float(a.get('dur', 90) or 90), {'k': 'eff', 'rate': 0}))
        if k == 'pain':
            self.pain = max(0.0, min(1.0, float(a.get('sev', 0.6))))
        if k == 'bolus' and getattr(self, 'pain', 0) > 0 and a.get('sub') in ('Ketamine', 'Fentanyl', 'Morphine') and not hasattr(_pa(), 'SEPainStimulus'):
            # analgetikas mažina skausmo (streso) reakciją po 2 min (IV) / 5 min (IM)
            self.pain = round(self.pain * (0.35 if a.get('sub') == 'Ketamine' else 0.5), 2)
            self.later.append((self.clock + (120 if a.get('route') != 'IM' else 300), {'k': 'pain', 'sev': self.pain}))
        try:
            x = self.build(a)
        except Exception as ex:
            return False, f'nepalaikoma: {type(ex).__name__}: {ex}'
        try:
            ok = self.e.process_action(x)
            return (ok is not False), self._note(a)
        except TypeError as ex:
            # Pulse 4.3.x: kai kurių Python enum reikšmės – kortežai (Intravenous = 0,), protobuf jų nepriima
            if 'tuple' not in str(ex) or not _fix_enums(x):
                return False, _err(ex)
            try:
                ok = self.e.process_action(x)
                return (ok is not False), self._note(a)
            except Exception as ex2:
                return False, _err(ex2)
        except Exception as ex:
            return False, _err(ex)

    def _note(self, a):
        c = a.get('cmp')
        if a.get('k') in ('inf', 'inf_stop') and not _known('c', c) and c in COMPOUND_ALT:
            return f'apytiksliai: {c} šioje Pulse versijoje nėra – naudojamas {COMPOUND_ALT[c]}'
        if a.get('k') == 'burn' and not hasattr(_pa(), 'SEBurnWound'):
            return 'apytiksliai: šioje Pulse versijoje nudegimas modeliuojamas kaip skysčių netekimas per odą'
        if a.get('k') == 'pain' and not hasattr(_pa(), 'SEPainStimulus'):
            return 'apytiksliai: skausmas modeliuojamas kaip ūmus stresas (ŠSD, AKS ↑), analgetikai jį mažina'
        if a.get('k') == 'tbi':
            return 'apytiksliai: GST poveikis (Cushingo reakcija) pridedamas prie Pulse rodiklių'
        if a.get('k') in ('intub', 'cric', 'sga'):
            return 'kvėpavimo takai užtikrinti (obstrukcija pašalinta)'
        return ''

    def supported(self):
        """Kurie veiksmai sukuriami šioje versijoje (be taikymo)."""
        demo = {'hem': {'k': 'hem'}, 'hem_stop': {'k': 'hem_stop'}, 'inf': {'k': 'inf', 'cmp': 'Saline'}, 'o2': {'k': 'o2'},
                'tpx': {'k': 'tpx'}, 'ndc': {'k': 'ndc'}, 'occl': {'k': 'occl'}, 'aw': {'k': 'aw', 'sev': 0.5}, 'intub': {'k': 'intub'},
                'bolus': {'k': 'bolus', 'sub': 'Morphine', 'mg': 5}, 'tbi': {'k': 'tbi'}, 'eff': {'k': 'eff'}, 'burn': {'k': 'burn'}, 'arrest': {'k': 'arrest'},
                'vf': {'k': 'arrest', 'rhythm': 'CoarseVentricularFibrillation'}, 'rosc': {'k': 'arrest', 'rhythm': 'NormalSinus'},
                'pcd': {'k': 'pcd'}, 'htx': {'k': 'htx'}, 'tube': {'k': 'tube'}, 'bronch': {'k': 'bronch'}, 'asthma': {'k': 'asthma'},
                'stress': {'k': 'stress'}, 'pain': {'k': 'pain'}, 'cric': {'k': 'cric'}, 'sga': {'k': 'sga'}, 'occl': {'k': 'occl'}}
        out = {}
        for k, a in demo.items():
            try:
                self.build(a)
                out[k] = True
            except Exception as ex:
                out[k] = f'{type(ex).__name__}: {ex}'[:160]
        return out
