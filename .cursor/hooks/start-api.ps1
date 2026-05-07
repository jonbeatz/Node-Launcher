# Vader Project Engine - API Bootstrap Hook
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\Cursor_Projectz\Node-Launcher\gcp_key.json"
Write-Host "Vader: Bootstrapping LiteLLM API..."
litellm --config litellm_config.yaml
if ($LASTEXITCODE -eq 0) {
    Write-Host "API is Live"
} else {
    Write-Host "Error: LiteLLM failed to start."
}
