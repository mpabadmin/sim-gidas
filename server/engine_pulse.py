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


def _u(cls, unit):
    from pulse.cdm import scalars
    return getattr(getattr(scalars, cls), unit)


SIDE = {'L': 'Left', 'R': 'Right'}


class PulseEngine:
    name = 'Pulse'

    def __init__(self, version='4.x'):
        self.version = version
        self.e = None
        self.keys = []
        self.alive = True
        self.t = 0.0

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
        return out

    def advance(self, dt):
        ok = self.e.advance_time_s(float(dt))
        if ok is False:
            self.alive = False
        return self.alive

    # ── veiksmai ──
    def build(self, a):
        pa, k = _pa(), a.get('k')
        if k in ('hem', 'hem_stop'):
            x = pa.SEHemorrhage()
            cmp = _enum('eHemorrhage_Compartment')
            x.set_compartment(getattr(cmp, a.get('cmp', 'RightLeg')))
            x.get_severity().set_value(0.0 if k == 'hem_stop' else max(0.0, min(1.0, float(a.get('sev', 0.5)))))
            return x
        if k in ('inf', 'inf_stop'):
            x = pa.SESubstanceCompoundInfusion()
            x.set_compound(a.get('cmp', 'Saline'))
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
        if k == 'intub':
            x = pa.SEIntubation()
            x.set_type(getattr(_enum('eIntubationType' if hasattr(pa, 'eIntubationType') else 'eIntubation_Type'), 'Tracheal'))
            return x
        if k == 'bolus':
            x = pa.SESubstanceBolus()
            route = _enum('eSubstance_Administration') if hasattr(pa, 'eSubstance_Administration') else _enum('eSubstanceAdministration')
            x.set_admin_route(getattr(route, 'Intramuscular' if a.get('route') == 'IM' else 'Intravenous'))
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
        if k == 'eff':
            x = pa.SEPericardialEffusion()
            x.get_effusion_rate().set_value(float(a.get('rate', 5)), _u('VolumePerTimeUnit', 'mL_Per_min'))
            return x
        if k == 'burn':
            x = pa.SEBurnWound()
            x.get_total_body_surface_area().set_value(max(0.0, min(1.0, float(a.get('tbsa', 0.3)))))
            return x
        if k == 'arrest':
            x = pa.SEArrhythmia() if hasattr(pa, 'SEArrhythmia') else pa.SECardiacArrest()
            if hasattr(x, 'set_rhythm'):
                x.set_rhythm(getattr(_enum('eHeartRhythm'), a.get('rhythm', 'Asystole')))
            else:
                x.set_state(getattr(_enum('eSwitch'), 'On'))
            return x
        raise KeyError(k)

    def apply(self, a):
        try:
            x = self.build(a)
        except Exception as ex:
            return False, f'nepalaikoma: {type(ex).__name__}: {ex}'
        try:
            ok = self.e.process_action(x)
            return (ok is not False), ''
        except Exception as ex:
            return False, f'{type(ex).__name__}: {ex}'

    def supported(self):
        """Kurie veiksmai sukuriami šioje versijoje (be taikymo)."""
        demo = {'hem': {'k': 'hem'}, 'hem_stop': {'k': 'hem_stop'}, 'inf': {'k': 'inf', 'cmp': 'Saline'}, 'o2': {'k': 'o2'},
                'tpx': {'k': 'tpx'}, 'ndc': {'k': 'ndc'}, 'occl': {'k': 'occl'}, 'aw': {'k': 'aw', 'sev': 0.5}, 'intub': {'k': 'intub'},
                'bolus': {'k': 'bolus', 'sub': 'Morphine', 'mg': 5}, 'tbi': {'k': 'tbi'}, 'eff': {'k': 'eff'}, 'burn': {'k': 'burn'}, 'arrest': {'k': 'arrest'}}
        out = {}
        for k, a in demo.items():
            try:
                self.build(a)
                out[k] = True
            except Exception as ex:
                out[k] = f'{type(ex).__name__}: {ex}'[:160]
        return out
