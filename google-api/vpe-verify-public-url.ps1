#!/usr/bin/env pwsh
# v1.0.0 — Check whether Cursor's Override URL (ngrok) still points at a live LiteLLM /v1/models.
# Run: .\google-api\vpe-verify-public-url.ps1 -BaseUrl "https://xxxx.ngrok-free.dev/v1"
# Exit 0 = JSON 200 from LiteLLM; exit 1 = offline / HTML interstitial / wrong key.

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
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

$b = $BaseUrl.Trim().TrimEnd('/')
if ($b -notmatch '/v1$') {
    Write-Host "[VPE WARN] Base URL should end with /v1 — appending /v1" -ForegroundColor Yellow
    $b = "$b/v1"
}
$uri = "$b/models"
Write-Host "[VPE] GET $uri" -ForegroundColor Cyan

$headers = @{
    Authorization           = "Bearer $apiKey"
    'ngrok-skip-browser-warning' = 'true'
}

try {
    $r = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing -TimeoutSec 20
    $body = $r.Content
    if ($body -match '^\s*<!DOCTYPE' -or $body -match '<html') {
        Write-Host "[VPE FAIL] Response is HTML (ngrok interstitial or error page), not JSON. HTTP $($r.StatusCode)" -ForegroundColor Red
        Write-Host "  Free ngrok URLs go OFFLINE when the tunnel stops (ERR_NGROK_3200). Restart:" -ForegroundColor Yellow
        Write-Host "    .\google-api\vpe-start-api.ps1 -StartNgrok" -ForegroundColor White
        Write-Host "  Then paste the NEW https URL + /v1 into Cursor Models." -ForegroundColor Yellow
        exit 1
    }
    if ($r.StatusCode -ne 200) {
        Write-Host "[VPE FAIL] HTTP $($r.StatusCode)" -ForegroundColor Red
        exit 1
    }
    if ($body -notmatch '"object"\s*:\s*"list"' -and $body -notmatch '"data"\s*:') {
        Write-Host "[VPE WARN] HTTP 200 but body does not look like OpenAI /v1/models JSON (first 200 chars):" -ForegroundColor Yellow
        Write-Host $body.Substring(0, [Math]::Min(200, $body.Length))
        exit 1
    }
    Write-Host "[VPE OK] Public URL is live; LiteLLM returned models JSON (HTTP 200)." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "[VPE FAIL] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  If you see 'offline' or 404: ngrok tunnel is dead — update Cursor with a fresh URL from vpe-start-api.ps1 -StartNgrok" -ForegroundColor Yellow
    exit 1
}
