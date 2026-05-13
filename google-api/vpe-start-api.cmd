@echo off
REM VPE Start API — cmd-friendly launcher (avoids invalid `cd /d` in PowerShell).
set "HERE=%~dp0"
pwsh -NoProfile -ExecutionPolicy Bypass -File "%HERE%vpe-start-api.ps1" %*
