# Removes the auto-start shortcut and the Desktop shortcut created by install-autostart.ps1.
$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "Hyperfocus (auto-start).lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Hyperfocus.lnk"
foreach ($p in @($startup, $desktop)) {
  if (Test-Path $p) { Remove-Item $p -Force; Write-Output "Removed: $p" } else { Write-Output "Not found: $p" }
}

# the app used to be called "Thought Studio": clean up the old shortcuts so there are no duplicates
foreach ($old in @((Join-Path ([Environment]::GetFolderPath("Startup")) "Thought Studio (auto-start).lnk"), (Join-Path ([Environment]::GetFolderPath("Desktop")) "Thought Studio.lnk"))) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
