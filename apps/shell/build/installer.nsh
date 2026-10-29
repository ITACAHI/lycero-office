# Lycero Office Desktop — Custom NSIS Hooks
# Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.

!ifndef BUILD_UNINSTALLER

!macro customInit
  # During a silent auto-update (--updated /S), wait briefly for Lycero Office.exe
  # and xlsx-sidecar.exe to exit so file extraction never collides with a closing
  # process (especially when elevated via UAC_RunElevated where installSection.nsh
  # skips CHECK_APP_RUNNING inside the inner instance).
  ${if} ${isUpdated}
  ${andIf} ${Silent}
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${if} $R0 == 0
      Sleep 1200
      nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
      Pop $R0
      ${if} $R0 == 0
        nsProcess::_KillProcess "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
        Sleep 400
      ${endIf}
    ${endIf}
    nsProcess::_FindProcess "xlsx-sidecar.exe"
    Pop $R0
    ${if} $R0 == 0
      nsProcess::_KillProcess "xlsx-sidecar.exe"
      Pop $R0
    ${endIf}
  ${endIf}
!macroend

!macro customInstall
  # Always point $launchLink directly to the application executable ($appExe)
  # instead of the Start Menu .lnk shortcut ($newStartMenuLink).
  # On Windows 10/11, StdUtils.ExecShellAsUser silently fails when passing
  # "--updated" arguments to a .lnk file in %ProgramData%.
  StrCpy $launchLink "$appExe"
!macroend

!endif
