#!/usr/bin/env pwsh
# v1.9.9 — LiteLLM + Vertex (port 4000); Cursor integrated terminal (no external windows)
# Run from repo root: .\google-api\vpe-start-api.ps1
# ngrok: global `ngrok` on User PATH (google-api dir added — scripts\vpe-add-node-launcher-user-path.ps1)
# Optional: .\google-api\vpe-start-api.ps1 -Integrated

param(
    [switch]$Integrated
)

$ScriptRootSafe = $PSScriptRoot
$KeyPath = Join-Path $ScriptRootSafe "gcp_key.json"
$ConfigPath = Join-Path $ScriptRootSafe "litellm_config.yaml"

function Write-VpeLine {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-VpeLine "=======================================================" "Cyan"
Write-VpeLine " VPE API - LiteLLM / Vertex AI (MSC) - v1.9.9 integrated" "Cyan"
Write-VpeLine "=======================================================" "Cyan"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    Write-VpeLine "[VPE ERROR] Missing service account key: $KeyPath" "Red"
    Write-VpeLine "  Place GCP JSON at .\google-api\gcp_key.json (see .cursor/docs/API-SetUp-Master.md)" "Yellow"
    exit 1
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-VpeLine "[VPE ERROR] Missing LiteLLM config: $ConfigPath" "Red"
    exit 1
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPath
if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = "1" }
if (-not $env:PYTHONIOENCODING) { $env:PYTHONIOENCODING = "utf-8" }

Write-VpeLine "GOOGLE_APPLICATION_CREDENTIALS -> $KeyPath" "Green"
Write-VpeLine "LiteLLM config -> .\google-api\litellm_config.yaml" "Green"
Write-VpeLine "Listen port -> 4000 (locked)" "Green"

Write-VpeLine "" "White"
Write-VpeLine "-- Next: open another Cursor integrated terminal pane and run (global PATH) --" "DarkYellow"
Write-VpeLine "ngrok http 4000" "Cyan"
Write-VpeLine "" "White"

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-VpeLine "[VPE WARN] ngrok not on PATH - run scripts\vpe-add-node-launcher-user-path.ps1 once, then reopen the terminal." "Yellow"
}

Write-VpeLine "[VPE STANDBY] Paths OK - ngrok (global) in separate pane - LiteLLM :4000 (this pane)" "Green"

Write-VpeLine "Starting LiteLLM (this window)..." "Cyan"
Set-Location -LiteralPath $ScriptRootSafe
& litellm --config "./litellm_config.yaml" --port 4000
