# VPE — sessionStart hook: banner only (does not spawn LiteLLM). Start Project = agent: mandatory doc reads + npm run start-project:smoke + API bridge per Start-Project.md unless verify-only.

$ErrorActionPreference = 'Stop'
$hooksDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $hooksDir '..\..')).Path
$starter = Join-Path $repoRoot 'google-api\vpe-start-api.ps1'

Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host ' VPE · sessionStart — Start Project = Docs + smoke + API bridge' -ForegroundColor Cyan
Write-Host '────────────────────────────────────────' -ForegroundColor DarkRed
Write-Host '  Default: .cursor\prompts\Start-Project.md — Read mandatory docs, npm run start-project:smoke, then API.' -ForegroundColor Green
Write-Host '  VPE UI (when you need it): npm run dev  |  Forge: npm run vader:dev' -ForegroundColor DarkGray
Write-Host '  Optional API (when YOU need Vertex bridge):' -ForegroundColor DarkYellow
Write-Host '    .\google-api\vpe-start-api.ps1 -StartNgrok   (repo root)' -ForegroundColor White
Write-Host '    Or: .\google-api\vpe-start-api.ps1  then  ngrok http 4000' -ForegroundColor DarkGray

if (-not (Test-Path -LiteralPath $starter)) {
    Write-Host "[VPE HOOK] Missing: $starter" -ForegroundColor Red
    exit 1
}

Write-Host '[VPE HOOK] Hook does not launch LiteLLM; say Start Project in chat for agent auto-start (or run scripts in integrated terminals).' -ForegroundColor Green
exit 0
