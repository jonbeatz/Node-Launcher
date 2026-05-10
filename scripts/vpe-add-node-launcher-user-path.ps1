# v1.7.7 — Append this repo root to User PATH (global `ngrok` via repo `ngrok.exe`).
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\vpe-add-node-launcher-user-path.ps1

$add = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
$parts = $userPath -split ';' | Where-Object { $_ -ne '' }
$normAdd = $add.TrimEnd('\')
$exists = $parts | Where-Object { $_.TrimEnd('\') -ieq $normAdd }
if (-not $exists) {
    $next = ($userPath.TrimEnd(';') + ';' + $add)
    [Environment]::SetEnvironmentVariable('Path', $next, 'User')
    Write-Host "APPENDED User PATH: $add" -ForegroundColor Green
}
else {
    Write-Host "User PATH already contains: $normAdd" -ForegroundColor Cyan
}
