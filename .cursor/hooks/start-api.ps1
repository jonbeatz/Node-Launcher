# VPE — sessionStart hook: open vpe-start-api.ps1 in a new window (non-blocking).
# Aligned with google-api/ + port 4000; does not block the hook on litellm.

$ErrorActionPreference = 'Stop'
$hooksDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $hooksDir '..\..')).Path
$starter = Join-Path $repoRoot 'vpe-start-api.ps1'

Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host ' VPE · sessionStart → vpe-start-api.ps1' -ForegroundColor Cyan
Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed

if (-not (Test-Path -LiteralPath $starter)) {
    Write-Host "[VPE HOOK] Missing: $starter" -ForegroundColor Red
    exit 1
}

try {
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $repoRoot `
        -ArgumentList @('-NoLogo', '-NoExit', '-File', $starter) | Out-Null
    Write-Host '[VPE HOOK] New PowerShell window launched (API + ngrok).' -ForegroundColor Green
}
catch {
    Write-Host "[VPE HOOK] Start-Process failed: $_" -ForegroundColor Red
    exit 1
}
