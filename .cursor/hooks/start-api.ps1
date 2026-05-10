# VPE — sessionStart hook (v1.7.7): print integrated-terminal reminder only (no new windows).

$ErrorActionPreference = 'Stop'
$hooksDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $hooksDir '..\..')).Path
$starter = Join-Path $repoRoot 'vpe-start-api.ps1'

Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host ' VPE · sessionStart — use Cursor split panes (no external windows)' -ForegroundColor Cyan
Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host '  Pane 1: npm run dev' -ForegroundColor White
Write-Host '  Pane 2: .\vpe-start-api.ps1' -ForegroundColor White
Write-Host '  Pane 3: ngrok http 4000  (global PATH)' -ForegroundColor White

if (-not (Test-Path -LiteralPath $starter)) {
    Write-Host "[VPE HOOK] Missing: $starter" -ForegroundColor Red
    exit 1
}

Write-Host '[VPE HOOK] Start LiteLLM / ngrok manually in integrated terminals when needed.' -ForegroundColor Green
exit 0
