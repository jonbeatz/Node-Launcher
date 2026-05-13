# Vader Station: REAL MCP Status Audit v1.2 (Bug Fix Edition)
$mcpConfigPath = "$HOME\.cursor\mcp.json"
Write-Host "--- 🛸 AUDITING GLOBAL MCP CONFIGURATION ---" -ForegroundColor Cyan

if (Test-Path $mcpConfigPath) {
    $config = Get-Content $mcpConfigPath | ConvertFrom-Json
    $servers = $config.mcpServers.PSObject.Properties

    foreach ($server in $servers) {
        $name = $server.Name
        $val = $server.Value
        Write-Host "Checking: $name..." -NoNewline
        
        # Guard: Only check local binaries if the 'command' property exists
        if ($val.psobject.Properties['command'] -and $val.command) {
            if (Get-Command $val.command -ErrorAction SilentlyContinue) {
                Write-Host " [✅ CONFIGURED]" -ForegroundColor Green
            } else {
                Write-Host " [⚠️ BINARY MISSING: $($val.command)]" -ForegroundColor Yellow
            }
        } elseif ($val.psobject.Properties['url']) {
            Write-Host " [🌐 REMOTE HTTP SERVER]" -ForegroundColor Blue
        } else {
            Write-Host " [❓ UNKNOWN TYPE]" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "🔴 Global mcp.json not found at $mcpConfigPath" -ForegroundColor Red
}

Write-Host "`n--- ⚡ GPU STATUS (RTX 5060 Ti) ---" -ForegroundColor Cyan
nvidia-smi --query-gpu=temperature.gpu,fan.speed --format=csv,noheader