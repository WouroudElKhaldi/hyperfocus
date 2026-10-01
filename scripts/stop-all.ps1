# Stops Hyperfocus (API + website). n8n is only stopped if you add -IncludeN8n.
param([switch]$IncludeN8n)
$ports = @(4000, 5173)
if ($IncludeN8n) { $ports += 5678 }
foreach ($port in $ports) {
  $pids = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    & taskkill.exe /PID $procId /T /F | Out-Null
    Write-Output "Stopped the program on port $port"
  }
}

# Also clear leftover "waiting for changes" watcher processes, which can get in the way of the next start.
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'node\s+--watch\s+src/index\.js' -and $_.CommandLine -notmatch 'n8n' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
