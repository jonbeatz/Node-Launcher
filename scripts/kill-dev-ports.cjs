/**
 * kill-dev-ports.cjs
 *
 * Pre-flight cleanup before `npm run vader:dev`:
 *  1. Kill any orphaned electron / node processes that originate from THIS workspace
 *     (targeted by path — safe even if other Electron apps are running).
 *  2. Probe CDP ports 9226-9235 to find the first free one.
 *  3. Kill the owner of every port in the sweep range (with ghost-socket retry).
 *  4. Write the winning free port to `.vpe-runtime.json` so MCP tools and
 *     agent-browser scripts can always attach without guessing the port.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(ROOT_DIR, '.vpe-runtime.json');
const RENDERER_PORT = 3000;
const CDP_BASE_PORT = 9227;
const CDP_PORT_SCAN_RANGE = 10; // probe 9227 … 9236
const PORT_WAIT_MS = 3000;
const POLL_INTERVAL_MS = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin */ }
}

/** True when port has at least one active TCP binding (LISTEN or ESTABLISHED). */
function isPortInUse(port) {
  try {
    const result = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Measure-Object).Count`,
    ], { encoding: 'utf8', timeout: 3000 });
    const count = parseInt((result.stdout || '').trim(), 10);
    return Number.isFinite(count) && count > 0;
  } catch {
    return false;
  }
}

/** Async port probe via TCP connect (200 ms timeout). Returns true if something is listening. */
function probePortAsync(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    let done = false;
    const finish = (inUse) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_) { /* ignore */ }
      resolve(inUse);
    };
    socket.setTimeout(200);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

/** Kill whatever owns the port and wait for the socket to release. */
function killPort(port) {
  try {
    execSync(
      `powershell -NoProfile -NonInteractive -Command "` +
        `$owners = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique; ` +
        `foreach ($p in $owners) { if ($p -and $p -ne 0) { taskkill /F /PID $p 2>$null } }"`,
      { stdio: 'pipe' },
    );
  } catch {
    // port not in use or already gone
  }

  // Wait up to PORT_WAIT_MS for the socket to actually release.
  const deadline = Date.now() + PORT_WAIT_MS;
  while (Date.now() < deadline) {
    if (!isPortInUse(port)) break;
    sleep(POLL_INTERVAL_MS);
  }
}

// ── Step 1: Kill orphaned workspace-specific electron / node processes ───────

function killWorkspaceOrphans() {
  const workspaceTag = 'Node-Launcher-v2';
  try {
    // Kill electron.exe processes whose binary path contains our workspace directory.
    execSync(
      `powershell -NoProfile -NonInteractive -Command ` +
        `"Get-Process -Name electron,node -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.Path -like '*${workspaceTag}*' } | ` +
        `ForEach-Object { Write-Host '[VPE] Killing orphan' $_.Name 'PID' $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'pipe' },
    );
  } catch {
    // no matching processes — fine
  }

  // Fallback: also kill headless (windowless) electron processes that have no
  // visible title — covers builds where the path check can't resolve.
  try {
    execSync(
      `powershell -NoProfile -Command "` +
        `Get-Process -Name electron -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.MainWindowTitle -eq '' } | ` +
        `ForEach-Object { Write-Host '[VPE] Killing headless Electron PID' $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'pipe' },
    );
  } catch {
    // no processes
  }
}

// ── Step 2: Clear renderer port ──────────────────────────────────────────────

function clearRendererPort() {
  killPort(RENDERER_PORT);
}

// ── Step 3: Scan CDP range, free all, select first open port ─────────────────

async function selectAndFreeCdpPort() {
  // First pass: kill all ports in the scan range so we start clean.
  for (let p = CDP_BASE_PORT; p < CDP_BASE_PORT + CDP_PORT_SCAN_RANGE; p++) {
    if (isPortInUse(p)) {
      killPort(p);
    }
  }

  // Second pass: pick the first port that is now genuinely free.
  for (let p = CDP_BASE_PORT; p < CDP_BASE_PORT + CDP_PORT_SCAN_RANGE; p++) {
    const inUse = await probePortAsync(p);
    if (!inUse) {
      return p;
    }
  }

  // All probes failed (extremely unlikely) — fall back to base + range.
  return CDP_BASE_PORT + CDP_PORT_SCAN_RANGE;
}

// ── Step 4: Write runtime file ────────────────────────────────────────────────

/** Remove any stale `.vpe-runtime.json` left over from a previous session. */
function clearStaleRuntimeFile() {
  try {
    if (fs.existsSync(RUNTIME_FILE)) {
      fs.unlinkSync(RUNTIME_FILE);
      console.log('[VPE] Cleared stale .vpe-runtime.json from previous session.');
    }
  } catch (_) { /* non-fatal */ }
}

function writeRuntimeFile(cdpPort) {
  try {
    const payload = {
      cdpPort,
      cdpEndpoint: `http://127.0.0.1:${cdpPort}`,
      rendererPort: RENDERER_PORT,
      workspaceRoot: ROOT_DIR,
      startedAt: new Date().toISOString(),
    };
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[VPE] Runtime context written → .vpe-runtime.json  (cdpPort=${cdpPort})`);
  } catch (e) {
    console.warn('[VPE] Could not write .vpe-runtime.json:', e?.message ?? e);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('[VPE] Pre-flight sweep starting...');
  clearStaleRuntimeFile();
  killWorkspaceOrphans();
  clearRendererPort();
  const cdpPort = await selectAndFreeCdpPort();
  writeRuntimeFile(cdpPort);
  // Expose for cross-env pass-through so `dev:main` can pick it up without
  // hardcoding a port number. The env var is read by main.js at boot.
  process.env.VPE_REMOTE_DEBUG_PORT = String(cdpPort);
  console.log(`[VPE] Dev ports cleared. CDP will bind on :${cdpPort}`);
})();
