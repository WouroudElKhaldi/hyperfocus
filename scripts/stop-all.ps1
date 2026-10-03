# Stops Hyperfocus (API + website). n8n is only stopped if you add -IncludeN8n.
# Only programs started from this project's folder are stopped: another project on the same port (5173 is common) is left alone.
param([switch]$IncludeN8n)
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path.TrimEnd("\")
$roots = @($root.ToLower(), $root.Replace("\", "/").ToLower())
$ports = @(4000, 5173)
if ($IncludeN8n) { $ports += 5678 }

# Is this process, or one of the programs that started it (pnpm, turbo, vite...), running from this project's folder?
function Test-Ours([int]$procId) {
  for ($i = 0; $i -lt 8 -and $procId; $i++) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    if (-not $p) { return $false }
    $text = "$($p.CommandLine) $($p.ExecutablePath)".ToLower()
    foreach ($r in $roots) { if ($text.Contains($r)) { return $true } }
    $procId = $p.ParentProcessId
  }
  return $false
}

foreach ($port in $ports) {
  $pids = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    if ($port -eq 5678 -or (Test-Ours $procId)) {
      & taskkill.exe /PID $procId /T /F | Out-Null
      Write-Output "Stopped the program on port $port"
    } else {
      Write-Output "Port $port is used by another program (not Hyperfocus): left running"
    }
  }
}

# Also clear leftover "waiting for changes" watcher processes of this project, which can get in the way of the next start.
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'node\s+--watch\s+src/index\.(js|ts)' -and $_.CommandLine -notmatch 'n8n' -and (Test-Ours $_.ProcessId) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
