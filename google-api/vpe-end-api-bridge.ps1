#!/usr/bin/env pwsh
# v1.0.0 — End session: stop LiteLLM (listeners on :4000) and ngrok processes forwarding to that port.
# Run from repo root: .\google-api\vpe-end-api-bridge.ps1   OR   pwsh -File "<repo>\google-api\vpe-end-api-bridge.ps1"
# Pair with **End-Project.md** so the next **Start Project** does not hit "port 4000 already in use".

param([int]$Port = 4000)

function Write-VpeLine {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-VpeLine "[VPE] End API bridge — freeing TCP listen $Port and matching ngrok sidecars..." "Cyan"

$pidsDone = @{}
$conns = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
if ($conns.Count -eq 0) {
    Write-VpeLine "[VPE] No listener on port $Port (already free)." "DarkGray"
} else {
    foreach ($c in $conns) {
        $oid = [int]$c.OwningProcess
        if ($oid -le 0 -or $pidsDone.ContainsKey($oid)) { continue }
        $pidsDone[$oid] = $true
        $proc = Get-Process -Id $oid -ErrorAction SilentlyContinue
        $nm = if ($proc) { $proc.ProcessName } else { 'unknown' }
        Write-VpeLine "[VPE] Stopping PID $oid ($nm) listening on $Port" "Yellow"
        Stop-Process -Id $oid -Force -ErrorAction SilentlyContinue
    }
}

# ngrok.exe whose command line forwards to this port (typical: ngrok http 4000)
$ngroks = @(Get-CimInstance Win32_Process -Filter "Name='ngrok.exe'" -ErrorAction SilentlyContinue)
foreach ($n in $ngroks) {
    $cl = [string]$n.CommandLine
    if ($cl -match "http\s+$Port\b" -or $cl -match "http\s+127\.0\.0\.1:$Port\b" -or $cl -match "http\s+localhost:$Port\b") {
        Write-VpeLine "[VPE] Stopping ngrok PID $($n.ProcessId)" "Yellow"
        Write-VpeLine "    $cl" "DarkGray"
        Stop-Process -Id $n.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Write-VpeLine "[VPE] Bridge teardown complete. Next **Start Project**: run **vpe-start-api.ps1 -StartNgrok**; paste fresh **…/v1** into Cursor if ngrok URL changed." "Green"
exit 0
