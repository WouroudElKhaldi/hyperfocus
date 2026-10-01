# Makes Hyperfocus (and n8n) start by themselves when you log in to Windows, and puts a
# "Hyperfocus" shortcut on your Desktop that starts everything (if needed) and opens the website.
# No administrator rights needed. Undo with uninstall-autostart.ps1.
$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot "start-hidden.vbs"
$wsh = New-Object -ComObject WScript.Shell

function New-Shortcut([string]$path, [string]$arguments, [string]$description) {
  $s = $wsh.CreateShortcut($path)
  $s.TargetPath = Join-Path $env:SystemRoot "System32\wscript.exe"
  $s.Arguments = $arguments
  $s.WorkingDirectory = $root
  $s.Description = $description
  $s.IconLocation = Join-Path $env:SystemRoot "System32\shell32.dll,220"
  $s.Save()
  Write-Output "Created: $path"
}

$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "Hyperfocus (auto-start).lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Hyperfocus.lnk"

New-Shortcut $startup ("`"$launcher`"") "Starts Hyperfocus and n8n in the background when you log in"
New-Shortcut $desktop ("`"$launcher`" open") "Starts Hyperfocus (if needed) and opens it"
Write-Output "Done. Next time you log in, everything starts by itself."

# the app used to be called "Thought Studio": clean up the old shortcuts so there are no duplicates
foreach ($old in @((Join-Path ([Environment]::GetFolderPath("Startup")) "Thought Studio (auto-start).lnk"), (Join-Path ([Environment]::GetFolderPath("Desktop")) "Thought Studio.lnk"), (Join-Path ([Environment]::GetFolderPath("Startup")) "Stride (auto-start).lnk"), (Join-Path ([Environment]::GetFolderPath("Desktop")) "Stride.lnk"))) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
