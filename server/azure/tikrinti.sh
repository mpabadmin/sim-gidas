#!/usr/bin/env bash
# SIM Pulse serverio būsenos patikra Azure Cloud Shell:
#   bash sim-gidas/server/azure/tikrinti.sh
# Parodo, kas sukurta, ar serveris veikia, savitikrą, adresą, žetoną ir SIM nustatymų nuorodą.
RG=${RG:-sim-pulse-rg}; APP=${APP:-sim-pulse}
say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
bad() { printf '\033[1;31m✕ %s\033[0m\n' "$*"; }
if ! az group show -n "$RG" -o none 2>/dev/null; then bad "Išteklių grupės $RG nėra – paleiskite diegti.sh"; exit 1; fi
say "Sukurti ištekliai ($RG)"
az resource list -g "$RG" --query '[].{Pavadinimas:name, Tipas:type, Regionas:location}' -o table
ACR=$(az acr list -g "$RG" --query '[0].name' -o tsv 2>/dev/null)
if [ -n "$ACR" ]; then
  say "Atvaizdai registre $ACR"
  az acr repository show-tags -n "$ACR" --repository sim-pulse --orderby time_desc --top 3 -o tsv 2>/dev/null || bad "Atvaizdas dar nesustatytas (žingsnis 4/6 nebaigtas)"
  az acr task list-runs -r "$ACR" --top 1 --query '[0].{Busena:status, Pradzia:startTime, Pabaiga:finishTime}' -o table 2>/dev/null
fi
FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null)
if [ -z "$FQDN" ]; then bad "Programa $APP dar nesukurta (žingsnis 5/6 nebaigtas) – paleiskite diegti.sh dar kartą"; exit 1; fi
TOKEN=$(az containerapp secret show -n "$APP" -g "$RG" --secret-name simtoken --query value -o tsv 2>/dev/null)
say "Serveris https://$FQDN (jei miegojo – pabudimas iki 1–2 min.)"
for i in $(seq 1 18); do H=$(curl -s --max-time 20 "https://$FQDN/health"); echo "$H" | grep -q '"ok"' && break; sleep 5; done
echo "Būsena: ${H:-neatsako}"
echo "Savitikra:"
curl -s --max-time 600 "https://$FQDN/selftest?token=$TOKEN" | python3 -c '
import json,sys
try: r=json.load(sys.stdin)
except Exception: print("  savitikra nepavyko"); sys.exit()
print("  Variklis:", r.get("engine"), r.get("version"), "| būsena:", r.get("state"), "| greitis ~", r.get("speed_x"), "× realaus laiko")
if r.get("load_error"): print("  ĮKĖLIMO KLAIDA:", r["load_error"])
if r.get("error"): print("  Pastaba:", r["error"])
print("  Pradiniai rodikliai:", r.get("baseline"))
for k,v in (r.get("actions") or {}).items(): print("  ", "✓" if v.get("ok") else "✕", k, v.get("msg","")[:120])
'
cat <<TXT

════════════════════════════════════════════════════════════════════
 Adresas:  wss://$FQDN/ws
 Žetonas:  $TOKEN
 SIM nustatymų nuoroda (atidaryti instruktoriaus telefone):
   https://sim.1040medkuopa.lt/#/nustatymai?pulse=wss://$FQDN/ws&pt=$TOKEN
════════════════════════════════════════════════════════════════════
TXT
