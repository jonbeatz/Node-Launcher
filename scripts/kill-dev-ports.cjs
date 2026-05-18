/**
 * kill-dev-ports.cjs
 * Kills any processes holding VPE dev ports (3000, 9225) and any orphan
 * Electron processes before dev startup. Safe when ports are already free.
 */

'use strict';

const { execSync } = require('child_process');

const PORTS = [3000, 9226];

function killPort(port) {
  try {
    // Use PowerShell Get-NetTCPConnection for reliable PID resolution
    execSync(
      `powershell -NoProfile -Command "` +
        `$pids = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique; ` +
        `foreach ($p in $pids) { if ($p -and $p -ne 0) { taskkill /F /PID $p 2>$null; Write-Host 'Killed PID' $p 'on port ${port}' } }"`,
      { stdio: 'pipe' }
    );
  } catch {
    // port not in use or already gone
  }
}

function killOrphanElectron() {
  try {
    // Kill any Electron processes that might hold the CDP debug port.
    // In dev mode this is always OUR VPE — no other Electron app should
    // be running. We skip this if a main window is visible to avoid
    // killing a user's intentionally open Electron app.
    execSync(
      `powershell -NoProfile -Command "` +
        `Get-Process -Name electron -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.MainWindowTitle -eq '' } | ` +
        `ForEach-Object { Write-Host 'Killing headless Electron PID' $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'pipe' }
    );
  } catch {
    // no electron processes
  }
}

// First kill orphan (headless) Electron instances from previous dev sessions
killOrphanElectron();

// Then clear the specific ports
for (const port of PORTS) {
  killPort(port);
}

console.log('[VPE] Dev ports cleared.');
