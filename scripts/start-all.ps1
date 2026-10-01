# Starts n8n and Hyperfocus (API + website) in hidden windows, but only the parts that are not already running.
# Safe to run as many times as you like. Logs go to the "logs" folder.
#   -Open     open the website in your browser once it is ready
#   -DryRun   only print what would be started
param(
  [switch]$Open,
  [switch]$DryRun,
  [int]$ApiPort = 4000,
  [int]$WebPort = 5173,
  [int]$N8nPort = 5678
)

$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Test-Port([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Write-Log([string]$text) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $text
  if ($DryRun) { Write-Output $line } else { Add-Content -Path (Join-Path $logs "start.log") -Value $line }
}

# keep the log files small: when one passes 1 MB, only its last 400 lines are kept
function Trim-Logs {
  foreach ($f in Get-ChildItem -Path $logs -Filter *.log -ErrorAction SilentlyContinue) {
    if ($f.Length -gt 1MB) { try { $keep = Get-Content $f.FullName -Tail 400; Set-Content -Path $f.FullName -Value $keep } catch { } }
  }
}
Trim-Logs

function Start-Hidden([string]$name, [string]$command) {
  $log = Join-Path $logs "$name.log"
  if ($DryRun) { Write-Output "WOULD START $name : $command"; return }
  Write-Log "starting $name"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c $command >> `"$log`" 2>&1" -WorkingDirectory $root -WindowStyle Hidden
}

# n8n (posts to LinkedIn). Uses your existing n8n data, so your workflow and login are kept.
if (Test-Port $N8nPort) { Write-Log "n8n already running" }
else {
  $env:N8N_PORT = "$N8nPort"
  Start-Hidden "n8n" "npx --yes n8n"
}

# the API (saves your data, runs scheduled posts and backups)
if (Test-Port $ApiPort) { Write-Log "API already running" }
else { Start-Hidden "api" "cd /d `"$root\apps\api`" && node --watch src/index.js" } # node directly: more reliable than going through npm

# the website
if (Test-Port $WebPort) { Write-Log "website already running" }
else { Start-Hidden "web" "cd /d `"$root\apps\web`" && node node_modules\vite\bin\vite.js" } # node directly: more reliable than going through npm

if ($Open -and -not $DryRun) {
  # wait up to 90 seconds for the website, then open it
  for ($i = 0; $i -lt 90; $i++) {
    if ((Test-Port $WebPort) -and (Test-Port $ApiPort)) { break }
    Start-Sleep -Seconds 1
  }
  Start-Process "http://localhost:$WebPort"
}
