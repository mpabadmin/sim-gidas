"""Supaprastintas testinis variklis (NE Pulse).

Naudojamas tik kai Pulse neprieinamas (vietiniams testams, sąsajos patikrai). Reakcijos – grubios
apytikslės pagal ATLS šoko klases ir tipinę fiziologiją; monitorius rodo „Testinis variklis“.
Sąsaja tokia pati kaip engine_pulse.PulseEngine.
"""
import math

LIMB_MAX = {'RightLeg': 250, 'LeftLeg': 250, 'RightArm': 150, 'LeftArm': 150, 'Spleen': 150, 'Liver': 150,
            'Aorta': 1000, 'VenaCava': 600, 'SmallIntestine': 80, 'LargeIntestine': 80, 'Splanchnic': 120,
            'RightKidney': 80, 'LeftKidney': 80, 'Skin': 40, 'Muscle': 80, 'Brain': 40}


def lerp(x, pts):
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


class MockEngine:
    name = 'Testinis'
    version = 'mock-1'

    def __init__(self, version=None):
        self.alive = True
        self.t = 0.0
        self.bv0 = 5600.0
        self.bv = self.bv0
        self.hem = {}       # skyrius -> sunkumas 0–1
        self.inf = {}       # junginys -> [likęs ml, greitis ml/min]
        self.tpx = {}       # pusė -> sunkumas
        self.open = {}
        self.aw = 0.0
        self.fio2 = 0.21
        self.intub = False
        self.tbi = 0.0
        self.eff_rate = 0.0
        self.eff_vol = 0.0
        self.burn = 0.0
        self.drugs = []     # [medžiaga, t_pradžia, mg]
        self.spo2 = 98.0
        self.temp = 36.8
        self.low_t = 0.0
        self.lost = 0.0
        self.arrest = False
        self.bronch = 0.0
        self.pain = 0.0
        self.htx = {}

    def load(self, state):
        return True

    def supported(self):
        return {k: True for k in ('hem', 'hem_stop', 'inf', 'o2', 'tpx', 'ndc', 'occl', 'aw', 'intub', 'bolus', 'tbi', 'eff', 'burn', 'arrest',
                                  'vf', 'rosc', 'pcd', 'htx', 'tube', 'bronch', 'asthma', 'stress', 'pain', 'cric', 'sga')}

    def apply(self, a):
        k = a.get('k')
        if k == 'hem':
            self.hem[a.get('cmp', 'RightLeg')] = max(0.0, min(1.0, float(a.get('sev', 0.5))))
        elif k == 'hem_stop':
            self.hem.pop(a.get('cmp', 'RightLeg'), None)
        elif k == 'inf':
            self.inf[a.get('cmp', 'Saline')] = [float(a.get('ml', 500)), float(a.get('rate', 50))]
        elif k == 'inf_stop':
            self.inf.pop(a.get('cmp', 'Saline'), None)
        elif k == 'o2':
            self.fio2 = {'NasalCannula': 0.32, 'SimpleMask': 0.45, 'NonRebreatherMask': 0.8}.get(a.get('dev'), 0.6)
        elif k == 'o2_off':
            self.fio2 = 0.21
        elif k == 'tpx':
            self.tpx[a.get('side', 'L')] = max(0.0, min(1.0, float(a.get('sev', 0.6))))
            self.open[a.get('side', 'L')] = bool(a.get('open'))
        elif k == 'ndc':
            s = a.get('side', 'L')
            if s in self.tpx:
                self.tpx[s] = min(self.tpx[s], 0.1)
        elif k == 'occl':
            s = a.get('side', 'L')
            if self.open.get(s):
                self.tpx[s] = min(self.tpx.get(s, 0), 0.3)
                self.open[s] = False
        elif k == 'aw':
            self.aw = max(0.0, min(1.0, float(a.get('sev', 0.0))))
        elif k in ('intub', 'cric', 'sga'):
            self.intub, self.aw = True, 0.0
        elif k == 'pcd':
            self.eff_rate, self.eff_vol = 0.0, max(0.0, self.eff_vol - abs(float(a.get('drain', 150))) * float(a.get('dur', 90) or 90) / 60)
        elif k == 'htx':
            s_ = a.get('side', 'L')
            self.htx[s_] = max(0.0, min(1.0, float(a.get('sev', 0.5))))
            self.hem['Thorax' + s_] = self.htx[s_] * 0.5
        elif k == 'tube':
            s_ = a.get('side', 'L')
            self.htx.pop(s_, None)
            self.tpx[s_] = min(self.tpx.get(s_, 0), 0.05)
        elif k in ('bronch', 'asthma'):
            self.bronch = max(0.0, min(1.0, float(a.get('sev', 0.5))))
        elif k in ('pain', 'stress'):
            self.pain = max(0.0, min(1.0, float(a.get('sev', 0.6))))
        elif k == 'bolus':
            self.drugs.append([a.get('sub', ''), self.t, float(a.get('mg', 1))])
        elif k == 'tbi':
            self.tbi = max(0.0, min(1.0, float(a.get('sev', 0.5))))
        elif k == 'eff':
            self.eff_rate = max(0.0, float(a.get('rate', 5)))
        elif k == 'burn':
            self.burn = max(0.0, min(1.0, float(a.get('tbsa', 0.3))))
        elif k == 'arrest':
            self.arrest = a.get('rhythm') != 'NormalSinus'
            if not self.arrest:
                self.low_t = 0.0
            elif not a.get('rhythm'):
                self.alive = False      # be ritmo – negrįžtama būklė (testams)
        else:
            return False, 'nežinomas veiksmas'
        return True, ''

    def _drug(self, name, half_min):
        return sum(math.exp(-(self.t - t0) / 60.0 / half_min) for n, t0, mg in self.drugs if n == name and self.t >= t0)

    def advance(self, dt):
        if not self.alive:
            return False
        step = 1.0
        n = max(1, int(round(dt / step)))
        for _ in range(n):
            self._step(dt / n)
        return self.alive

    def _step(self, dt):
        self.t += dt
        m = dt / 60.0
        loss = sum(LIMB_MAX.get(c, 100) * s * max(0.35, self.bv / self.bv0) for c, s in self.hem.items()) * m
        loss += self.burn * 25.0 * m
        self.lost += loss
        gain = 0.0
        for c, v in list(self.inf.items()):
            d = min(v[0], v[1] * m)
            v[0] -= d
            gain += d * (1.0 if c in ('Blood', 'PackedRBC', 'Plasma') else 0.4)  # kristaloidai – dalis lieka kraujagyslėse
            if v[0] <= 0.1:
                self.inf.pop(c)
        self.bv = max(1500.0, min(self.bv0 * 1.15, self.bv - loss + gain))
        self.eff_vol = max(0.0, self.eff_vol + self.eff_rate * m)
        for s in list(self.tpx):
            if not self.open.get(s) and self.tpx[s] > 0.1:
                self.tpx[s] = min(1.0, self.tpx[s] + 0.004 * m * 60 / 60)
        # tikslinis SpO₂
        tp = max(self.tpx.values() or [0])
        tgt = 98.0 - 30 * tp - 55 * self.aw * (0 if self.intub else 1) - 25 * self.bronch - 12 * max(self.htx.values() or [0])
        tgt += (self.fio2 - 0.21) * 12
        opi = self._drug('Morphine', 90) + self._drug('Fentanyl', 45)
        nal = self._drug('Naloxone', 45)
        opi_eff = max(0.0, opi - nal * 2)
        tgt -= 6 * opi_eff
        tgt = max(40.0, min(100.0, tgt))
        self.spo2 += (tgt - self.spo2) * min(1.0, dt / 30.0)
        d = max(0.0, (self.bv0 - self.bv) / self.bv0)
        if (self.vit_cache_sys if hasattr(self, 'vit_cache_sys') else 120) < 35 or self.spo2 < 50 or self.arrest:
            self.low_t += dt
        else:
            self.low_t = max(0.0, self.low_t - dt)
        if self.low_t > (600 if self.arrest else 180):
            self.alive = False
        self.temp += (-0.3 * (1 if self.hem or self.burn else 0.2) / 3600.0) * dt - d * 0.0002 * dt

    def vitals(self):
        if self.arrest and self.alive:
            return {'hr': 0, 'sys': 18, 'dia': 18, 'map': 18, 'spo2': round(self.spo2), 'rr': 0, 'temp': round(self.temp, 1), 'bv': round(self.bv), 'co': 0}
        if not self.alive:
            return {'hr': 0, 'sys': 0, 'dia': 0, 'map': 0, 'spo2': None, 'rr': 0, 'temp': round(self.temp, 1), 'bv': round(self.bv), 'co': 0}
        d = max(0.0, (self.bv0 - self.bv) / self.bv0)
        hr = lerp(d, [(0, 74), (.15, 98), (.30, 118), (.40, 136), (.50, 148), (.60, 120), (.70, 60)])
        sys = lerp(d, [(0, 122), (.15, 120), (.30, 108), (.40, 86), (.50, 66), (.60, 45), (.70, 25)])
        dia = lerp(d, [(0, 78), (.15, 84), (.30, 82), (.40, 62), (.50, 46), (.60, 30), (.70, 15)])
        rr = lerp(d, [(0, 14), (.15, 18), (.30, 25), (.40, 32), (.50, 38), (.65, 8)])
        tp = max(self.tpx.values() or [0])
        hr += 40 * tp
        sys -= 55 * tp * tp
        dia -= 20 * tp * tp
        rr += 14 * tp
        if self.eff_vol > 120:
            f = min(1.0, (self.eff_vol - 120) / 250)
            hr += 35 * f
            sys -= 50 * f
            dia -= 15 * f
        if self.aw > 0 and not self.intub:
            rr += 10 * self.aw if self.spo2 > 75 else -8
            hr += 25 * self.aw if self.spo2 > 70 else -50 * self.aw
        if self.tbi > 0.6:
            f = (self.tbi - 0.6) / 0.4
            hr -= 40 * f
            sys += 45 * f
            rr = max(6, rr - 8 * f)
        ket = self._drug('Ketamine', 15)
        epi = self._drug('Epinephrine', 3)
        opi = max(0.0, self._drug('Morphine', 90) + self._drug('Fentanyl', 45) - 2 * self._drug('Naloxone', 45))
        mid = self._drug('Midazolam', 60)
        anal = min(1.0, ket + opi * 0.8)
        hr += 25 * self.pain * (1 - anal)
        sys += 15 * self.pain * (1 - anal)
        rr += 12 * self.bronch + 4 * self.pain * (1 - anal)
        hr += 10 * ket + 35 * epi + 25 * self._drug('Naloxone', 45) * (1 if opi > 0 else 0)
        sys += 10 * ket + 35 * epi - 8 * opi - 6 * mid
        rr -= 4 * opi + 2 * mid
        self.vit_cache_sys = sys
        sys = max(0.0, sys)
        dia = max(0.0, min(dia, sys - 8))
        return {'hr': round(max(0, hr)), 'sys': round(sys), 'dia': round(dia), 'map': round(dia + (sys - dia) / 3),
                'spo2': round(self.spo2), 'rr': round(max(0, rr)), 'temp': round(self.temp, 1), 'bv': round(self.bv),
                'co': round(max(0.5, 5.2 * (1 - d * 1.4) - tp * 1.5), 1)}
