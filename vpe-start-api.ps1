#!/usr/bin/env pwsh
# v1.6.1 — Self-contained LiteLLM + Vertex (port 4000) + ngrok (new window)
# Run from repo root: .\vpe-start-api.ps1

$ScriptRootSafe = $PSScriptRoot
$KeyPath = Join-Path $ScriptRootSafe "google-api\gcp_key.json"
$ConfigPath = Join-Path $ScriptRootSafe "google-api\litellm_config.yaml"

function Write-VpeLine {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-VpeLine "═══════════════════════════════════════════════════════" "Cyan"
Write-VpeLine " VPE API — LiteLLM ⇄ Vertex AI (MSC)" "Cyan"
Write-VpeLine "═══════════════════════════════════════════════════════" "Cyan"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    Write-VpeLine "[VPE ERROR] Missing service account key: $KeyPath" "Red"
    Write-VpeLine "  Place GCP JSON at .\google-api\gcp_key.json (see API-SetUp-Master.md)" "Yellow"
    exit 1
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-VpeLine "[VPE ERROR] Missing LiteLLM config: $ConfigPath" "Red"
    exit 1
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath
if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = "1" }
if (-not $env:PYTHONIOENCODING) { $env:PYTHONIOENCODING = "utf-8" }

Write-VpeLine "GOOGLE_APPLICATION_CREDENTIALS → $KeyPath" "Green"
Write-VpeLine "LiteLLM config → .\google-api\litellm_config.yaml" "Green"
Write-VpeLine "Listen port → 4000 (locked)" "Green"

$repoEsc = $ScriptRootSafe.Replace("'", "''")
$ngrokBlock = @"
Set-Location -LiteralPath '$repoEsc'
Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host ' VPE · ngrok → http://localhost:4000' -ForegroundColor Cyan
Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
`$exe = Join-Path '$repoEsc' 'ngrok.exe'
if (Test-Path -LiteralPath `$exe) { & `$exe http 4000 } else { ngrok http 4000 }
"@
try {
    Start-Process -FilePath "powershell.exe" -WorkingDirectory $ScriptRootSafe `
        -ArgumentList @("-NoLogo", "-NoExit", "-Command", $ngrokBlock) -ErrorAction Stop | Out-Null
    Write-VpeLine "ngrok launched in a new PowerShell window (http 4000)." "Cyan"
}
catch {
    Write-VpeLine "[VPE ERROR] Could not start ngrok window: $_" "Red"
    Write-VpeLine "  Run manually: ngrok http 4000" "Yellow"
}

Write-VpeLine "[VPE STANDBY] Self-contained paths OK · ngrok window · LiteLLM :4000" "Green"

Write-VpeLine "Starting LiteLLM (this window)…" "Cyan"
Set-Location -LiteralPath $ScriptRootSafe
& litellm --config "./google-api/litellm_config.yaml" --port 4000
