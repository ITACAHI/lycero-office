@echo off
rem lycero-office launcher for the packaged Windows app: <install>\resources\cli\lycero-office.cmd
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\Lycero Office.exe" "%~dp0lycero-office.cjs" %*
endlocal
