# Lycero Office Desktop — Custom NSIS Hooks
# Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.

# In-process check/close/kill for Lycero Office and its native helpers.
# Replaces electron-builder's default PowerShell Get-CimInstance loop (which
# spawns 3 powershell.exe processes per check, adds ~40s to silent updates,
# and can flash console windows). Used by both installer and uninstaller.
!macro customCheckAppRunning
  nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
  Pop $R0
  ${if} $R0 == 0
    ${if} ${isUpdated}
      Sleep 1000
    ${else}
      ${ifNot} ${Silent}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
        Quit
      ${endIf}
    ${endIf}
    DetailPrint "$(appClosing)"
    nsProcess::_CloseProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    Sleep 400
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${if} $R0 == 0
      Sleep 800
      nsProcess::_KillProcess "${APP_EXECUTABLE_FILENAME}"
      Pop $R0
      Sleep 300
    ${endIf}
  ${endIf}

  nsProcess::_FindProcess "xlsx-sidecar.exe"
  Pop $R0
  ${if} $R0 == 0
    nsProcess::_KillProcess "xlsx-sidecar.exe"
    Pop $R0
  ${endIf}

  nsProcess::_FindProcess "win-ocr.exe"
  Pop $R0
  ${if} $R0 == 0
    nsProcess::_KillProcess "win-ocr.exe"
    Pop $R0
  ${endIf}

  nsProcess::_Unload
!macroend

!ifndef BUILD_UNINSTALLER

!macro customInit
  # 1. Sanitize stale Registry installation flags: if HKLM or HKCU points to a
  # directory where the executable no longer exists, clear that flag so a stale
  # HKLM key never hijacks a Per-User update into All-Users mode.
  ${if} $hasPerMachineInstallation == "1"
    ${ifNot} ${FileExists} "$perMachineInstallationFolder\${APP_EXECUTABLE_FILENAME}"
      StrCpy $hasPerMachineInstallation "0"
    ${endIf}
  ${endIf}

  ${if} $hasPerUserInstallation == "1"
    ${ifNot} ${FileExists} "$perUserInstallationFolder\${APP_EXECUTABLE_FILENAME}"
      StrCpy $hasPerUserInstallation "0"
    ${endIf}
  ${endIf}

  # 2. If updater.ts passed /D=<activeInstallDir>, pin the install mode to the
  # exact installation that triggered the update so dual HKCU+HKLM setups never
  # cross-uninstall the user's active installation.
  !insertmacro GetDParameter $R0
  ${if} $R0 != ""
    ${if} $perUserInstallationFolder != ""
    ${andIf} $R0 == $perUserInstallationFolder
      StrCpy $hasPerMachineInstallation "0"
      StrCpy $hasPerUserInstallation "1"
      !insertmacro setInstallModePerUser
    ${elseif} $perMachineInstallationFolder != ""
    ${andIf} $R0 == $perMachineInstallationFolder
      StrCpy $hasPerMachineInstallation "1"
      StrCpy $hasPerUserInstallation "0"
      !insertmacro setInstallModePerAllUsers
    ${endIf}
  ${else}
    ${if} $hasPerUserInstallation == "1"
    ${andIf} $hasPerMachineInstallation == "0"
      !insertmacro setInstallModePerUser
    ${elseif} $hasPerMachineInstallation == "1"
    ${andIf} $hasPerUserInstallation == "0"
      !insertmacro setInstallModePerAllUsers
    ${endIf}
  ${endIf}

  # 3. During a silent auto-update (--updated /S), ensure Lycero Office.exe
  # and helper processes have exited before uninstallation/extraction begins
  # (especially inside an elevated UAC inner instance where installSection.nsh
  # skips CHECK_APP_RUNNING).
  ${if} ${isUpdated}
  ${andIf} ${Silent}
    !insertmacro customCheckAppRunning
  ${endIf}
!macroend

!macro customInstall
  # 1. Self-heal Start Menu and Desktop shortcuts if an update or cross-mode
  # uninstaller removed them while $keepShortcuts was cached as "true"
  # (in installSection.nsh, uninstallOldVersion SHELL_CONTEXT deletes $appExe
  # first, which causes a subsequent uninstallOldVersion HKEY_CURRENT_USER to
  # see ${FileExists} "$appExe" == false and strip shortcuts without
  # --keep-shortcuts while addStartMenuLink/addDesktopLink skip recreation).
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    ${ifNot} ${FileExists} "$newStartMenuLink"
      !insertmacro createMenuDirectory
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${endIf}
  !endif

  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${ifNot} ${isNoDesktopShortcut}
      ${ifNot} ${FileExists} "$newDesktopLink"
        CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
        ClearErrors
        WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
        System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
      ${endIf}
    ${endIf}
  !endif

  # 2. Register Explorer Right-Click -> New templates for .docx / .xlsx / .pptx
  WriteRegStr SHELL_CONTEXT "Software\Classes\.docx\Word Document\ShellNew" "FileName" "$INSTDIR\resources\shell-new\blank.docx"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.xlsx\Excel Workbook\ShellNew" "FileName" "$INSTDIR\resources\shell-new\blank.xlsx"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.pptx\PowerPoint Presentation\ShellNew" "FileName" "$INSTDIR\resources\shell-new\blank.pptx"

  # 3. Always point $launchLink directly to the application executable ($appExe)
  # instead of the Start Menu .lnk shortcut ($newStartMenuLink).
  # On Windows 10/11, StdUtils.ExecShellAsUser silently fails when passing
  # "--updated" arguments to a .lnk file in %ProgramData%.
  StrCpy $launchLink "$appExe"

  # 4. Guaranteed relaunch for silent auto-update (--updated /S --force-run):
  # try StdUtils.ExecShellAsUser first, wait 800ms, and if the process did not
  # start (e.g. Explorer COM automation failed after UAC or SHChangeNotify),
  # launch $appExe directly via Win32 CreateProcess (Exec).
  ${if} ${isForceRun}
  ${andIf} ${Silent}
    HideWindow
    ${if} ${isUpdated}
      ${StdUtils.ExecShellAsUser} $0 "$appExe" "open" "--updated"
    ${else}
      ${StdUtils.ExecShellAsUser} $0 "$appExe" "open" ""
    ${endIf}
    Sleep 800
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    nsProcess::_Unload
    ${if} $R0 != 0
      ${if} ${isUpdated}
        Exec '"$appExe" --updated'
      ${else}
        Exec '"$appExe"'
      ${endIf}
    ${endIf}
    !insertmacro quitSuccess
  ${endIf}
!macroend

!endif
