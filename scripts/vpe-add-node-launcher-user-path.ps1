# v1.9.9 — Append repo `google-api` to User PATH (global `ngrok` via `google-api\ngrok.exe`).
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\vpe-add-node-launcher-user-path.ps1

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$add = Join-Path $repoRoot 'google-api'
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
