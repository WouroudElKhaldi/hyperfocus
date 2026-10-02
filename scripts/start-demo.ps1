# Starts a DEMO copy of Hyperfocus on its own port, with its own sample database. Safe to share:
# no AI, no LinkedIn, no backups, no notifications, and none of your secrets or real data.
# Every start resets the demo to fresh sample data. Stop it with stop-demo.ps1.
param([int]$Port = 4800, [switch]$SkipBuild)

$root = Split-Path -Parent $PSScriptRoot
$demo = Join-Path $root "demo"
New-Item -ItemType Directory -Force -Path $demo | Out-Null

# stop an older demo
foreach ($p in (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

if (-not $SkipBuild) {
  Write-Output "Building the website..."
  Push-Location (Join-Path $root "apps\web"); & npm run build 2>&1 | Select-Object -Last 3; Pop-Location
}
if (-not (Test-Path (Join-Path $root "apps\web\dist\index.html"))) { Write-Error "The website build is missing."; exit 1 }

# a fresh database every time
foreach ($f in "demo.db", "demo.db-journal", "settings.json") { Remove-Item (Join-Path $demo $f) -Force -ErrorAction SilentlyContinue }
$env:DATABASE_URL = "file:" + ($demo -replace "\\", "/") + "/demo.db"
$env:DEMO_MODE = "1"
$env:PORT = "$Port"
$env:SETTINGS_FILE = Join-Path $demo "settings.json"
$env:NOTIFY_DRY_RUN = "1"
$env:DEEPSEEK_API_KEY = ""
$env:N8N_WEBHOOK_URL = ""

Push-Location (Join-Path $root "packages\db")
& npx prisma db push --skip-generate 2>&1 | Select-Object -Last 1
Pop-Location

Start-Process -FilePath "cmd.exe" -ArgumentList "/c node src/index.ts >> `"$demo\demo.log`" 2>&1" -WorkingDirectory (Join-Path $root "apps\api") -WindowStyle Hidden
$up = $false
for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Seconds 1; try { if ((Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5).Content -match '"demo":true') { $up = $true; break } } catch {} }
if (-not $up) { Write-Error "The demo did not start. See demo\demo.log"; exit 1 }

& node (Join-Path $PSScriptRoot "demo-seed.mjs") $Port
Write-Output "Demo running at http://localhost:$Port"
