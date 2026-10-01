# Stops sharing: closes the tunnel. The demo itself keeps running locally (stop it with stop-demo.ps1).
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output "Sharing stopped."
