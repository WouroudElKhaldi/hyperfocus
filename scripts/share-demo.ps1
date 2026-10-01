# Shares the DEMO (port 4800, sample data, no AI/LinkedIn/backups) through a temporary Cloudflare link.
# Your real app (ports 4000/5173) is never exposed. Close this window or run stop-share.ps1 to stop sharing.
param([int]$Port = 4800)
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "tools\cloudflared.exe"
$log = Join-Path $root "demo\tunnel.log"
New-Item -ItemType Directory -Force -Path (Join-Path $root "demo") | Out-Null

try { $h = (Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5).Content } catch { $h = "" }
if ($h -notmatch '"demo":true') { Write-Error "The demo is not running on port $Port. Run scripts\start-demo.ps1 first."; exit 1 }

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item $log -ErrorAction SilentlyContinue
Start-Process -FilePath $exe -ArgumentList "tunnel --no-autoupdate --url http://127.0.0.1:$Port --logfile `"$log`"" -WindowStyle Hidden
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) { $m = [regex]::Match((Get-Content $log -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { Write-Output "Share this link: $($m.Value)"; exit 0 } }
}
Write-Error "No link appeared. See demo\tunnel.log"; exit 1
