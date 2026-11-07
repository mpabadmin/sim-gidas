#!/usr/bin/env python3
# Sugeneruoja scen-import.js iš ETC ir March gidų scenarijų (gyvybės požymiai kiekviename klausime).
# Paleisti: python3 tools/build_import.py  (šalia turi būti ../etc-gidas ir ../march-gidas)
# Taisyklės, kai gide reikšmės nenurodytos:
#  - širdies sustojimas (tekste „centrinio / miego arterijos pulso nėra“, „širdies sustojimas“, „BEA“; arba AVPU U ir
#    radialinis pulsas nečiuopiamas be AKS; arba tęsiasi iš ankstesnio klausimo be naujų ŠSD/AKS) → ritmas BEA, AKS 0/0
#    („asistolija“ tekste → asistolija); agonalinis kvėpavimas → KD 4, kitaip KD 0;
#  - šokas (ŠSD ≥ 120 ir sAKS < 90, KD nenurodytas) → KD 26;
#  - ŠSD ≥ 120, o AKS nenurodytas (liktų 120/78) → 108/84 (siauras pulsinis spaudimas);
#  - hipoksinė bradikardija (ŠSD < 60 ir SpO₂ < 85, AKS nenurodytas) → 86/50;
#  - AKS tekste („sAKS 88“, „AKS 92/60“) – naudojamas, kai gide (gp) nenurodytas;
#  - radialinis pulsas silpnas (gp arba tekste) be AKS → 84/58 (bet kuriame klausime); nečiuopiamas → 66/40; stiprus, o paveldėtas sAKS < 95 → 112/72;
#  - EtCO₂ – SIM jo nerodo, todėl iš teksto išbraukiamas.
import json, re, os
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(H)
def load(app):
    s = open(os.path.join(ROOT, '..', app, 'scenarijai.js'), encoding='utf-8').read()
    i = s.index('window.ETC.scenarijai = ') + len('window.ETC.scenarijai = ')
    return json.loads(s[i:].rstrip().rstrip(';'))
num = lambda x: float(re.sub(r'[^\d,.]', '', x).replace(',', '.'))
ARREST = re.compile(r'(centrinio|miego arterijos) pulso nėra|nėra (centrinio|miego arterijos) pulso|širdies sustojim|\bBEA\b', re.I)
ROSC = re.compile(r'atsirado (centrinis )?pulsas|pulsas grįžo|ROSC', re.I)
TBP = re.compile(r'\bs?AKS\s*(?:–|-|yra|buvo|krito iki|nukrito iki|iki)?\s*(\d{2,3})(?:\s*/\s*(\d{2,3}))?(?:\s*mm\s*Hg)?')
ETCO2 = re.compile(r'[,;]?\s*EtCO₂\s*[^.;,)]*')
BASE = {'hr': 90, 'sys': 120, 'dia': 78, 'spo2': 97, 'rr': 16, 'temp': 36.6}
out = []
for app, src in (('etc-gidas', 'ETC'), ('march-gidas', 'March')):
    for sc in load(app):
        st = []; prev = dict(BASE); anyv = False; arrest = False; ex = set()  # ex – gide nurodyti (paveldimi) rodikliai
        for k, q in enumerate(sc['q'], 1):
            gp = q.get('gp') or {}; txt = ETCO2.sub('', q['sit']).replace(' .', '.')
            v = {kk: (prev[kk] if kk in ex else BASE[kk]) for kk in BASE}
            rp = gp.get('Radialinis pulsas', '')
            if not rp:
                if re.search(r'radialinis pulsas (silpnas|susilpnėj|silpnėja)', txt, re.I): rp = 'silpnas'
                elif re.search(r'radialinis pulsas (nečiuopiamas|neapčiuopiamas)|radialinio pulso nėra', txt, re.I): rp = 'nečiuopiamas'
            mt = TBP.search(txt)
            has_hr, has_bp, has_rr = 'ŠSD' in gp, 'AKS' in gp and '/' in gp['AKS'], 'KD' in gp
            if has_hr: v['hr'] = int(num(gp['ŠSD'])); anyv = True; ex.add('hr')
            if has_bp:
                a, b = gp['AKS'].split('/'); v['sys'] = int(num(a)); v['dia'] = int(num(b)); anyv = True; ex |= {'sys', 'dia'}
            elif mt and 60 <= int(mt.group(1)) <= 220:
                v['sys'] = int(mt.group(1)); v['dia'] = int(mt.group(2)) if mt.group(2) else round(v['sys'] * 0.66); anyv = True; ex |= {'sys', 'dia'}
                if v['sys'] < 90: v['hr'] = max(v['hr'], 118); ex.add('hr')
            elif rp == 'silpnas': v['sys'], v['dia'] = 84, 58; v['hr'] = max(v['hr'], 118); ex |= {'sys', 'dia', 'hr'}
            elif rp == 'nečiuopiamas': v['sys'], v['dia'] = 66, 40; ex |= {'sys', 'dia'}
            elif rp == 'stiprus' and 'sys' in ex and v['sys'] < 95: v['sys'], v['dia'] = 112, 72
            if 'SpO₂' in gp: v['spo2'] = int(num(gp['SpO₂'])); anyv = True; ex.add('spo2')
            if has_rr: v['rr'] = int(num(gp['KD'])); anyv = True; ex.add('rr')
            if 'T' in gp: v['temp'] = round(num(gp['T']), 1); anyv = True; ex.add('temp')
            # širdies sustojimas
            if has_hr or has_bp or ROSC.search(txt): arrest = False
            if ARREST.search(txt) or (gp.get('AVPU') == 'U' and rp == 'nečiuopiamas' and not has_bp): arrest = True
            if arrest:
                anyv = True
                v['r'] = 'asys' if re.search(r'asistolij', txt, re.I) else 'pea'
                v['sys'], v['dia'] = 0, 0
                if not has_rr: v['rr'] = 4 if re.search(r'agonišk|agonal', txt, re.I) else 0
                if not has_hr: v['hr'] = 0 if v['r'] == 'asys' else min(v['hr'], 60) if v['hr'] else 50
                ex -= {'sys', 'dia'}
            else:
                if prev.get('r') in ('pea', 'asys'): v['r'] = 'sinus'
                if v['hr'] >= 120 and v['sys'] < 90 and 'rr' not in ex and v['rr'] < 26: v['rr'] = 26
                if 'sys' not in ex and v['hr'] >= 120: v['sys'], v['dia'] = 108, 84
                if 'sys' not in ex and v['hr'] < 60 and v['spo2'] < 85: v['sys'], v['dia'] = 86, 50
            extra = ', '.join(f'{kk} {vv}' for kk, vv in gp.items() if kk in ('AVPU', 'GKS', 'Skausmas', 'Radialinis pulsas'))
            st.append({'n': f'{k} klausimas', 'v': v, 'p': txt + (f' ({extra})' if extra else ''), 'k': q.get('klaus', '')})
            prev = v
        if anyv:
            if st and 'r' not in st[0]['v']: st[0]['v']['r'] = 'sinus'
            out.append({'id': sc['id'], 'src': src, 'pav': sc['pav'], 'tema': sc.get('tema', ''), 'lygis': sc.get('lygis', ''), 'st': st})
js = ('// Sugeneruota tools/build_import.py iš ETC ir March gidų scenarijų – nekeisti ranka.\n'
      'window.SIMX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'scen-import.js'), 'w', encoding='utf-8').write(js)
print(len(out), 'scenarijų,', len(js), 'B')
