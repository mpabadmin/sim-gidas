#!/usr/bin/env bash
# SIM Pulse serverio diegimas į Azure Container Apps. Paleisti Azure Cloud Shell (Bash) – nieko diegti kompiuteryje nereikia:
#   git clone https://github.com/mpabadmin/sim-gidas && bash sim-gidas/server/azure/diegti.sh
# Pakartotinis paleidimas atnaujina serverį (nauja versija) ir išsaugo tą patį adresą bei žetoną.
# Nustatymai (nebūtina): LOC=swedencentral CPU=1 MEM=2Gi MIN=0 DOCKERFILE=Dockerfile bash diegti.sh
set -euo pipefail
cd "$(dirname "$0")/.."            # server/
CFG="$HOME/.sim-pulse.env"
LOC_ARG=${LOC:-}
[ -f "$CFG" ] && . "$CFG"
# Cloud Shell be saugyklos nieko neišsaugo – atkuriame nustatymus iš jau sukurtų Azure išteklių
if [ ! -f "$CFG" ] && az group show -n "${RG:-sim-pulse-rg}" -o none 2>/dev/null; then
  ACR=${ACR:-$(az acr list -g "${RG:-sim-pulse-rg}" --query '[0].name' -o tsv 2>/dev/null || true)}
  TOKEN=${TOKEN:-$(az containerapp secret show -n "${APP:-sim-pulse}" -g "${RG:-sim-pulse-rg}" --secret-name simtoken --query value -o tsv 2>/dev/null || true)}
  [ -n "$ACR" ] && echo "Rastas ankstesnis registras: $ACR"
  [ -n "$TOKEN" ] && echo "Rastas ankstesnis žetonas (adresas ir žetonas nesikeis)"
fi
[ -z "${ACR:-}" ] && unset ACR
[ -z "${TOKEN:-}" ] && unset TOKEN
[ -n "$LOC_ARG" ] && LOC=$LOC_ARG          # komandinėje eilutėje nurodytas regionas svarbiau už išsaugotą
RG=${RG:-sim-pulse-rg}
LOC=${LOC:-swedencentral}
# regionai, bandomi iš eilės, jei pasirinktas nepriima naujų išteklių (dažna rėmimo / ne pelno prenumeratose)
REGIONS="$LOC swedencentral northeurope germanywestcentral polandcentral francecentral uksouth westeurope norwayeast"
APP=${APP:-sim-pulse}
ENVN=${ENVN:-sim-pulse-env}
ACR=${ACR:-simpulse$(openssl rand -hex 3)}
TOKEN=${TOKEN:-$(openssl rand -hex 16)}
CPU=${CPU:-1}
MEM=${MEM:-2Gi}
MIN=${MIN:-0}
DOCKERFILE=${DOCKERFILE:-Dockerfile}
printf 'RG=%s\nLOC=%s\nAPP=%s\nENVN=%s\nACR=%s\nTOKEN=%s\n' "$RG" "$LOC" "$APP" "$ENVN" "$ACR" "$TOKEN" > "$CFG"

say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
say "1/6 Azure plėtiniai ir paslaugų registracija (pirmą kartą – kelios minutės)"
az extension add --name containerapp --upgrade -y --only-show-errors >/dev/null
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry; do az provider register -n "$p" --wait --only-show-errors; done

say "2/6 Išteklių grupė $RG"
az group show -n "$RG" -o none 2>/dev/null || az group create -n "$RG" -l "$LOC" --only-show-errors -o none

# bando sukurti išteklių kiekviename regione, kol pavyksta; $1 – pavadinimas, toliau – komanda be -l
try_regions() {
  local what=$1; shift
  for r in $REGIONS; do
    echo "   bandomas regionas: $r"
    if OUT=$("$@" -l "$r" --only-show-errors -o none 2>&1); then LOC=$r; echo "   ✓ $r"; return 0; fi
    if echo "$OUT" | grep -qiE 'RequestDisallowedByAzure|not accepting|LocationNotAvailable|NoRegisteredProviderFound|not available|RequestDisallowedByPolicy|SkuNotAvailable|LocationIsOfferRestricted'; then
      echo "   ✕ $r nepriima ($what)"; continue
    fi
    echo "$OUT"; return 1
  done
  echo "Nė vienas regionas nepriėmė: $what. Patikrinkite prenumeratos apribojimus (https://aka.ms/locationineligible)."; return 1
}

say "3/6 Konteinerių registras $ACR"
if ! az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null; then
  try_regions "konteinerių registras" az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true
fi

say "4/6 Statomas atvaizdas Azure debesyje ($DOCKERFILE) – 5–15 min. (Pulse atvaizdas ~1,3 GB)"
TAG="v$(date +%Y%m%d%H%M)"
az acr build -r "$ACR" -t "sim-pulse:$TAG" -t sim-pulse:latest -f "$DOCKERFILE" --timeout 10800 .
IMG="$ACR.azurecr.io/sim-pulse:$TAG"
USR=$(az acr credential show -n "$ACR" --query username -o tsv)
PWD_ACR=$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)

say "5/6 Container Apps aplinka ir programa $APP"
if ! az containerapp env show -n "$ENVN" -g "$RG" -o none 2>/dev/null; then
  try_regions "Container Apps aplinka" az containerapp env create -n "$ENVN" -g "$RG"
fi
if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp secret set -n "$APP" -g "$RG" --secrets "simtoken=$TOKEN" -o none
  az containerapp update -n "$APP" -g "$RG" --image "$IMG" --cpu "$CPU" --memory "$MEM" --min-replicas "$MIN" --max-replicas 1 \
     --set-env-vars "SIM_TOKEN=secretref:simtoken" "MAX_SESSIONS=3" -o none
else
  az containerapp create -n "$APP" -g "$RG" --environment "$ENVN" --image "$IMG" \
     --registry-server "$ACR.azurecr.io" --registry-username "$USR" --registry-password "$PWD_ACR" \
     --target-port 8080 --ingress external --transport auto --cpu "$CPU" --memory "$MEM" \
     --min-replicas "$MIN" --max-replicas 1 --secrets "simtoken=$TOKEN" --env-vars "SIM_TOKEN=secretref:simtoken" "MAX_SESSIONS=3" -o none
fi
printf 'RG=%s\nLOC=%s\nAPP=%s\nENVN=%s\nACR=%s\nTOKEN=%s\n' "$RG" "$LOC" "$APP" "$ENVN" "$ACR" "$TOKEN" > "$CFG"
FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)

say "6/6 Tikrinama (pirmas paleidimas gali užtrukti 1–3 min.)"
for i in $(seq 1 40); do
  H=$(curl -s --max-time 20 "https://$FQDN/health" || true)
  if echo "$H" | grep -q '"ok"'; then break; fi; sleep 10
done
echo "Būsena: $H"
echo "Savitikra (gali užtrukti ~1–2 min.):"
curl -s --max-time 600 "https://$FQDN/selftest?token=$TOKEN" | python3 -c '
import json,sys
try:
  r=json.load(sys.stdin)
except Exception:
  print("  savitikra nepavyko"); sys.exit()
print("  Variklis:", r.get("engine"), r.get("version"), "| būsena:", r.get("state"), "| greitis ~", r.get("speed_x"), "× realaus laiko")
if r.get("load_error"): print("  ĮKĖLIMO KLAIDA:", r["load_error"])
if r.get("error"): print("  Pastaba:", r["error"])
print("  Pradiniai rodikliai:", r.get("baseline"))
for k,v in (r.get("actions") or {}).items(): print("  ", "✓" if v.get("ok") else "✗", k, v.get("msg","")[:120])
'
LINK="https://sim.1040medkuopa.lt/#/nustatymai?pulse=wss://$FQDN/ws&pt=$TOKEN"
cat <<TXT

════════════════════════════════════════════════════════════════════
 Pulse serveris paruoštas
 Adresas:   wss://$FQDN/ws
 Žetonas:   $TOKEN
 SIM nustatymams atidarykite telefone (monitoriaus telefone) šią nuorodą:
   $LINK
 Kaina: kai niekas nesijungia, serveris išsijungia pats (MIN=$MIN); mokama tik už veikimo laiką
 ir registrą (~5 €/mėn.). Visiškai pašalinti:  az group delete -n $RG --yes
 Nustatymai išsaugoti: $CFG (pakartotinis paleidimas atnaujina tą patį serverį)
════════════════════════════════════════════════════════════════════
TXT
