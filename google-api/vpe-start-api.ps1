#!/usr/bin/env pwsh
# v2.0.0 — LiteLLM → Vertex (port 4000); sets GCP env from gcp_key.json; optional ngrok sidecar.
# Run: .\google-api\vpe-start-api.ps1   OR   pwsh -File "<repo>\google-api\vpe-start-api.ps1"
# ngrok: prefer this folder's ngrok.exe on PATH for this session; User PATH helper: scripts\vpe-add-node-launcher-user-path.ps1

param(
    [switch]$Integrated,
    [switch]$StartNgrok,
    [int]$Port = 4000
)

$ScriptRootSafe = $PSScriptRoot
$KeyPath = Join-Path $ScriptRootSafe "gcp_key.json"
$ConfigPath = Join-Path $ScriptRootSafe "litellm_config.yaml"
$LocalNgrok = Join-Path $ScriptRootSafe "ngrok.exe"

function Write-VpeLine {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-VpeLine "=======================================================" "Cyan"
Write-VpeLine " VPE API - LiteLLM / Vertex AI (MSC) - v2.0.0" "Cyan"
Write-VpeLine "=======================================================" "Cyan"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    Write-VpeLine "[VPE ERROR] Missing service account key: $KeyPath" "Red"
    Write-VpeLine "  Place GCP JSON at .\google-api\gcp_key.json (see google-api\README.md)" "Yellow"
    exit 1
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-VpeLine "[VPE ERROR] Missing LiteLLM config: $ConfigPath" "Red"
    exit 1
}

# Resolve absolute path — some Google client libs require non-relative GOOGLE_APPLICATION_CREDENTIALS
$KeyPathResolved = (Resolve-Path -LiteralPath $KeyPath).Path
$env:GOOGLE_APPLICATION_CREDENTIALS = $KeyPathResolved

# Gemini 3 preview on Vertex uses the global API endpoint (not us-central1).
# See: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro
if (-not $env:GOOGLE_CLOUD_LOCATION) {
    $env:GOOGLE_CLOUD_LOCATION = 'global'
}
if (-not $env:VERTEXAI_LOCATION) {
    $env:VERTEXAI_LOCATION = 'global'
}
Write-VpeLine "GOOGLE_CLOUD_LOCATION / VERTEXAI_LOCATION -> global (Gemini 3 preview)" "Green"

# Align default project env with service account (Vertex + ADC)
try {
    $sa = Get-Content -LiteralPath $KeyPathResolved -Raw -Encoding utf8 | ConvertFrom-Json
    if ($sa.project_id) {
        $env:GOOGLE_CLOUD_PROJECT = [string]$sa.project_id
        $env:GCLOUD_PROJECT = $env:GOOGLE_CLOUD_PROJECT
        Write-VpeLine "GOOGLE_CLOUD_PROJECT -> $($env:GOOGLE_CLOUD_PROJECT)" "Green"
    }
} catch {
    Write-VpeLine "[VPE WARN] Could not read project_id from gcp_key.json: $($_.Exception.Message)" "Yellow"
}

if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = "1" }
if (-not $env:PYTHONIOENCODING) { $env:PYTHONIOENCODING = "utf-8" }
# Help Uvicorn / Rich emit ANSI greens for 2xx in Cursor & Windows Terminal
if (-not $env:FORCE_COLOR) { $env:FORCE_COLOR = "1" }
if (-not $env:PYTHONUNBUFFERED) { $env:PYTHONUNBUFFERED = "1" }
# OpenAI-compatible clients (e.g. Cursor Agent) may send params Vertex Gemini rejects; LiteLLM honors this env before config load.
if (-not $env:LITELLM_DROP_PARAMS) { $env:LITELLM_DROP_PARAMS = 'true' }
Remove-Item env:NO_COLOR -ErrorAction SilentlyContinue

# Prefer this repo's ngrok when present (avoids wrong binary from another clone on User PATH)
if (Test-Path -LiteralPath $LocalNgrok) {
    $env:Path = "$ScriptRootSafe;$env:Path"
}

Write-VpeLine "GOOGLE_APPLICATION_CREDENTIALS -> $KeyPathResolved" "Green"
Write-VpeLine "LiteLLM config -> $ConfigPath" "Green"
Write-VpeLine "Listen port -> $Port" "Green"

# ngrok forwards to $Port — LiteLLM MUST bind the same port. If another proxy is on $Port, a second
# LiteLLM may bind elsewhere (e.g. 16027) while ngrok still hits $Port -> Cursor ERROR_PROVIDER_ERROR.
$busy = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
if ($busy.Count -gt 0) {
    Write-VpeLine "[VPE ERROR] TCP port $Port is already in use (another LiteLLM or dev server)." "Red"
    Write-VpeLine "  Stop it, then re-run. ngrok is configured for http://127.0.0.1:$Port — mismatched ports break Cursor." "Yellow"
    exit 1
}
if (Test-Path Env:PORT) {
    Write-VpeLine "[VPE WARN] Removing env PORT=$($env:PORT) so Uvicorn uses --port $Port (not a random port)." "Yellow"
    Remove-Item Env:\PORT
}

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-VpeLine "[VPE WARN] ngrok not on PATH - run scripts\vpe-add-node-launcher-user-path.ps1 once, or use google-api\ngrok.exe from this folder." "Yellow"
}

if ($StartNgrok) {
    $ngrokExe = $null
    if (Test-Path -LiteralPath $LocalNgrok) { $ngrokExe = $LocalNgrok }
    elseif (Get-Command ngrok -ErrorAction SilentlyContinue) { $ngrokExe = (Get-Command ngrok).Source }
    if ($ngrokExe) {
        Write-VpeLine "[VPE] Starting ngrok -> http://127.0.0.1:$Port (hidden process)..." "Cyan"
        Start-Process -FilePath $ngrokExe -ArgumentList @('http', "$Port") -WindowStyle Hidden -WorkingDirectory $ScriptRootSafe
        Start-Sleep -Seconds 3
        try {
            $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
            $pub = $tunnels.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1 -ExpandProperty public_url
            if ($pub) {
                Write-VpeLine "[VPE] ngrok public URL -> $pub" "Green"
                Write-VpeLine "" "White"
                Write-VpeLine "[VPE CRITICAL] Cursor 'Override OpenAI Base URL' must be: $($pub.TrimEnd('/'))/v1" "Yellow"
                Write-VpeLine "  Free ngrok hostnames DIE when this tunnel stops. If Cursor breaks tomorrow, run:" "DarkYellow"
                Write-VpeLine "    .\google-api\vpe-verify-public-url.ps1 -BaseUrl '<paste Cursor URL here>'" "Cyan"
                Write-VpeLine "  Then re-start ngrok + LiteLLM and paste the NEW URL into Cursor Models." "DarkYellow"
                Write-VpeLine "" "White"
            }
        } catch {
            Write-VpeLine "[VPE WARN] ngrok inspector not ready yet — open http://127.0.0.1:4040 for the public URL." "Yellow"
        }
    } else {
        Write-VpeLine "[VPE ERROR] -StartNgrok set but ngrok executable not found." "Red"
        exit 1
    }
} else {
    Write-VpeLine "" "White"
    Write-VpeLine "-- Optional: second integrated terminal pane --" "DarkYellow"
    Write-VpeLine "  ngrok http $Port" "Cyan"
    Write-VpeLine "  (or re-run this script with -StartNgrok)" "DarkGray"
    Write-VpeLine "  To paint green 200 lines in THIS log: second pane -> .\google-api\vpe-ping-api.ps1" "DarkYellow"
    Write-VpeLine "" "White"
}

Write-VpeLine "[VPE STANDBY] Starting LiteLLM (Vertex backend per litellm_config.yaml)..." "Green"
Write-VpeLine "[VPE] After startup: Uvicorn MUST show http://0.0.0.0:$Port — if you see a different port, stop duplicate LiteLLM and re-run." "DarkYellow"
Set-Location -LiteralPath $ScriptRootSafe
& litellm --config "./litellm_config.yaml" --port $Port
