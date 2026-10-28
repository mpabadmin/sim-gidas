#!/usr/bin/env python3
# Sugeneruoja scen-import.js iš ETC ir March gidų scenarijų (gyvybės požymiai kiekviename klausime).
# Paleisti: python3 tools/build_import.py  (šalia turi būti ../etc-gidas ir ../march-gidas)
import json, re, os
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(H)
def load(app):
    s = open(os.path.join(ROOT, '..', app, 'scenarijai.js'), encoding='utf-8').read()
    i = s.index('window.ETC.scenarijai = ') + len('window.ETC.scenarijai = ')
    return json.loads(s[i:].rstrip().rstrip(';'))
num = lambda x: float(re.sub(r'[^\d,.]', '', x).replace(',', '.'))
out = []
for app, src in (('etc-gidas', 'ETC'), ('march-gidas', 'March')):
    for sc in load(app):
        st = []; prev = {'hr': 90, 'sys': 120, 'dia': 78, 'spo2': 97, 'rr': 16, 'temp': 36.6}; anyv = False
        for k, q in enumerate(sc['q'], 1):
            gp = q.get('gp') or {}; v = dict(prev)
            rp = gp.get('Radialinis pulsas', '')
            if 'ŠSD' in gp: v['hr'] = int(num(gp['ŠSD'])); anyv = True
            if 'AKS' in gp and '/' in gp['AKS']:
                a, b = gp['AKS'].split('/'); v['sys'] = int(num(a)); v['dia'] = int(num(b)); anyv = True
            elif rp in ('silpnas',) and k == 1: v['sys'], v['dia'] = 86, 54; v['hr'] = max(v['hr'], 118)
            elif rp == 'nečiuopiamas': v['sys'], v['dia'] = 66, 40
            if 'SpO₂' in gp: v['spo2'] = int(num(gp['SpO₂'])); anyv = True
            if 'KD' in gp: v['rr'] = int(num(gp['KD'])); anyv = True
            if 'T' in gp: v['temp'] = round(num(gp['T']), 1); anyv = True
            extra = ', '.join(f'{kk} {vv}' for kk, vv in gp.items() if kk in ('AVPU', 'GKS', 'Skausmas', 'Radialinis pulsas'))
            st.append({'n': f'{k} klausimas', 'v': v, 'p': q['sit'] + (f' ({extra})' if extra else ''), 'k': q.get('klaus', '')})
            prev = v
        if anyv:
            out.append({'id': sc['id'], 'src': src, 'pav': sc['pav'], 'tema': sc.get('tema', ''), 'lygis': sc.get('lygis', ''), 'st': st})
js = ('// Sugeneruota tools/build_import.py iš ETC ir March gidų scenarijų – nekeisti ranka.\n'
      'window.SIMX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'scen-import.js'), 'w', encoding='utf-8').write(js)
print(len(out), 'scenarijų,', len(js), 'B')
