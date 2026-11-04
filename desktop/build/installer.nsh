; Extra installer steps (electron-builder includes this file: package.json → build.nsis.include).
;
; Before the old version is removed, nothing may still have a file in the install folder open, or
; Windows refuses and the update stops with "Failed to uninstall old application files". The
; installer already closes RolePort itself; this also closes RolePort's JobSpy program (it runs from
; the user's data folder, so the installer doesn't know it) and gives everything a moment to exit.
!macro customInit
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -like 'jobspy-server-*' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0
  Sleep 1500
!macroend
