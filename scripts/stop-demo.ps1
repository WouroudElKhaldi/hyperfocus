# Stops the demo copy (port 4800 by default). Your real app is not touched.
param([int]$Port = 4800)
foreach ($p in (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  Write-Output "Stopped the demo on port $Port"
}
