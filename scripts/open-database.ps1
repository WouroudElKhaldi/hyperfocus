# Opens your database in Prisma Studio, a friendly table viewer in the browser (http://localhost:5555).
# You can look at every table (tasks, notes, posts, study sessions, pet points...), search, and edit rows.
#   -NoOpen   start it but don't open the browser
#   -Stop     close it
# Tips: your real data file is apps\api\prisma\dev.db. The app can stay open while you look, but be careful editing:
# a change here is a real change. Copies of the file are in the "backups" folder.
param([switch]$NoOpen, [switch]$Stop, [int]$Port = 5555)

$root = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root "apps\api"

function Stop-Studio {
  foreach ($p in (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    Write-Output "Closed Prisma Studio."
  }
}
if ($Stop) { Stop-Studio; exit 0 }

if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$server`" && node node_modules\prisma\build\index.js studio --port $Port --browser none > `"$root\logs\studio.log`" 2>&1" -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { break }
  }
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) { Write-Error "Prisma Studio did not start. See logs\studio.log"; exit 1 }

$url = "http://localhost:$Port"
Write-Output "Your database is open at $url"
Write-Output "Database file: $server\prisma\dev.db"
Write-Output "To close it again: scripts\open-database.ps1 -Stop"
if (-not $NoOpen) { Start-Process $url }
