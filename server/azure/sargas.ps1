# SIM Pulse išlaidų sargas (Azure Automation runbook, PowerShell). Diegia apsauga.sh – rankiniu būdu keisti nereikia.
# Kas valandą: pagal Container Apps metriką „Replicas“ apskaičiuoja šio mėnesio sąmatą (aktyvus laikas × kaina + registras).
#   ≥ 50 % ir ≥ 80 % ribos – pažymi Automation paskyroje (žyma) → Activity log įspėjimas → el. laiškas.
#   ≥ riba – sustabdo Container App (POST …/stop) → el. laiškas. Kito mėnesio pirmą valandą – paleidžia vėl.
# Sąmata sąmoningai didesnė už tikrą sąskaitą: skaičiuojama kiekviena valanda, kurioje serveris bent trumpai veikė, nemokama kvota neatimama.
param([string]$Veiksmas = 'tikrinti')   # tikrinti | stabdyti | paleisti
$ErrorActionPreference = 'Stop'
$Sub = '__SUB__'; $Rg = '__RG__'; $App = '__APP__'; $Acct = '__ACCT__'; $Limitas = [double]'__LIMIT__'
$appId = "/subscriptions/$Sub/resourceGroups/$Rg/providers/Microsoft.App/containerApps/$App"
$acctId = "/subscriptions/$Sub/resourceGroups/$Rg/providers/Microsoft.Automation/automationAccounts/$Acct"
$api = '2024-03-01'

Connect-AzAccount -Identity | Out-Null
Set-AzContext -Subscription $Sub | Out-Null

function Arm([string]$Metodas, [string]$Kelias, $Kunas) {
  if ($Kunas) { $r = Invoke-AzRestMethod -Method $Metodas -Path $Kelias -Payload ($Kunas | ConvertTo-Json -Depth 10) }
  else { $r = Invoke-AzRestMethod -Method $Metodas -Path $Kelias }
  if ($r.StatusCode -ge 400) { throw "$Metodas $Kelias -> $($r.StatusCode): $($r.Content)" }
  if ($r.Content) { return ($r.Content | ConvertFrom-Json) }
}
function Zymos { $a = Arm 'GET' "$($acctId)?api-version=2023-11-01"; $t = @{}; if ($a.tags) { $a.tags.PSObject.Properties | ForEach-Object { $t[$_.Name] = [string]$_.Value } }; return $t }
function RasytiZymas($t) { Arm 'PATCH' "$($acctId)?api-version=2023-11-01" @{ tags = $t } | Out-Null }
function Stabdyti { Arm 'POST' "$($appId)/stop?api-version=$api" | Out-Null }
function Paleisti { Arm 'POST' "$($appId)/start?api-version=$api" | Out-Null }

$IC = [Globalization.CultureInfo]::InvariantCulture
$now = (Get-Date).ToUniversalTime()
$men = $now.ToString('yyyy-MM', $IC)
$t = Zymos

if ($Veiksmas -eq 'stabdyti') { Stabdyti; $t['simSustabdyta'] = $men; RasytiZymas $t; Write-Output "Sustabdyta rankiniu būdu ($men)."; return }
if ($Veiksmas -eq 'paleisti') { Paleisti; $t.Remove('simSustabdyta'); $t['simLeista'] = $men; RasytiZymas $t; Write-Output "Paleista rankiniu būdu – šį mėnesį sargas daugiau nestabdys ($men)."; return }

# naujas mėnuo – sargo sustabdytą serverį paleisti
if ($t.ContainsKey('simSustabdyta') -and $t['simSustabdyta'] -ne $men) {
  Paleisti; $t.Remove('simSustabdyta'); $t.Remove('simIspejimas'); RasytiZymas $t
  Write-Output "Naujas mėnuo ($men) – serveris paleistas."
}

# programos dydis (vCPU, GiB)
$a = Arm 'GET' "$($appId)?api-version=$api"
$res = $a.properties.template.containers[0].resources
$cpu = [double]$res.cpu
$mem = [double](([string]$res.memory) -replace '[^0-9.]', '')
$kainaS = $cpu * 0.000024 + $mem * 0.000003      # Container Apps aktyvus režimas, USD / s

# šio mėnesio aktyvios valandos (metrika „Replicas“, maksimumas per valandą)
$pr = New-Object DateTime ($now.Year, $now.Month, 1, 0, 0, 0, [DateTimeKind]::Utc)
$ts = $pr.ToString('yyyy-MM-ddTHH:mm:ssZ', $IC) + '/' + $now.ToString('yyyy-MM-ddTHH:mm:ssZ', $IC)
$m = Arm 'GET' "$($appId)/providers/Microsoft.Insights/metrics?api-version=2023-10-01&metricnames=Replicas&aggregation=Maximum&interval=PT1H&timespan=$ts"
$val = 0.0
if ($m.value -and $m.value[0].timeseries) { foreach ($p in $m.value[0].timeseries[0].data) { if ($p.maximum -ge 1) { $val += [double]$p.maximum } } }
$registras = 0.1667 * $now.Day                    # Basic registras ~5 USD / mėn.
$samata = [math]::Round($val * 3600 * $kainaS + $registras, 2)
$proc = [math]::Round(100 * $samata / $Limitas)
Write-Output ("Mėnuo {0}: aktyvu ~{1} val. ({2} vCPU / {3} GiB), sąmata ~{4} USD iš {5} USD ({6} %)." -f $men, $val, $cpu, $mem, $samata, $Limitas, $proc)

$leista = $t.ContainsKey('simLeista') -and $t['simLeista'] -eq $men
if ($samata -ge ($Limitas - 1) -and -not $leista) {
  if (-not ($t.ContainsKey('simSustabdyta') -and $t['simSustabdyta'] -eq $men)) {
    Stabdyti; $t['simSustabdyta'] = $men; $t['simIspejimas'] = "$($men):100"; RasytiZymas $t
    Write-Output 'RIBA PASIEKTA – serveris sustabdytas iki kito mėnesio (SIM veiks telefono modeliu).'
  } else { Write-Output 'Serveris jau sustabdytas šį mėnesį.' }
  return
}
foreach ($lyg in 80, 50) {
  if ($proc -ge $lyg) {
    $buvo = 0; if ($t.ContainsKey('simIspejimas') -and $t['simIspejimas'].StartsWith($men)) { $buvo = [int]($t['simIspejimas'].Split(':')[1]) }
    if ($lyg -gt $buvo) { $t['simIspejimas'] = "$($men):$lyg"; $t['simSamata'] = $samata.ToString($IC); RasytiZymas $t; Write-Output "Įspėjimas: pasiekta $lyg % ribos." }
    break
  }
}
