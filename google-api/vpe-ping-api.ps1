#!/usr/bin/env pwsh
# v1.0.0 — Hit LiteLLM so the Uvicorn pane shows 200 access lines (green in Cursor / Windows Terminal).
# Run in a *second* integrated terminal while vpe-start-api.ps1 runs in the first.

param([int]$Port = 4000)

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
$base = "http://127.0.0.1:$Port"
$h = @{ Authorization = "Bearer $apiKey" }

Write-Host "[VPE] Pinging LiteLLM at $base (watch the LiteLLM terminal for access-log 200)..." -ForegroundColor Cyan

try {
    $m = Invoke-WebRequest -Uri "$base/v1/models" -Headers $h -UseBasicParsing -TimeoutSec 15
    Write-Host ("[VPE] GET /v1/models -> HTTP " + $m.StatusCode) -ForegroundColor Green
} catch {
    Write-Host "[VPE] GET /v1/models failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Gemini 3 uses internal "thinking" budget; very small max_tokens can surface as Vertex INVALID_ARGUMENT.
$body = '{"model":"vader-3-flash","messages":[{"role":"user","content":"Say the word pong and nothing else."}],"max_tokens":256}'
try {
    $c = Invoke-WebRequest -Uri "$base/v1/chat/completions" -Headers $h -Method Post -Body $body -ContentType "application/json; charset=utf-8" -UseBasicParsing -TimeoutSec 120
    Write-Host ("[VPE] POST /v1/chat/completions -> HTTP " + $c.StatusCode) -ForegroundColor Green
} catch {
    Write-Host "[VPE] POST /v1/chat/completions failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "[VPE] Done." -ForegroundColor Green
