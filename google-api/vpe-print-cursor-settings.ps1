#!/usr/bin/env pwsh
# Prints Cursor "Override OpenAI" values (no secrets beyond what's already in litellm_config.yaml).
# Run: .\google-api\vpe-print-cursor-settings.ps1   [-Port 4000]   [-PublicBaseUrl "https://xxxx.ngrok-free.app/v1"]

param(
    [int]$Port = 4000,
    [string]$PublicBaseUrl = ""
)

$root = $PSScriptRoot
$yamlPath = Join-Path $root "litellm_config.yaml"
if (-not (Test-Path -LiteralPath $yamlPath)) {
    Write-Host "[VPE] Missing $yamlPath" -ForegroundColor Red
    exit 1
}
$yamlRaw = Get-Content -LiteralPath $yamlPath -Raw -Encoding utf8
if ($yamlRaw -notmatch '(?m)^\s*master_key:\s*(.+)\s*$') {
    Write-Host "[VPE] Could not read master_key from litellm_config.yaml" -ForegroundColor Red
    exit 1
}
$apiKey = $Matches[1].Trim().Trim('"').Trim("'")
$localBase = "http://127.0.0.1:$Port/v1"

Write-Host ""
Write-Host "[VPE] If you use ngrok: that hostname EXPIRES when the tunnel stops. Update Cursor after every restart." -ForegroundColor Red
Write-Host ""
Write-Host "======== VPE / Cursor - paste into Cursor Settings > Models ========" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) Override OpenAI Base URL (pick ONE):" -ForegroundColor Yellow
Write-Host "   LOCAL (Composer/Chat on this machine only):" -ForegroundColor Green
Write-Host "   $localBase"
if ($PublicBaseUrl) {
    $u = $PublicBaseUrl.TrimEnd('/')
    if ($u -notmatch '/v1$') { $u = "$u/v1" }
    Write-Host ""
    Write-Host "   PUBLIC (ngrok / cloud Agent — must be HTTPS and end with /v1):" -ForegroundColor Green
    Write-Host "   $u"
} else {
    Write-Host ""
    Write-Host "   PUBLIC: start ngrok, then re-run:" -ForegroundColor DarkGray
    Write-Host "   .\google-api\vpe-print-cursor-settings.ps1 -PublicBaseUrl `"https://YOUR-SUBDOMAIN.ngrok-free.app`"" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "2) OpenAI API Key (same as LiteLLM master_key):" -ForegroundColor Yellow
Write-Host "   $apiKey"
Write-Host ""
Write-Host "3) Add custom models (toggle ON):" -ForegroundColor Yellow
Write-Host "   vader-3-flash"
Write-Host "   vader-31-pro"
Write-Host ""
Write-Host "4) Do NOT use a base URL ending in /cursor for Gemini 3 on LiteLLM 1.83.x" -ForegroundColor DarkYellow
Write-Host "   See: .cursor\docs\Cursor-LiteLLM-Bridge.md"
Write-Host ""
Write-Host "5) Verify bridge + Vertex:" -ForegroundColor Yellow
Write-Host "   .\google-api\vpe-ping-api.ps1"
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
