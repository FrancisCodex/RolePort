; Extra installer steps (electron-builder includes this file: package.json → build.nsis.include).
;
; An update first removes the old version: its uninstaller moves every file in the install folder
; into a Temp folder, and if any one can't be moved it puts everything back and the update stops with
; "Failed to uninstall old application files. Please try running the installer again.: 2".
;
; 1. Versions up to 0.1.4 saved page caches inside the install folder while running
;    (resources\server\.next\server\route-cache). Their paths come close to Windows' 260-character
;    limit, so they're too long once moved to Temp. They're only a cache: delete them first. (Newer
;    versions keep that cache in memory: next.config.ts, isrFlushToDisk.)
; 2. Nothing may still have a file open. The installer already closes RolePort itself; this also
;    closes RolePort's JobSpy program (it runs from the user's data folder, so the installer doesn't
;    know it) and gives everything a moment to exit.
!macro customInit
  RMDir /r "$INSTDIR\resources\server\.next\server\route-cache"
  RMDir /r "$INSTDIR\resources\server\.next\cache"
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -like 'jobspy-server-*' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0
  Sleep 1500
!macroend
