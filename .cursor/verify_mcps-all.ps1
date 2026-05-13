# Vader Station MCP Pulse Check v1.0
Write-Host "--- 🛸 STARTING SOVEREIGN MCP VERIFICATION ---" -ForegroundColor Cyan

$mcps = @(
    @{ Name = "Tavily (Search)"; Command = "npx -y tavily-mcp@latest --version" },
    @{ Name = "Payload (CMS)"; Command = "npx -y @govcraft/payload-cms-mcp --version" },
    @{ Name = "Filesystem"; Command = "npx -y @modelcontextprotocol/server-filesystem@latest --version" },
    @{ Name = "Fetch (Python)"; Command = "python -m mcp_server_fetch --help" }
)

foreach ($mcp in $mcps) {
    Write-Host "Checking $($mcp.Name)..." -NoNewline
    try {
        Invoke-Expression $mcp.Command | Out-Null
        Write-Host " [🟢 ONLINE]" -ForegroundColor Green
    } catch {
        Write-Host " [🔴 OFFLINE]" -ForegroundColor Red
    }
}

Write-Host "`n--- ⚡ GPU STATUS (RTX 5060 Ti) ---" -ForegroundColor Cyan
nvidia-smi --query-gpu=temperature.gpu,fan.speed --format=csv,noheader

Write-Host "`nPulse Check Complete." -ForegroundColor Cyan