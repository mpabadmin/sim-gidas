#!/usr/bin/env bash
# SIM Pulse serverio apsauga: numatytasis (viešas) žetonas ir mėnesio išlaidų riba (numatyta 100 USD).
# Paleisti Azure Cloud Shell (Bash):
#   rm -rf sim-gidas && git clone -q https://github.com/mpabadmin/sim-gidas && bash sim-gidas/server/azure/apsauga.sh jusu@pastas.lt
# Vėliau:
#   bash sim-gidas/server/azure/apsauga.sh tikrinti   – šio mėnesio sąmata dabar
#   bash sim-gidas/server/azure/apsauga.sh paleisti   – paleisti sargo sustabdytą serverį (šį mėnesį sargas nebestabdys)
#   bash sim-gidas/server/azure/apsauga.sh stabdyti   – sustabdyti serverį dabar
# Nustatymai (nebūtina): LIMIT=100 RG=sim-pulse-rg APP=sim-pulse bash apsauga.sh jusu@pastas.lt
#
# Kas sukuriama (sąnaudos – beveik nulinės, telpa į nemokamas kvotas):
#   1) Serveriui nustatomas numatytasis žetonas (zetonas.py; SIM programėlėje įrašytas užmaskuotas – nieko vesti nereikia).
#   2) Automation paskyra „sim-pulse-sargas“ su runbook „SimPulseSargas“ (sargas.ps1), kuris kas valandą skaičiuoja
#      mėnesio sąmatą pagal serverio veikimo laiką ir, pasiekus ribą, serverį SUSTABDO iki kito mėnesio
#      (SIM tada veikia telefono modeliu). Kito mėnesio pradžioje serveris paleidžiamas automatiškai.
#   3) El. laiškai: 50 % ir 80 % ribos, sustabdymas (Activity log įspėjimai → veiksmų grupė).
#   4) Azure biudžetas su laiškais pagal tikrą sąskaitą – jei prenumerata tai palaiko (Sponsorship dažnai nepalaiko).
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
RG=${RG:-sim-pulse-rg}; APP=${APP:-sim-pulse}; ACCT=${ACCT:-sim-pulse-sargas}; LIMIT=${LIMIT:-100}
RB=SimPulseSargas; AAPI=2023-11-01; ARM=https://management.azure.com
say() { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
bad() { printf '\033[1;31m✕ %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
SUB=$(az account show --query id -o tsv) || { bad "Neprisijungta prie Azure (az login)"; exit 1; }
APPID="/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.App/containerApps/$APP"
ACCTID="/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Automation/automationAccounts/$ACCT"
uuid() { cat /proc/sys/kernel/random/uuid; }
J() { python3 -c "import json,sys; print(json.dumps($1))"; }   # JSON iš Python išraiškos

# runbook paleidimas ir rezultatas: $1 – tikrinti | stabdyti | paleisti
run_job() {
  local jid st i
  jid=$(uuid)
  if ! az rest --method put --url "$ARM$ACCTID/jobs/$jid?api-version=$AAPI" \
       --body "{\"properties\":{\"runbook\":{\"name\":\"$RB\"},\"parameters\":{\"Veiksmas\":\"$1\"}}}" -o none; then
    bad "Nepavyko paleisti sargo (ar paleistas apsauga.sh su el. pašto adresu?)"; return 1
  fi
  for i in $(seq 1 60); do
    st=$(az rest --method get --url "$ARM$ACCTID/jobs/$jid?api-version=$AAPI" --query properties.status -o tsv 2>/dev/null)
    case "$st" in Completed|Failed|Stopped|Suspended) break;; esac; sleep 5
  done
  az rest --method get --url "$ARM$ACCTID/jobs/$jid/output?api-version=$AAPI" 2>/dev/null | python3 -c '
import sys
s = sys.stdin.read()
try: s = s.encode("latin-1").decode("utf-8")   # az rest rodo UTF-8 kaip Latin-1 – atstatoma
except Exception: pass
print("\n".join("   " + x for x in s.strip().splitlines() if x.strip()))'
  if [ "$st" != "Completed" ]; then
    bad "Sargo būsena: $st"
    az rest --method get --url "$ARM$ACCTID/jobs/$jid?api-version=$AAPI" --query properties.exception -o tsv 2>/dev/null | sed 's/^/   /'
    return 1
  fi
  return 0
}

case "${1:-}" in
  tikrinti|stabdyti|paleisti) say "Sargas: $1"; run_job "$1"; exit $?;;
  *@*) EMAIL=$1;;
  *) echo "Naudojimas: bash apsauga.sh jusu@pastas.lt  |  tikrinti  |  paleisti  |  stabdyti"; exit 1;;
esac

az resource show --ids "$APPID" -o none 2>/dev/null || { bad "Programos $APP grupėje $RG nėra – pirmiausia paleiskite diegti.sh"; exit 1; }
LOC=$(az resource show --ids "$APPID" --query location -o tsv | tr 'A-Z' 'a-z' | tr -d ' ')

say "1/6 Numatytasis žetonas (įrašytas SIM programėlėje)"
TOKEN=$(python3 "$DIR/zetonas.py")
az extension add --name containerapp --upgrade -y --only-show-errors >/dev/null 2>&1
if az containerapp secret set -n "$APP" -g "$RG" --secrets "simtoken=$TOKEN" -o none --only-show-errors &&
   az containerapp update -n "$APP" -g "$RG" --set-env-vars "SIM_TOKEN=secretref:simtoken" "SIM_TOKEN_V=$(date +%Y%m%d%H%M)" -o none --only-show-errors; then
  ok "Žetonas nustatytas – SIM jungiasi be papildomų nustatymų"
else bad "Žetono nustatyti nepavyko (tęsiama)"; fi

say "2/6 Paslaugų registracija"
for p in Microsoft.Automation Microsoft.Insights Microsoft.Consumption; do az provider register -n "$p" --wait --only-show-errors 2>/dev/null || true; done

say "3/6 Automation paskyra $ACCT (sargas)"
PRINC=""; ALOC=""
for r in "$LOC" swedencentral northeurope westeurope germanywestcentral; do
  OUT=$(az rest --method put --url "$ARM$ACCTID?api-version=$AAPI" \
        --body "$(J "{'location':'$r','identity':{'type':'SystemAssigned'},'properties':{'sku':{'name':'Basic'},'publicNetworkAccess':True}}")" 2>&1) && {
    PRINC=$(az rest --method get --url "$ARM$ACCTID?api-version=$AAPI" --query identity.principalId -o tsv); ALOC=$r; ok "Paskyra ($r)"; break; }
  echo "   ✕ $r: $(echo "$OUT" | head -c 200)"
done
[ -z "$PRINC" ] && { bad "Automation paskyros sukurti nepavyko"; exit 1; }
for i in 1 2 3 4 5 6; do
  if OUT=$(az role assignment create --assignee-object-id "$PRINC" --assignee-principal-type ServicePrincipal --role Contributor \
           --scope "/subscriptions/$SUB/resourceGroups/$RG" -o none --only-show-errors 2>&1); then ok "Teisės: Contributor grupei $RG"; break; fi
  if echo "$OUT" | grep -qi 'exists'; then ok "Teisės jau suteiktos"; break; fi
  if echo "$OUT" | grep -qi 'AuthorizationFailed\|does not have authorization'; then bad "Neturite teisės suteikti rolių (reikia Owner). Paprašykite prenumeratos savininko: Contributor → $ACCT grupei $RG"; break; fi
  sleep 15
done

say "4/6 Runbook $RB (kas valandą)"
TMP=$(mktemp --suffix=.ps1)
sed -e "s|__SUB__|$SUB|" -e "s|__RG__|$RG|" -e "s|__APP__|$APP|" -e "s|__ACCT__|$ACCT|" -e "s|__LIMIT__|$LIMIT|" "$DIR/sargas.ps1" > "$TMP"
RBT=""
for t in PowerShell72 PowerShell; do
  if az rest --method put --url "$ARM$ACCTID/runbooks/$RB?api-version=$AAPI" \
     --body "$(J "{'location':'$ALOC','properties':{'runbookType':'$t','logProgress':False,'logVerbose':False,'description':'SIM Pulse išlaidų sargas: riba $LIMIT USD per mėnesį'}}")" -o none 2>/dev/null; then RBT=$t; break; fi
done
[ -z "$RBT" ] && { bad "Runbook sukurti nepavyko"; exit 1; }
az rest --method put --url "$ARM$ACCTID/runbooks/$RB/draft/content?api-version=$AAPI" --headers "Content-Type=text/powershell" --body @"$TMP" -o none &&
az rest --method post --url "$ARM$ACCTID/runbooks/$RB/publish?api-version=$AAPI" -o none || { bad "Runbook įkelti nepavyko"; exit 1; }
for i in $(seq 1 24); do
  [ "$(az rest --method get --url "$ARM$ACCTID/runbooks/$RB?api-version=$AAPI" --query properties.state -o tsv 2>/dev/null)" = "Published" ] && break; sleep 5
done
ok "Runbook ($RBT) paskelbtas"
rm -f "$TMP"
START=$(date -u -d '+10 min' +%Y-%m-%dT%H:%M:00Z)
az rest --method put --url "$ARM$ACCTID/schedules/sim-kas-valanda?api-version=$AAPI" \
  --body "$(J "{'properties':{'description':'SIM Pulse sargas','startTime':'$START','frequency':'Hour','interval':1,'timeZone':'UTC'}}")" -o none
for js in $(az rest --method get --url "$ARM$ACCTID/jobSchedules?api-version=$AAPI" --query "value[?properties.runbook.name=='$RB'].properties.jobScheduleId" -o tsv 2>/dev/null); do
  az rest --method delete --url "$ARM$ACCTID/jobSchedules/$js?api-version=$AAPI" -o none 2>/dev/null
done
az rest --method put --url "$ARM$ACCTID/jobSchedules/$(uuid)?api-version=$AAPI" \
  --body "{\"properties\":{\"schedule\":{\"name\":\"sim-kas-valanda\"},\"runbook\":{\"name\":\"$RB\"},\"parameters\":{\"Veiksmas\":\"tikrinti\"}}}" -o none &&
  ok "Tvarkaraštis: kas valandą nuo $START" || bad "Tvarkaraščio sukurti nepavyko"

say "5/6 El. laiškai: $EMAIL"
AGID="/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Insights/actionGroups/sim-pulse-pranesimai"
az rest --method put --url "$ARM$AGID?api-version=2023-01-01" \
  --body "$(J "{'location':'Global','properties':{'groupShortName':'simpulse','enabled':True,'emailReceivers':[{'name':'vadovas','emailAddress':'$EMAIL','useCommonAlertSchema':True}]}}")" -o none &&
  ok "Veiksmų grupė sim-pulse-pranesimai" || bad "Veiksmų grupės sukurti nepavyko"
alert() {  # $1 pavadinimas, $2 operacija, $3 aprašymas
  az rest --method put --url "$ARM/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Insights/activityLogAlerts/$1?api-version=2020-10-01" \
    --body "$(J "{'location':'Global','properties':{'scopes':['/subscriptions/$SUB/resourceGroups/$RG'],'condition':{'allOf':[{'field':'category','equals':'Administrative'},{'field':'operationName','equals':'$2'},{'field':'status','equals':'Succeeded'}]},'actions':{'actionGroups':[{'actionGroupId':'$AGID'}]},'enabled':True,'description':'$3'}}")" -o none &&
    ok "Įspėjimas $1" || bad "Įspėjimo $1 sukurti nepavyko"
}
alert sim-pulse-sustabdytas "Microsoft.App/containerApps/stop/action" "SIM Pulse serveris sustabdytas – pasiekta mėnesio išlaidų riba ($LIMIT USD). SIM veikia telefono modeliu. Paleisti: bash sim-gidas/server/azure/apsauga.sh paleisti"
alert sim-pulse-ispejimas "Microsoft.Automation/automationAccounts/write" "SIM Pulse išlaidų sargas: pasiekta 50 % arba 80 % mėnesio ribos ($LIMIT USD), arba prasidėjo naujas mėnuo. Sąmata: bash sim-gidas/server/azure/apsauga.sh tikrinti"

say "6/6 Azure biudžetas pagal tikrą sąskaitą (jei prenumerata palaiko)"
M1=$(date -u +%Y-%m-01T00:00:00Z)
N() { echo "'$1':{'enabled':True,'operator':'GreaterThanOrEqualTo','threshold':$2,'thresholdType':'$3','contactEmails':['$EMAIL'],'locale':'en-us'}"; }
if OUT=$(az rest --method put --url "$ARM/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.Consumption/budgets/sim-pulse-biudzetas?api-version=2023-05-01" \
   --body "$(J "{'properties':{'category':'Cost','amount':$LIMIT,'timeGrain':'Monthly','timePeriod':{'startDate':'$M1'},'notifications':{$(N Actual_50 50 Actual),$(N Actual_80 80 Actual),$(N Actual_100 100 Actual),$(N Forecast_100 100 Forecasted)}}}")" -o none 2>&1); then
  ok "Biudžetas $LIMIT USD/mėn. (laiškai 50 %, 80 %, 100 % ir prognozė 100 %)"
else
  echo "   Biudžetas nepalaikomas šiai prenumeratai (pvz., Sponsorship) – ribą saugo sargas."
  echo "   $(echo "$OUT" | head -c 200)"
fi

say "Bandomasis sargo paleidimas (teisės įsigalioja per 1–3 min.)"
for i in 1 2 3 4; do run_job tikrinti && break; echo "   kartojama po 60 s…"; sleep 60; done
cat <<TXT

════════════════════════════════════════════════════════════════════
 Apsauga įjungta. Riba: $LIMIT USD per mėnesį.
 • Kas valandą skaičiuojama sąmata; 50 % ir 80 % – laiškas, riba – serveris sustabdomas
   iki kito mėnesio (SIM tęsia telefono modeliu) ir atsiunčiamas laiškas.
 • Laiškai ateis iš Microsoft Azure (azure-noreply@microsoft.com) adresu $EMAIL –
   pirmas bandomasis gali ateiti jau dabar.
 Sąmata:   bash sim-gidas/server/azure/apsauga.sh tikrinti
 Paleisti: bash sim-gidas/server/azure/apsauga.sh paleisti
 Pakeisti ribą: LIMIT=150 bash sim-gidas/server/azure/apsauga.sh $EMAIL
════════════════════════════════════════════════════════════════════
TXT
