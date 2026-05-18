const EventEmitter = require('events');
const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const path = require('path');
const treeKill = require('tree-kill');
const {
  msc_normalizePersistedProjectPath,
  msc_registryProjectRootExists,
} = require('./path-guard');
const { msc_ipcEnrichProjectsRow } = require('./project-detection');
const { msc_probeHttpHealth } = require('./health-probe');
const { msc_launcherRendererPort } = require('./launcher-port');
const { msc_healthPollDelayMs, MSC_HEALTH_FIRST_MS } = require('./health-scheduler');

const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();

// ── LocalWP / WordPress-Local helpers ────────────────────────────────────────

/** Absolute path to LocalWP's sites.json (written by the Local GUI app). */
const MSC_LOCAL_SITES_JSON = path.join(
  process.env.USERPROFILE || process.env.APPDATA || '',
  'AppData', 'Roaming', 'Local', 'sites.json',
);

/**
 * Parse LocalWP's sites.json. Returns the raw object or null on any error.
 * @returns {Record<string, Record<string, unknown>> | null}
 */
function msc_readLocalWpSitesJson() {
  try {
    if (!fs.existsSync(MSC_LOCAL_SITES_JSON)) return null;
    return JSON.parse(fs.readFileSync(MSC_LOCAL_SITES_JSON, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Find a LocalWP site entry whose `domain` matches `<slug>.local`.
 * @param {string} slug - e.g. "talkshowlandv1"
 * @returns {Record<string, unknown> | null}
 */
function msc_findLocalWpSiteBySlug(slug) {
  const sites = msc_readLocalWpSitesJson();
  if (!sites || typeof sites !== 'object') return null;
  const target = `${slug}.local`.toLowerCase();
  for (const entry of Object.values(sites)) {
    if (entry && typeof entry === 'object' && String(entry.domain || '').toLowerCase() === target) {
      return entry;
    }
  }
  return null;
}

/**
 * Extract the nginx/apache HTTP port from a LocalWP site services block.
 * Returns null when no HTTP-role service is found.
 * @param {Record<string, unknown>} siteEntry
 * @returns {number | null}
 */
function msc_getLocalWpNginxPort(siteEntry) {
  if (!siteEntry || typeof siteEntry !== 'object') return null;
  const services = siteEntry.services;
  if (!services || typeof services !== 'object') return null;
  for (const svc of Object.values(services)) {
    if (svc && svc.role === 'http' && svc.ports) {
      const ports = svc.ports.HTTP || svc.ports.http || svc.ports.HTTPS || [];
      if (Array.isArray(ports) && ports.length > 0) return Number(ports[0]);
    }
  }
  return null;
}

/**
 * Discover the Local by Flywheel executable across common install locations.
 * Checks the legacy `main-cli/win32/local.exe` stub first (pre-v10), then
 * falls back to the main `Local.exe` GUI app (v10+, supports single-instance
 * CLI pass-through when Local is already running).
 * Returns the absolute path (unquoted) or null if not found.
 * @returns {string | null}
 */
function msc_findLocalExePath() {
  const lad  = process.env.LOCALAPPDATA || '';
  const pf   = 'C:\\Program Files';
  const pf86 = 'C:\\Program Files (x86)';
  const cliSuffix = path.join('resources', 'extraResources', 'main-cli', 'win32', 'local.exe');
  const guiSuffix = 'Local.exe';

  // Pre-v10 dedicated CLI stub candidates.
  const cliCandidates = [
    path.join(lad,  'Programs', 'local-by-flywheel', cliSuffix),
    path.join(lad,  'Programs', 'Local',             cliSuffix),
    path.join(pf,   'Local',                         cliSuffix),
    path.join(pf86, 'Local',                         cliSuffix),
    path.join(pf,   'local-by-flywheel',             cliSuffix),
  ];
  for (const p of cliCandidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* */ }
  }

  // Squirrel versioned directory: %LOCALAPPDATA%\local-by-flywheel\app-X.Y.Z\...
  try {
    const lbf = path.join(lad, 'local-by-flywheel');
    if (fs.existsSync(lbf)) {
      const dirs = fs.readdirSync(lbf).filter((d) => d.startsWith('app-')).sort().reverse();
      for (const d of dirs) {
        const p = path.join(lbf, d, cliSuffix);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (_) { /* */ }

  // v10+ fallback: the GUI app itself accepts CLI args via Electron single-instance
  // pass-through when Local is already running (start-site / stop-site / router start).
  const guiCandidates = [
    path.join(pf86, 'Local', guiSuffix),
    path.join(pf,   'Local', guiSuffix),
    path.join(lad,  'Programs', 'Local', guiSuffix),
  ];
  for (const p of guiCandidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* */ }
  }

  return null;
}

/**
 * Discover the WP-CLI phar and a compatible PHP binary bundled with Local.
 * Returns { phpExe, wpCliPhar } or null if either component is missing.
 * @returns {{ phpExe: string, wpCliPhar: string } | null}
 */
function msc_findLocalWpCliPaths() {
  const pf86 = 'C:\\Program Files (x86)';
  const pf   = 'C:\\Program Files';

  const wpCliPhar = [
    path.join(pf86, 'Local', 'resources', 'extraResources', 'bin', 'wp-cli', 'wp-cli.phar'),
    path.join(pf,   'Local', 'resources', 'extraResources', 'bin', 'wp-cli', 'wp-cli.phar'),
  ].find((p) => { try { return fs.existsSync(p); } catch { return false; } });

  if (!wpCliPhar) return null;

  // Find the highest-version PHP binary in lightning-services.
  // wpCliPhar is at .../extraResources/bin/wp-cli/wp-cli.phar — step up 3 dirs to extraResources.
  const lightningBase = path.join(path.dirname(path.dirname(path.dirname(wpCliPhar))), 'lightning-services');
  let phpExe = null;
  try {
    if (fs.existsSync(lightningBase)) {
      const phpDirs = fs.readdirSync(lightningBase)
        .filter((d) => d.startsWith('php-'))
        .sort()
        .reverse(); // newest first
      for (const d of phpDirs) {
        const candidate = path.join(lightningBase, d, 'bin', 'win64', 'php.exe');
        if (fs.existsSync(candidate)) { phpExe = candidate; break; }
      }
    }
  } catch (_) { /* */ }

  if (!phpExe) return null;
  return { phpExe, wpCliPhar };
}

/**
 * Write a VPE-managed WordPress mu-plugin that forces WP_HOME / WP_SITEURL to
 * use http:// instead of https://. This prevents WordPress from issuing a 301
 * redirect to https when the Local router is serving plain HTTP.
 *
 * @param {string} wpRoot - absolute path to the WordPress web root (where wp-config.php lives)
 * @param {string} domain - e.g. "talkshowlandv1.local"
 * @returns {{ ok: boolean, path?: string, error?: string }}
 */
function msc_writeWpVpeMuPlugin(wpRoot, domain) {
  try {
    const muDir = path.join(wpRoot, 'wp-content', 'mu-plugins');
    fs.mkdirSync(muDir, { recursive: true });
    const pluginPath = path.join(muDir, 'vpe-local-urls.php');
    const content = [
      '<?php',
      '/**',
      ' * VPE Local URL Override — managed by Vader Project Engine.',
      ' * Forces WP_HOME / WP_SITEURL to http:// so the Local router can serve the',
      ' * site over plain HTTP without triggering a WordPress 301 → https redirect.',
      ' * AUTO-GENERATED: deleted automatically when VPE stops this project.',
      ' */',
      "if (!defined('VPE_LOCAL_URL_OVERRIDE')) {",
      "    define('VPE_LOCAL_URL_OVERRIDE', true);",
      `    define('WP_HOME',    'http://${domain}');`,
      `    define('WP_SITEURL', 'http://${domain}');`,
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(pluginPath, content, 'utf8');
    return { ok: true, path: pluginPath };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Remove the VPE-managed mu-plugin if it exists and was written by VPE.
 * @param {string} wpRoot
 * @returns {{ ok: boolean, skipped?: boolean, error?: string }}
 */
function msc_removeWpVpeMuPlugin(wpRoot) {
  try {
    const pluginPath = path.join(wpRoot, 'wp-content', 'mu-plugins', 'vpe-local-urls.php');
    if (!fs.existsSync(pluginPath)) return { ok: true, skipped: true };
    const content = fs.readFileSync(pluginPath, 'utf8');
    if (content.includes('VPE Local URL Override') || content.includes('VPE_LOCAL_URL_OVERRIDE')) {
      fs.unlinkSync(pluginPath);
      return { ok: true };
    }
    return { ok: true, skipped: true };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Read Local's live GraphQL connection info (written by the running Local GUI).
 * Returns { url, authToken } or null if the file doesn't exist.
 * @returns {{ url: string, authToken: string } | null}
 */
function msc_readLocalGraphqlInfo() {
  const gqlPath = path.join(
    process.env.USERPROFILE || process.env.APPDATA || '',
    'AppData', 'Roaming', 'Local', 'graphql-connection-info.json',
  );
  try {
    if (!fs.existsSync(gqlPath)) return null;
    const raw = JSON.parse(fs.readFileSync(gqlPath, 'utf8'));
    if (raw && raw.url && raw.authToken) return { url: String(raw.url), authToken: String(raw.authToken) };
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Launch Local.exe in the background with a minimized window so it doesn't steal focus.
 * Uses PowerShell Start-Process -WindowStyle Minimized on Windows to suppress the GUI popup.
 * Safe no-op when localExePath is falsy.
 * @param {string | null} localExePath - unquoted absolute path to Local.exe
 */
function msc_launchLocalMinimized(localExePath) {
  if (!localExePath) return;
  if (process.platform === 'win32') {
    const safeExe = localExePath.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "& { Start-Process -FilePath '${safeExe}' -WindowStyle Minimized }"`;
    exec(psCmd, { windowsHide: true }, (err) => {
      if (err) console.warn('[VPE] LocalWP minimized launch warning:', err.message);
    });
    // Local.exe ignores -WindowStyle Minimized and shows multiple windows during startup
    // (splash, update checker, main window). Poll every 500ms for 20s and force-minimize
    // every visible window using SW_FORCEMINIMIZE (11) which works even on unresponsive threads.
    const minScript = [
      'Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;',
      'public class VpeWin32Launch {',
      '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);',
      '}\' -ErrorAction SilentlyContinue;',
      'Get-Process -Name Local -ErrorAction SilentlyContinue | ForEach-Object {',
      '  if ($_.MainWindowHandle -ne [IntPtr]::Zero) {',
      '    [VpeWin32Launch]::ShowWindow($_.MainWindowHandle, 11) | Out-Null',
      '  }',
      '}',
    ].join(' ');
    const runMin = () => exec(
      `powershell -WindowStyle Hidden -Command "${minScript}"`,
      { windowsHide: true, timeout: 5000 },
      () => {},
    );
    // Poll every 500ms for the first 20s — catches splash screen, main window, and any restore.
    let minPollCount = 0;
    const minPollId = setInterval(() => {
      runMin();
      minPollCount += 1;
      if (minPollCount >= 40) clearInterval(minPollId);
    }, 500);
  } else {
    exec(`"${localExePath}"`, { windowsHide: true }, () => {});
  }
}

/**
 * Synchronous check: is the Local by Flywheel GUI process (Local.exe) actually running?
 *
 * This is the primary gate for `msc_isLocalGraphqlListening`. Without it, a stale
 * graphql-connection-info.json can produce a false positive when another service
 * (e.g. LiteLLM) happens to be listening on port 4000 — the same default port Local uses.
 *
 * @returns {boolean}
 */
function msc_isLocalExeProcessRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const stdout = (execSync('tasklist /FI "IMAGENAME eq Local.exe" /FO CSV /NH', {
      windowsHide: true,
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }) || '').toString();
    return stdout.toLowerCase().includes('local.exe');
  } catch {
    return false;
  }
}

/**
 * Three-gate check: resolves `true` only when Local.exe is running, its GraphQL port
 * is reachable, AND an HTTP probe confirms the endpoint returns a real GraphQL response.
 *
 * Prevents false positives when another service (e.g. LiteLLM) is on the same port
 * that a stale graphql-connection-info.json references. Never rejects.
 *
 * @returns {Promise<boolean>}
 */
async function msc_isLocalGraphqlListening() {
  // Gate 1: Local.exe process must be alive.
  if (!msc_isLocalExeProcessRunning()) return false;

  // Gate 2: The GraphQL port from the connection-info file must be reachable.
  const info = msc_readLocalGraphqlInfo();
  if (!info) return false;
  try {
    const portNum = Number(new URL(info.url).port) || 4000;
    await new Promise((resolve, reject) => {
      const sock = net.createConnection({ port: portNum, host: '127.0.0.1' });
      sock.setTimeout(600);
      sock.on('connect', () => { sock.destroy(); resolve(undefined); });
      sock.on('error',   (e) => { sock.destroy(); reject(e); });
      sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
    });
    // Gate 3: Confirm the responding service is a real GraphQL server.
    return await msc_validateLocalGraphqlEndpoint(info);
  } catch {
    return false;
  }
}

/**
 * Poll for LocalWP's GraphQL server to become available.
 * Reads graphql-connection-info.json and verifies the TCP socket is listening before resolving.
 * Designed to be called right after msc_launchLocalMinimized so mutations don't fire early.
 *
 * @param {number} [maxAttempts=120] - number of polling cycles (120 × 500ms = 60 seconds total)
 * @param {number} [intervalMs=500] - milliseconds between each poll
 * @returns {Promise<{url: string, authToken: string} | null>}
 */
/**
 * Three-gate check to confirm the server at `info.url` is actually Local's GraphQL API:
 *  1. TCP socket connects (port is open)
 *  2. A simple `{ __typename }` GraphQL introspection returns JSON with a `data` key
 *
 * This prevents false positives when another service (e.g. LiteLLM) is running on the
 * same port as the stale graphql-connection-info.json references. LiteLLM returns
 * HTTP 404 + {"detail":"Not Found"} for the /graphql path — no `data` key.
 *
 * @param {{ url: string, authToken: string }} info
 * @returns {Promise<boolean>}
 */
async function msc_validateLocalGraphqlEndpoint(info) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(info.url);
      const body = JSON.stringify({ query: '{ __typename }' });
      const req = http.request({
        hostname: '127.0.0.1',
        port: Number(parsed.port) || 4000,
        path: parsed.pathname || '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': `Bearer ${info.authToken}`,
          'apollo-require-preflight': 'true',
        },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            // A valid GraphQL server returns { data: { ... } }
            // LiteLLM returns { "detail": "Not Found" } for /graphql — no `data` key
            resolve(json != null && typeof json === 'object' && 'data' in json);
          } catch {
            resolve(false);
          }
        });
      });
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.write(body);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function msc_waitForLocalGraphql(maxAttempts = 120, intervalMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Gate 1: Local.exe process must be running before we trust the connection-info file.
    // Without this, a service already on port 4000 (e.g. LiteLLM) would satisfy the
    // socket check before Local has even had a chance to write its own port to the file.
    if (!msc_isLocalExeProcessRunning()) {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    const info = msc_readLocalGraphqlInfo();
    if (info) {
      try {
        // Gate 2: TCP socket must be open.
        const portNum = Number(new URL(info.url).port) || 4000;
        await new Promise((resolve, reject) => {
          const sock = net.createConnection({ port: portNum, host: '127.0.0.1' });
          sock.setTimeout(350);
          sock.on('connect', () => { sock.destroy(); resolve(undefined); });
          sock.on('error', (e) => { sock.destroy(); reject(e); });
          sock.on('timeout', () => { sock.destroy(); reject(new Error('socket timeout')); });
        });
        // Gate 3: HTTP probe confirms it's actually a GraphQL server (not LiteLLM/REST).
        const isRealGraphql = await msc_validateLocalGraphqlEndpoint(info);
        if (isRealGraphql) return info; // Local GraphQL is genuinely up!
      } catch (_) { /* Port not yet listening — keep polling */ }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null; // Timed out
}

/**
 * Call Local's internal GraphQL API to start or stop a site.
 * Resolves with the response data object, or rejects on network / GraphQL error.
 * @param {'startSite'|'stopSite'} mutation
 * @param {string} siteId - LocalWP site id (e.g. "fNRcJtRcd")
 * @returns {Promise<Record<string, unknown>>}
 */
function msc_callLocalGraphql(mutation, siteId) {
  return new Promise((resolve, reject) => {
    const gqlInfo = msc_readLocalGraphqlInfo();
    if (!gqlInfo) return reject(new Error('Local GraphQL connection info not found — is Local GUI open?'));

    const body = JSON.stringify({ query: `mutation { ${mutation}(id: "${siteId}") { id name status } }` });
    const parsed = new URL(gqlInfo.url);
    const options = {
      hostname: parsed.hostname,
      port: Number(parsed.port) || 4000,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${gqlInfo.authToken}`,
        'apollo-require-preflight': 'true',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors && json.errors.length > 0) {
            return reject(new Error(json.errors[0].message));
          }
          resolve(json.data || {});
        } catch (e) {
          reject(new Error(`GraphQL parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GraphQL request timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * WordPress path traversal: step back out of generic WP subdirectories (public, app, htdocs…)
 * to find the real project name used as the LocalWP site slug.
 * Example: D:\TalkShowLand_v1\app\public → "talkshowlandv1"
 *
 * @param {string} filePath — absolute folder path stored in the project registry
 * @returns {string} lowercase alphanumeric slug (empty string if nothing useful found)
 */
function msc_wpSiteSlugFromPath(filePath) {
  const WP_GENERIC_SUBDIRS = new Set(['public', 'app', 'htdocs', 'www', 'web', 'html']);
  let folderName = path.basename(filePath);
  if (WP_GENERIC_SUBDIRS.has(folderName.toLowerCase())) {
    const parent = path.basename(path.dirname(filePath));
    if (parent && WP_GENERIC_SUBDIRS.has(parent.toLowerCase())) {
      const grandparent = path.basename(path.dirname(path.dirname(filePath)));
      folderName = grandparent || folderName;
    } else {
      folderName = parent || folderName;
    }
  }
  return folderName.replace(/[^a-z0-9]/gi, '').toLowerCase();
}
/** No TCP/connect failures persisted to SQLite until elapsed — avoids false red “Offline” while Next/boot compiles. */
const MSC_STARTUP_GRACE_MS = 20000;
const MSC_STARTUP_MAX_CONSECUTIVE_HEALTH_FAILS = 6;
/** v1.2.3 — first HTTP health probe after auto `install && dev` pipeline (npm install can run long). */
const MSC_HEALTH_FIRST_INSTALL_MS = 10000;

/**
 * JEDI_MOD_136 — no real dev tree on disk: HTTP probes must not flip cards to ERROR / safety-kill the shell.
 * @param {Record<string, unknown>} row
 */
function msc_shouldHarmonizeHttpProbe(row) {
  const p = String(row?.path ?? '').trim();
  if (!p) return true;
  if (!msc_registryProjectRootExists(p)) return true;
  try {
    const root = msc_normalizePersistedProjectPath(p);
    return !fs.existsSync(path.join(root, 'package.json'));
  } catch {
    return true;
  }
}

/**
 * @param {string} projectRoot
 * @returns {{ needsAutoInstall: boolean, v0Prototype: boolean, hasPkg: boolean }}
 */
function msc_analyzeDependencyBootstrap(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  const nmPath = path.join(projectRoot, 'node_modules');
  const v0UiPath = path.join(projectRoot, 'components', 'ui');
  const hasPkg = fs.existsSync(pkgPath);
  const hasNm = fs.existsSync(nmPath);
  const v0Prototype =
    hasPkg && !hasNm && fs.existsSync(v0UiPath);
  const needsAutoInstall = hasPkg && !hasNm;
  return { needsAutoInstall, v0Prototype, hasPkg };
}

/**
 * Shell one-liner: install then run dev/start script (v0 zero-config bootstrap).
 */
function msc_shellInstallThenDev(row) {
  const script = (row.start_script || 'dev').toString();
  const pm = row.pkg_manager || 'npm';
  if (pm === 'yarn') return `yarn install && yarn run ${script}`;
  if (pm === 'pnpm') return `pnpm install && pnpm run ${script}`;
  return `npm install && npm run ${script}`;
}

function msc_spawnShellCommand(command, cwd, env) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      cwd,
      env,
      windowsHide: true,
    });
  }
  return spawn('/bin/sh', ['-c', command], { cwd, env });
}

class MSC_ProjectRunner extends EventEmitter {
  /**
   * @param {import('electron').BrowserWindow | null} mainWindow
   * @param store SqlitePersistence | JsonPersistence
   */
  constructor(mainWindow, store) {
    super();
    this.mainWindow = mainWindow;
    this.store = store;
    /** @type {Map<string, { dev?: import('child_process').ChildProcess, build?: import('child_process').ChildProcess, healthPollTimer?: NodeJS.Timeout, healthStartedAt?: number, healthFailCount?: number, watchdogEnabled?: boolean, restartAttempts?: number[], wpLocal?: boolean }>} */
    this.children = new Map();
    /** Serialize HTTP health checks across projects (one in flight). */
    this._healthProbeChain = Promise.resolve();
  }

  setMainWindow(win) {
    this.mainWindow = win;
  }

  _broadcast(channel, payload) {
    const w = this.mainWindow;
    if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {
      w.webContents.send(channel, payload);
    }
  }

  _persistAndBroadcastLog(projectId, level, message) {
    const ts = new Date().toISOString();
    this.store.insertLog(projectId, ts, level, message);
    this._broadcast('vpe:log-update', {
      projectId,
      timestamp: ts,
      level,
      message,
    });
  }

  _emitProjectsRefresh() {
    const rows =
      typeof this.store.listProjectsAlphabetical === 'function'
        ? this.store.listProjectsAlphabetical()
        : this.store.getProjects();
    this._broadcast('vpe:projects-updated', {
      projects: rows.map((row) => msc_ipcEnrichProjectsRow(row)),
    });
  }

  _queueHealthProbe(fn) {
    const run = async () => {
      try {
        await fn();
      } catch (_) {
        /* ignore */
      }
    };
    const p = this._healthProbeChain.then(run, run);
    this._healthProbeChain = p.catch(() => {});
    return p;
  }

  _clearHealthPolling(projectId) {
    const rec = this.children.get(projectId);
    if (rec?.healthPollTimer) {
      clearTimeout(rec.healthPollTimer);
      rec.healthPollTimer = undefined;
    }
  }

  async _healthPollCycle(projectId) {
    const rec = this.children.get(projectId);
    if (!rec?.dev) return;
    if (rec.healthPollTimer) {
      clearTimeout(rec.healthPollTimer);
      rec.healthPollTimer = undefined;
    }

    let row = this.store.getProject(projectId);
    if (!row) return;

    await this._queueHealthProbe(async () => {
      const r = this.children.get(projectId);
      if (!r?.dev) return;
      row = this.store.getProject(projectId);
      if (!row) return;

      const { statusCode, reachedServer } = await msc_probeHttpHealth(row.port);
      const code = typeof statusCode === 'number' ? statusCode : null;
      const ts = new Date().toISOString();
      const rActive = this.children.get(projectId);
      const elapsedSinceStart =
        Date.now() - (rActive?.healthStartedAt || Date.now());
      const pastStartupGrace = elapsedSinceStart >= MSC_STARTUP_GRACE_MS;
      const harmonizeHttp = msc_shouldHarmonizeHttpProbe(row);
      // HTTP response (any code): always persist so redirects/503 show truthfully.
      if (reachedServer) {
        this.store.setProjectHealth(projectId, code, ts, true);
      } else if (pastStartupGrace) {
        if (harmonizeHttp) {
          this.store.setProjectHealth(projectId, null, ts, null);
        } else {
          this.store.setProjectHealth(projectId, null, ts, false);
        }
      }
      // Before grace ends, TCP/connect failures-only: leave DB health cleared → UI stays “Booting…”
      const failedProbe = !reachedServer;
      const activeRec = this.children.get(projectId);
      if (activeRec) {
        activeRec.healthFailCount = failedProbe
          ? Number(activeRec.healthFailCount || 0) + 1
          : 0;
      }
      let msg;
      let lvl = 'info';
      if (!reachedServer) {
        msg = `[vpe] health probe: no TCP/HTTP response on ${row.port} (offline or still compiling)`;
        lvl = pastStartupGrace && !harmonizeHttp ? 'warn' : 'info';
      } else if (code != null && code >= 500) {
        msg = `[vpe] health probe: HTTP ${code} (server error)`;
        lvl = 'warn';
      } else if (code != null && code >= 200 && code < 300) {
        msg = `[vpe] health probe: HTTP ${code}`;
        lvl = 'info';
      } else {
        msg = `[vpe] health probe: HTTP ${code}`;
        lvl = 'warn';
      }
      this._persistAndBroadcastLog(projectId, lvl, msg);

      // Safety guard: only terminate if startup grace has passed AND repeated health probes failed.
      if (activeRec?.dev) {
        const elapsed = Date.now() - (activeRec.healthStartedAt || Date.now());
        const failCount = Number(activeRec.healthFailCount || 0);
        if (
          elapsed >= MSC_STARTUP_GRACE_MS &&
          failCount >= MSC_STARTUP_MAX_CONSECUTIVE_HEALTH_FAILS &&
          activeRec.dev.pid &&
          !msc_shouldHarmonizeHttpProbe(row)
        ) {
          this._persistAndBroadcastLog(
            projectId,
            'warn',
            `[vpe] safety stop: ${failCount} consecutive failed health probes after ${Math.round(elapsed / 1000)}s`,
          );
          treeKill(activeRec.dev.pid, 'SIGTERM', () => {});
          return;
        }
      }

      this._emitProjectsRefresh();
    });

    const r2 = this.children.get(projectId);
    if (r2?.dev) {
      const elapsed = Date.now() - (r2.healthStartedAt || Date.now());
      const delay = msc_healthPollDelayMs(elapsed);
      r2.healthPollTimer = setTimeout(() => {
        void this._healthPollCycle(projectId);
      }, delay);
    }
  }

  _attachChildStreams(row, child, mode, opts = {}) {
    const { installBootstrapRec } = opts;
    const npmReady =
      /(next dev|next-server|ready - started|Local:\s*http|▲ Next\.js|vite v\d|compiled \S+ in|✓\s*(Ready|Starting))/i;

    const flushLines = (bufRef, chunk, streamLevel) => {
      bufRef.buf += chunk.toString('utf8');
      const lines = bufRef.buf.split(/\r?\n/);
      bufRef.buf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line) continue;
        if (
          installBootstrapRec &&
          installBootstrapRec.installBootstrap &&
          npmReady.test(line)
        ) {
          this._broadcast('vpe:bootstrap-dev-visible', { projectId: row.id });
          installBootstrapRec.installBootstrap = false;
        }
        const lvl = streamLevel === 'stderr' ? 'warn' : 'info';
        this._persistAndBroadcastLog(row.id, lvl, line);
      }
    };

    const outBuf = { buf: '' };
    const errBuf = { buf: '' };

    child.stdout?.on('data', (d) => flushLines(outBuf, d, 'stdout'));
    child.stderr?.on('data', (d) => flushLines(errBuf, d, 'stderr'));

    child.on('error', (err) => {
      this._persistAndBroadcastLog(
        row.id,
        'error',
        `[vpe] spawn error: ${err?.message ?? err}`,
      );
      this.emit('error', { projectId: row.id, mode, err });
    });

    child.on('close', (code, signal) => {
      const tail = (outBuf.buf + errBuf.buf).trim();
      if (tail) {
        this._persistAndBroadcastLog(row.id, 'info', tail);
      }
      this._persistAndBroadcastLog(
        row.id,
        code === 0 ? 'info' : 'warn',
        `[vpe] ${mode} process exited (code ${code}, signal ${signal ?? 'none'})`,
      );
      this.emit('exit', { projectId: row.id, mode, code, signal });
    });
  }

  _spawnScript(row, script, mode) {
    /** JEDI_MOD_135 — use persisted path as cwd; no package.json / existence gate (shell shows errors if invalid). */
    const cwd = msc_normalizePersistedProjectPath(row.path);
    const pm = row.pkg_manager || 'npm';
    const cmd =
      process.platform === 'win32'
        ? pm === 'yarn'
          ? 'yarn.cmd'
          : pm === 'pnpm'
            ? 'pnpm.cmd'
            : 'npm.cmd'
        : pm;
    const args = ['run', script];

    const configuredPort = Number(row.port);
    const env = this._projectChildEnv(row, configuredPort);

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env,
    });

    this._attachChildStreams(row, child, mode);
    return child;
  }

  /** `npm install && npm run <script>` (or yarn/pnpm). */
  _spawnInstallThenDevPipeline(row, installBootstrapRec) {
    const cwd = msc_normalizePersistedProjectPath(row.path);
    const configuredPort = Number(row.port);
    const env = this._projectChildEnv(row, configuredPort);
    const command = msc_shellInstallThenDev(row);
    const child = msc_spawnShellCommand(command, cwd, env);
    this._attachChildStreams(row, child, 'dev', { installBootstrapRec });
    return child;
  }

  _projectChildEnv(row, configuredPort) {
    const env = { ...process.env, FORCE_COLOR: '1' };
    if (Number.isFinite(configuredPort) && configuredPort > 0) {
      env.PORT = String(configuredPort);
      env.NEXT_PORT = String(configuredPort);
      env.DEV_PORT = String(configuredPort);
    }
    return env;
  }

  _assertPortConfigured(portLike) {
    const parsed = Number(portLike);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('VPE: Invalid project port. Use a managed port above the launcher UI (e.g. 3001).');
    }
    if (parsed === MSC_VPE_RENDERER_PORT) {
      throw new Error(
        `VPE: Port ${parsed} is reserved for Node-Launcher UI. Choose another port.`,
      );
    }
    return parsed;
  }

  _isPortInUse(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      let settled = false;
      const done = (inUse) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch (_) {
          /* ignore */
        }
        resolve(inUse);
      };
      socket.setTimeout(350);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
      socket.on('close', () => done(false));
    });
  }

  async _forceReleasePortWindows(port) {
    if (process.platform !== 'win32') return;
    const p = Number(port);
    if (!Number.isFinite(p) || p <= 0) return;
    try {
      const stdout = execSync(`netstat -ano | findstr :${p}`, {
        windowsHide: true,
      }).toString();
      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const killed = new Set();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const proto = parts[0] || '';
        const localAddress = parts[1] || '';
        const pid = parts[parts.length - 1];
        // netstat shape:
        // TCP 127.0.0.1:3006 0.0.0.0:0 LISTENING 9572
        // TCP [::1]:3006 [::1]:51500 ESTABLISHED 9572
        // Guard to only kill processes owning this exact local port.
        if (!/^tcp/i.test(proto)) continue;
        if (!new RegExp(`:${p}$`).test(localAddress)) continue;
        if (!pid || pid === '0' || Number.isNaN(Number(pid)) || killed.has(pid)) continue;
        try {
          execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
          killed.add(pid);
          console.log(`[VPE] Force-killed ghost process ${pid} on Port ${p}`);
        } catch (_) {
          // Kill failed silently; preflight will still re-check the port.
        }
      }
    } catch (_) {
      // Port clear or netstat/findstr did not match.
    }
    // Last-resort cleanup if the port is still occupied by a lingering node process.
    const stillInUse = await this._isPortInUse(p);
    if (stillInUse) {
      try {
        execSync('taskkill /F /IM node.exe', { windowsHide: true, stdio: 'ignore' });
        console.warn(`[VPE] Last-resort cleanup: taskkill /F /IM node.exe (port ${p} still occupied)`);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async _runDevPreflight(row) {
    /** JEDI_MOD_135 — port + script hints only; cwd is not validated for disk/package.json here. */
    const projectRoot = msc_normalizePersistedProjectPath(row.path);
    const port = this._assertPortConfigured(row.port);
    this._assertScriptPortCompatibility(projectRoot, row, port);
    let inUse = await this._isPortInUse(port);
    if (inUse) {
      await this._forceReleasePortWindows(port);
      inUse = await this._isPortInUse(port);
    }
    if (inUse) {
      throw new Error(
        [
          `VPE: Port ${port} is already in use.`,
          `Stop the process using ${port} or pick another project port in Settings.`,
        ].join(' '),
      );
    }
  }

  _assertScriptPortCompatibility(projectRoot, row, configuredPort) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (_) {
      return;
    }
    const scripts =
      packageJson && typeof packageJson.scripts === 'object'
        ? packageJson.scripts
        : {};
    const scriptName = row.start_script || 'dev';
    const command = typeof scripts[scriptName] === 'string' ? scripts[scriptName] : '';
    if (!command) return;
    const m = command.match(/(?:^|\s)(?:-p|--port)\s*(?:=)?\s*(\d{2,5})(?:\s|$)/i);
    if (!m || !m[1]) return;
    const scriptPort = Number(m[1]);
    if (!Number.isFinite(scriptPort) || scriptPort <= 0) return;
    if (scriptPort !== configuredPort) {
      throw new Error(
        [
          `VPE: Start script "${scriptName}" hardcodes port ${scriptPort} but project is configured for ${configuredPort}.`,
          `Update package.json script or set project port to ${scriptPort}.`,
        ].join(' '),
      );
    }
  }

  getRow(projectId) {
    const row = this.store.getProject(projectId);
    if (!row) throw new Error('Project not found');
    return row;
  }

  async startDev(row) {
    let rec = this.children.get(row.id);
    if (!rec) {
      rec = {};
      this.children.set(row.id, rec);
    }
    if (rec.dev) {
      throw new Error('Dev process already running for this project');
    }

    // ── WordPress-Local: headless environment lift (bypasses PTY, port, package.json checks) ──
    if (row.project_type === 'wordpress-local') {
      return this._startWordPressLocal(row, rec);
    }
    // ─────────────────────────────────────────────────────────────────────────────────────────

    await this._runDevPreflight(row);

    const projectRoot = msc_normalizePersistedProjectPath(row.path);
    const boot = msc_analyzeDependencyBootstrap(projectRoot);
    let installBootstrap = false;

    // JEDI_MOD_24: Initialize watchdog from the project row
    const watchdogFromRow = row.watchdog_enabled === 1 || row.watchdog_enabled === true;
    rec.watchdogEnabled = watchdogFromRow;
    if (!rec.restartAttempts) rec.restartAttempts = [];

    /** @type {{ installing?: boolean, projectKind?: string }} */
    const extra = {};

    /** @type {import('child_process').ChildProcess} */
    let child;

    if (boot.needsAutoInstall) {
      installBootstrap = true;
      rec.installBootstrap = true;
      if (boot.v0Prototype) {
        this._persistAndBroadcastLog(
          row.id,
          'info',
          '[VPE] v0 project detected. Missing dependencies. Launching msc_autoRepairInstaller...',
        );
        extra.installing = true;
        extra.projectKind = 'v0-prototype';
      } else {
        this._persistAndBroadcastLog(
          row.id,
          'info',
          '[VPE] Missing node_modules. Running install before dev (`npm install && npm run …`).',
        );
        extra.installing = true;
      }
      child = this._spawnInstallThenDevPipeline(row, rec);
    } else {
      this._persistAndBroadcastLog(
        row.id,
        'info',
        `[vpe] starting dev (${row.pkg_manager} run ${row.start_script})`,
      );
      child = this._spawnScript(row, row.start_script, 'dev');
    }

    rec.dev = child;
    rec.healthFailCount = 0;

    this.store.setProjectRunning(row.id);
    this.store.clearProjectHealth(row.id);
    this._emitProjectsRefresh();

    rec.healthStartedAt = Date.now();
    const firstProbeMs =
      installBootstrap ? MSC_HEALTH_FIRST_INSTALL_MS : MSC_HEALTH_FIRST_MS;
    rec.healthPollTimer = setTimeout(() => {
      void this._healthPollCycle(row.id);
    }, firstProbeMs);

    child.on('close', (code, signal) => {
      const r = this.children.get(row.id);
      if (!r || r.dev !== child) return;

      const isUnexpectedExit = code !== 0 && code !== null;
      const watchdogActive = !!r.watchdogEnabled;

      if (watchdogActive && isUnexpectedExit) {
        // Watchdog Logic: Check for infinite loop (max 3 restarts in 60s)
        const now = Date.now();
        if (!r.restartAttempts) r.restartAttempts = [];
        r.restartAttempts = r.restartAttempts.filter(ts => now - ts < 60000);

        if (r.restartAttempts.length < 3) {
          r.restartAttempts.push(now);
          this._persistAndBroadcastLog(
            row.id,
            'warn',
            `[vpe] Watchdog: Project exited unexpectedly (code ${code}). Auto-restarting in 2s... (Attempt ${r.restartAttempts.length}/3)`,
          );

          // UI Feedback: Notify renderer of auto-restart
          this._broadcast('vpe:project-watchdog-restart', { 
            projectId: row.id, 
            attempt: r.restartAttempts.length 
          });

          // Delay restart
          setTimeout(() => {
            const currentRec = this.children.get(row.id);
            if (currentRec && !currentRec.dev) {
              void this.startDev(row);
            }
          }, 2000);
          
          return; // Exit early, don't set to stopped yet
        } else {
          this._persistAndBroadcastLog(
            row.id,
            'error',
            `[vpe] Watchdog: Max restart attempts (3) reached within 60s. Disabling watchdog for this session.`,
          );
          r.watchdogEnabled = false;
        }
      }

      this._clearHealthPolling(row.id);
      r.dev = undefined;
      r.healthFailCount = 0;
      r.installBootstrap = false;
      this.store.clearProjectHealth(row.id);
      this.store.setProjectStopped(row.id);
      this._emitProjectsRefresh();
    });

    this.emit('start', {
      projectId: row.id,
      mode: 'dev',
      installing: !!extra.installing,
      projectKind: extra.projectKind,
    });
    return { ok: true, status: 'running', ...extra };
  }

  stopDev(projectId) {
    const rec = this.children.get(projectId);

    // ── WordPress-Local: headless environment teardown ──
    // Route to WordPress stop handler if:
    //  a) the project was started in this session (rec.wpLocal === true), OR
    //  b) this is a wordpress-local project and the rec is missing (VPE restarted while
    //     the site was running) — initialise a fresh rec so the handler can run cleanly.
    if (rec?.wpLocal) {
      return this._stopWordPressLocal(projectId, rec);
    }
    if (!rec) {
      const row = this.store.getProject(projectId);
      if (row && row.project_type === 'wordpress-local') {
        const freshRec = {};
        this.children.set(projectId, freshRec);
        return this._stopWordPressLocal(projectId, freshRec);
      }
    }
    // ───────────────────────────────────────────────────

    if (!rec?.dev) {
      this.store.clearProjectHealth(projectId);
      this.store.setProjectStopped(projectId);
      if (rec) rec.installBootstrap = false;
      this._emitProjectsRefresh();
      return { ok: true, status: 'stopped' };
    }

    this._clearHealthPolling(projectId);
    const pid = rec.dev.pid;
    this._persistAndBroadcastLog(
      projectId,
      'info',
      `[vpe] stopping dev (pid ${pid})`,
    );
    treeKill(pid, 'SIGTERM', () => {});
    rec.dev = undefined;
    rec.installBootstrap = false;
    this.store.clearProjectHealth(projectId);
    this.store.setProjectStopped(projectId);
    this._emitProjectsRefresh();
    this.emit('stop', { projectId, mode: 'dev' });
    return { ok: true, status: 'stopped' };
  }

  /**
   * LocalWP headless start.
   *
   * Strategy (tried in order):
   *  1. Local GraphQL API  — preferred; works when Local GUI is open; reads auth
   *     token from %APPDATA%\Roaming\Local\graphql-connection-info.json.
   *  2. local.exe / Local.exe CLI — fallback; works with pre-v10 builds or when
   *     Local.exe single-instance pass-through is active.
   *  3. Graceful no-op — logs a message telling the user to start in Local GUI.
   *
   * In all paths the mu-plugin is written first so WordPress stops redirecting
   * HTTP → HTTPS, and the nginx port from sites.json is stored on `rec` for the
   * health poll and the OPEN button.
   *
   * @param {Record<string, unknown>} row
   * @param {Record<string, unknown>} rec
   */
  _startWordPressLocal(row, rec) {
    const localExePath = msc_findLocalExePath();
    const localExe = localExePath ? `"${localExePath}"` : null;
    const siteSlug =
      (typeof row.slug === 'string' && row.slug.trim()) ||
      msc_wpSiteSlugFromPath(String(row.path || '')) ||
      String(row.name);
    const id = String(row.id);

    // Resolve the site's nginx port and domain from LocalWP's sites.json.
    const siteEntry = msc_findLocalWpSiteBySlug(siteSlug);
    const nginxPort = siteEntry ? msc_getLocalWpNginxPort(siteEntry) : null;
    const domain = (siteEntry && typeof siteEntry.domain === 'string' && siteEntry.domain)
      ? siteEntry.domain
      : `${siteSlug}.local`;

    // Write the http:// mu-plugin BEFORE starting so WordPress never redirects to https.
    const wpRoot = msc_normalizePersistedProjectPath(row.path);
    const muResult = msc_writeWpVpeMuPlugin(wpRoot, domain);
    if (muResult.ok && !muResult.skipped) {
      this._persistAndBroadcastLog(id, 'info',
        `[vpe] wordpress-local: WP_HOME/WP_SITEURL override written → http://${domain}`);
    } else if (!muResult.ok) {
      this._persistAndBroadcastLog(id, 'warn',
        `[vpe] wordpress-local: mu-plugin write failed (${muResult.error}) — browser may redirect to https`);
    }

    if (nginxPort) {
      this._persistAndBroadcastLog(id, 'info',
        `[vpe] wordpress-local: sites.json → nginx HTTP port ${nginxPort} (domain: ${domain})`);
    }

    // ── OPTIMISTIC STATE SEEDING (SYNCHRONOUS) ───────────────────────────────────
    rec.wpLocal   = true;
    rec.status    = 'running';
    rec.nginxPort = nginxPort;
    rec.wpDomain  = domain;
    this.store.setProjectRunning(id);
    this.store.setProjectHealth(id, 200, new Date().toISOString(), true);
    this._emitProjectsRefresh();
    this._persistAndBroadcastLog(id, 'info',
      `[vpe] wordpress-local: starting "${siteSlug}" (port ${nginxPort ?? '?'}) via GraphQL → Local.exe fallback`);
    // ─────────────────────────────────────────────────────────────────────────────

    const afterStart = () => {
      this._startWpDomainHealthPoll(row, rec);
      this.emit('start', { projectId: id, mode: 'wordpress-local' });
    };

    // ── STRATEGY 1: Local GraphQL API with resilient startup polling ─────────────────────────
    // graphql-connection-info.json persists on disk across reboots, so we MUST probe the
    // actual TCP socket — not just check file existence — to know if Local GUI is running.
    // Cold-start timeout: 120 × 500 ms = 60 s (Local can take 30-45 s on first launch).
    const siteEntry2 = siteEntry; // already resolved above
    const localSiteId = siteEntry2 && siteEntry2.id ? String(siteEntry2.id) : null;

    const doGraphQL = () => {
      msc_callLocalGraphql('startSite', localSiteId)
        .then((data) => {
          if (!rec.wpLocal) return;
          const status = data?.startSite?.status ?? 'unknown';
          this._persistAndBroadcastLog(id, 'info',
            `[vpe] wordpress-local: Local GraphQL startSite → status: ${status}`);
          afterStart();
        })
        .catch((gqlErr) => {
          if (!rec.wpLocal) return;
          this._persistAndBroadcastLog(id, 'warn',
            `[vpe] wordpress-local: GraphQL startSite failed (${gqlErr?.message ?? gqlErr}) — trying Local.exe CLI`);
          this._startWordPressLocalViaCli(id, siteSlug, localExe, rec, afterStart);
        });
    };

    // All async startup logic is isolated in a self-contained runner so any unhandled
    // TypeError / null-deref is caught and funnelled through the CLI fallback path.
    const runStartupAsync = async () => {
      // Real socket probe — guards against stale graphql-connection-info.json.
      const localAlreadyRunning = await msc_isLocalGraphqlListening();

      if (localSiteId) {
        if (localAlreadyRunning) {
          this._persistAndBroadcastLog(id, 'info',
            '[vpe] wordpress-local: Local GraphQL socket verified — sending startSite…');
          doGraphQL();
        } else {
          this._persistAndBroadcastLog(id, 'info',
            '[vpe] wordpress-local: Local GUI not detected — launching minimized…');
          if (localExePath) {
            this._persistAndBroadcastLog(id, 'info',
              `[vpe] wordpress-local: Local.exe path → ${localExePath}`);
          }
          msc_launchLocalMinimized(localExePath);
          // Poll up to 60 s for Local's GraphQL server to wake up.
          const gqlInfo = await msc_waitForLocalGraphql(120, 500);
          if (!rec.wpLocal) return;
          if (gqlInfo) {
            this._persistAndBroadcastLog(id, 'info',
              '[vpe] wordpress-local: Local GraphQL ready — sending startSite…');
            doGraphQL();
          } else {
            this._persistAndBroadcastLog(id, 'warn',
              '[vpe] wordpress-local: Local GUI did not become ready within 60 s — trying CLI fallback');
            this._startWordPressLocalViaCli(id, siteSlug, localExe, rec, afterStart);
          }
        }
      } else {
        // No LocalWP site id in sites.json — launch Local if not running, then try CLI.
        if (!localAlreadyRunning) {
          this._persistAndBroadcastLog(id, 'info',
            '[vpe] wordpress-local: site not in sites.json — launching Local minimized…');
          msc_launchLocalMinimized(localExePath);
        }
        this._persistAndBroadcastLog(id, 'warn',
          '[vpe] wordpress-local: site not found in sites.json — skipping GraphQL, trying CLI');
        this._startWordPressLocalViaCli(id, siteSlug, localExe, rec, afterStart);
      }
    };

    runStartupAsync().catch((err) => {
      if (!rec.wpLocal) return;
      this._persistAndBroadcastLog(id, 'error',
        `[vpe] wordpress-local: startup exception — ${err?.message ?? String(err)} — falling back to CLI`);
      this._startWordPressLocalViaCli(id, siteSlug, localExe, rec, afterStart);
    });

    return { ok: true, status: 'running', projectKind: 'wordpress-local' };
  }

  /** Internal: CLI fallback for starting a LocalWP site via local.exe / Local.exe. */
  _startWordPressLocalViaCli(id, siteSlug, localExe, rec, afterStart) {
    if (!localExe) {
      this._persistAndBroadcastLog(id, 'warn',
        '[vpe] wordpress-local: local.exe not found. Open Local by Flywheel, start the site there — VPE will detect it.');
      afterStart();
      return;
    }

    const routerCmd = `${localExe} router start`;
    this._persistAndBroadcastLog(id, 'info', '[vpe] wordpress-local: CLI step 1 — router start');

    exec(routerCmd, { windowsHide: true }, (routerErr) => {
      if (routerErr && (routerErr.code === 'ENOENT' || routerErr.code === 'EACCES')) {
        this._persistAndBroadcastLog(id, 'warn',
          `[vpe] wordpress-local: router start OS error (${routerErr.code}) — continuing`);
      }

      setTimeout(() => {
        if (!rec.wpLocal) return;
        const siteCmd = `${localExe} start-site ${siteSlug}`;
        this._persistAndBroadcastLog(id, 'info', `[vpe] wordpress-local: CLI step 2 — start-site ${siteSlug}`);

        exec(siteCmd, { windowsHide: true }, (err, stdout, stderr) => {
          if (err && (err.code === 'ENOENT' || err.code === 'EACCES')) {
            this._persistAndBroadcastLog(id, 'error',
              `[VPE CRITICAL ERROR] local.exe inaccessible — ${err.message}`);
            rec.wpLocal = false;
            this.store.clearProjectHealth(id);
            this.store.setProjectStopped(id);
            this._emitProjectsRefresh();
            return;
          }
          if (stdout && stdout.trim()) this._persistAndBroadcastLog(id, 'info', `[local.exe] ${stdout.trim()}`);
          if (stderr && stderr.trim()) this._persistAndBroadcastLog(id, 'warn', `[local.exe stderr] ${stderr.trim()}`);
          afterStart();
        });
      }, 1800);
    });
  }

  /**
   * Background network poll that validates the WordPress domain is reachable.
   * Makes up to 10 requests at 3-second intervals against the `project_url`.
   *
   * Hardening additions:
   *  • `rejectUnauthorized: false` — LocalWP issues self-signed Windows certificates
   *    that Node's default TLS stack rejects. We trust the local loopback domain.
   *  • HTTP fallback probe — if the https:// attempt fails with a connection error,
   *    immediately retries against http:// (some LocalWP configs serve both ports).
   *
   * Any HTTP response (200/301/302/403/500) confirms the server stack is alive.
   * On total failure after all attempts, logs a diagnostic warning but KEEPS the
   * running state — the user must explicitly click STOP.
   *
   * @param {Record<string, unknown>} row
   * @param {Record<string, unknown>} rec
   */
  _startWpDomainHealthPoll(row, rec) {
    const rawUrl = String(row.project_url || '').trim();
    const domainUrl =
      rawUrl ||
      `https://${
        msc_wpSiteSlugFromPath(String(row.path || '')) ||
        String(row.name).toLowerCase().replace(/\s+/g, '-')
      }.local/`;

    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 3000;
    const PROBE_TIMEOUT_MS = 5000;
    let attempt = 0;
    const id = String(row.id);

    /**
     * Fire a single HTTP/S request against `targetUrl`.
     * On success → persist health + stop poll.
     * On error   → optionally run `onError()` callback.
     */
    const fireRequest = (targetUrl, onError) => {
      let parsed;
      try {
        parsed = new URL(targetUrl);
      } catch {
        this._persistAndBroadcastLog(id, 'warn', `[vpe] wordpress-local: invalid URL "${targetUrl}" — skipping probe`);
        if (onError) onError(new Error('invalid_url'));
        return;
      }

      const isHttps = parsed.protocol === 'https:';
      const mod = isHttps ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
        path: parsed.pathname || '/',
        method: 'GET',
        timeout: PROBE_TIMEOUT_MS,
        headers: { 'User-Agent': 'VPE-WPHealthProbe/1.0' },
        // LocalWP self-signed Windows certificates must not be rejected.
        rejectUnauthorized: false,
      };

      const req = mod.request(options, (res) => {
        const code = res.statusCode || 200;
        res.resume(); // Drain body to free socket.
        if (!rec.wpLocal) return;
        this.store.setProjectHealth(id, code, new Date().toISOString(), true);
        this._persistAndBroadcastLog(
          id,
          'info',
          `[vpe] wordpress-local: domain health confirmed — ${targetUrl} → HTTP ${code}`,
        );
        this._emitProjectsRefresh();
      });

      req.on('timeout', () => req.destroy());
      req.on('error', (err) => {
        if (onError) onError(err);
      });
      req.end();
    };

    const probe = () => {
      if (!rec.wpLocal) return;
      attempt++;

      // Primary probe against the configured/derived URL (may be https://).
      fireRequest(domainUrl, (primaryErr) => {
        if (!rec.wpLocal) return;

        // HTTP fallback: if primary is https and fails, also try http version.
        // LocalWP can serve on plain HTTP; self-signed cert rejections are overridden
        // above, but ERR_CONNECTION_REFUSED means the port itself isn't open yet.
        const httpFallback = domainUrl.startsWith('https://')
          ? domainUrl.replace(/^https:\/\//, 'http://')
          : null;

        const scheduleRetry = () => {
          if (!rec.wpLocal) return;
          if (attempt < MAX_ATTEMPTS) {
            this._persistAndBroadcastLog(
              id,
              'info',
              `[vpe] wordpress-local: domain probe ${attempt}/${MAX_ATTEMPTS} — not yet reachable, retrying in ${INTERVAL_MS / 1000}s…`,
            );
            rec.wpPollTimer = setTimeout(probe, INTERVAL_MS);
          } else {
            // Last-resort: try the direct nginx port if sites.json provided one.
            // The mu-plugin is in place so WordPress won't redirect on this host.
            const nginxPort = rec.nginxPort;
            if (nginxPort) {
              const directUrl = `http://localhost:${nginxPort}/`;
              this._persistAndBroadcastLog(id, 'info',
                `[vpe] wordpress-local: all domain probes failed — trying direct nginx port ${nginxPort}…`);
              fireRequest(directUrl, () => {
                this._persistAndBroadcastLog(id, 'warn',
                  `[vpe] wordpress-local: site unreachable on domain and on direct port ${nginxPort}. ` +
                  'Ensure Local by Flywheel is open and the site is running.');
                this._emitProjectsRefresh();
              });
            } else {
              this._persistAndBroadcastLog(id, 'warn',
                `[vpe] wordpress-local: domain unreachable after ${MAX_ATTEMPTS} probes — ${domainUrl}. ` +
                'Verify Local by Flywheel is running and the site is started.');
              this._emitProjectsRefresh();
            }
          }
        };

        if (httpFallback) {
          fireRequest(httpFallback, () => scheduleRetry());
        } else {
          scheduleRetry();
        }
      });
    };

    // First probe fires after the router + site warm-up completes (~4 s total with the
    // 1.8 s delay in _startWordPressLocal + a small additional buffer here).
    rec.wpPollTimer = setTimeout(probe, 2500);
  }

  /**
   * LocalWP headless stop — awaits the GraphQL `stopSite` mutation (or CLI fallback)
   * before returning so callers can reliably `await` full site teardown.
   *
   * @param {string} projectId
   * @param {Record<string, unknown>} rec
   * @returns {Promise<{ ok: boolean; status: string }>}
   */
  async _stopWordPressLocal(projectId, rec) {
    const row = this.store.getProject(projectId);
    const localExePath = msc_findLocalExePath();
    const siteSlug = row
      ? (typeof row.slug === 'string' && row.slug.trim()) ||
        msc_wpSiteSlugFromPath(String(row.path || '')) ||
        String(row.name)
      : projectId;
    const siteEntry2 = msc_findLocalWpSiteBySlug(siteSlug);

    this._persistAndBroadcastLog(projectId, 'info',
      `[vpe] wordpress-local: stopping environment — site "${siteSlug}"`);

    // Remove the VPE mu-plugin override so the WordPress install is left clean.
    if (row) {
      const wpRoot = msc_normalizePersistedProjectPath(row.path);
      const muResult = msc_removeWpVpeMuPlugin(wpRoot);
      if (muResult.ok && !muResult.skipped) {
        this._persistAndBroadcastLog(projectId, 'info',
          '[vpe] wordpress-local: WP_HOME/WP_SITEURL override removed (mu-plugin deleted)');
      } else if (!muResult.ok) {
        this._persistAndBroadcastLog(projectId, 'warn',
          `[vpe] wordpress-local: mu-plugin removal failed — ${muResult.error}`);
      }
    }

    // Tell Local to stop the site — await GraphQL preferred, CLI fallback.
    const localSiteId2 = (siteEntry2 && siteEntry2.id) ? String(siteEntry2.id) : null;
    if (localSiteId2) {
      try {
        const data = await msc_callLocalGraphql('stopSite', localSiteId2);
        const status = data?.stopSite?.status ?? 'unknown';
        this._persistAndBroadcastLog(projectId, 'info',
          `[vpe] wordpress-local: Local GraphQL stopSite → status: ${status}`);
      } catch (gqlErr) {
        this._persistAndBroadcastLog(projectId, 'warn',
          `[vpe] wordpress-local: GraphQL stopSite failed (${gqlErr.message}) — trying CLI`);
        if (localExePath) {
          await new Promise((resolve) => {
            exec(`"${localExePath}" stop-site ${siteSlug}`, { windowsHide: true }, () => resolve());
          });
        }
      }
    } else if (localExePath) {
      await new Promise((resolve) => {
        exec(`"${localExePath}" stop-site ${siteSlug}`, { windowsHide: true }, (err) => {
          if (err) {
            this._persistAndBroadcastLog(projectId, 'warn',
              `[vpe] wordpress-local: stop-site — ${err.message}`);
          }
          resolve();
        });
      });
    } else {
      this._persistAndBroadcastLog(projectId, 'info',
        '[vpe] wordpress-local: local.exe not found — stop the site in Local by Flywheel manually');
    }

    rec.wpLocal = false;
    rec.nginxPort = undefined;
    rec.wpDomain  = undefined;
    if (rec.wpPollTimer) {
      clearTimeout(rec.wpPollTimer);
      rec.wpPollTimer = undefined;
    }
    this.store.clearProjectHealth(projectId);
    this.store.setProjectStopped(projectId);
    this._emitProjectsRefresh();
    this.emit('stop', { projectId, mode: 'wordpress-local' });
    return { ok: true, status: 'stopped' };
  }

  async toggleStatus(projectId) {
    const row = this.getRow(projectId);
    const rec = this.children.get(projectId);
    // wpLocal flag marks a running wordpress-local environment (no PTY dev process).
    if (rec?.dev || rec?.wpLocal) {
      return this.stopDev(projectId);
    }
    return this.startDev(row);
  }

  runBuild(projectId) {
    const row = this.getRow(projectId);
    let rec = this.children.get(row.id);
    if (!rec) {
      rec = {};
      this.children.set(row.id, rec);
    }
    if (rec.build) {
      throw new Error('Build already running for this project');
    }

    this._persistAndBroadcastLog(
      row.id,
      'info',
      `[vpe] starting build (${row.pkg_manager} run ${row.build_script})`,
    );

    const child = this._spawnScript(row, row.build_script, 'build');
    rec.build = child;
    child.on('close', () => {
      const r = this.children.get(row.id);
      if (r) r.build = undefined;
    });
    this.emit('start', { projectId: row.id, mode: 'build' });
    return { ok: true };
  }

  /** Stops dev + build for one project (registry delete, app quit, etc.). */
  stopProject(projectId) {
    const rec = this.children.get(projectId);
    this._clearHealthPolling(projectId);
    if (rec?.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    if (rec?.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
    if (rec) {
      rec.dev = undefined;
      rec.build = undefined;
      rec.installBootstrap = false;
    }
    this.store.clearProjectHealth(projectId);
    this.store.setProjectStopped(projectId);
    this._emitProjectsRefresh();
    return { ok: true };
  }

  killAll() {
    for (const [, rec] of this.children) {
      if (rec.healthPollTimer) {
        clearTimeout(rec.healthPollTimer);
        rec.healthPollTimer = undefined;
      }
      if (rec.wpPollTimer) {
        clearTimeout(rec.wpPollTimer);
        rec.wpPollTimer = undefined;
      }
      rec.wpLocal = false;
      rec.installBootstrap = false;
      if (rec.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
      if (rec.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    }
    this.children.clear();
  }

  /**
   * Stop every running WordPress-Local site via GraphQL (+ mu-plugin cleanup),
   * then optionally minimize the Local by Flywheel window so it stays in the
   * background without a visible window stealing focus.
   *
   * Called by STOP ALL so LocalWP sites are cleanly halted alongside PM2/PTY
   * processes — `killAll()` only handles regular Node dev processes.
   *
   * @param {boolean} [minimizeLocal=true] — Minimize Local.exe after all sites stopped.
   * @returns {Promise<void>}
   */
  /**
   * Stop all running WordPress-Local sites in parallel, then optionally minimize
   * Local.exe (STOP ALL button) or leave it for the app-quit hook to terminate.
   *
   * Each stop is now fully awaited via `Promise.all` so callers (e.g. the
   * `before-quit` lifecycle hook) can reliably wait for all GraphQL `stopSite`
   * mutations to complete before tearing down the process tree.
   *
   * @param {boolean} [minimizeLocal=true] — `true` = minimize after stops (STOP ALL);
   *   `false` = skip minimize (app-quit path will taskkill Local.exe entirely instead).
   * @returns {Promise<void>}
   */
  async stopAllWordPressSites(minimizeLocal = true) {
    const allProjects = this.store.listProjectsAlphabetical();
    const wpRunning = allProjects.filter((p) => {
      const rec = this.children.get(p.id);
      return rec?.wpLocal === true;
    });

    // Run all site stops in parallel — each _stopWordPressLocal awaits its GraphQL call.
    await Promise.all(
      wpRunning.map(async (project) => {
        try {
          const rec = this.children.get(project.id) || {};
          await this._stopWordPressLocal(project.id, rec);
        } catch (err) {
          console.warn(`[VPE] stopAllWordPressSites: failed to stop ${project.id}`, err?.message);
        }
      }),
    );

    if (!minimizeLocal || wpRunning.length === 0 || !msc_isLocalExeProcessRunning()) return;

    try {
      // Minimize all Local.exe windows without closing the app (STOP ALL path).
      // SW_MINIMIZE = 6 via user32.dll ShowWindow.
      const minScript = [
        'Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;',
        'public class VpeWin32 {',
        '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmd);',
        '}\';',
        'Get-Process -Name Local -ErrorAction SilentlyContinue | ForEach-Object {',
        '  if ($_.MainWindowHandle -ne [IntPtr]::Zero) {',
        '    [VpeWin32]::ShowWindow($_.MainWindowHandle, 6) | Out-Null',
        '  }',
        '}',
      ].join(' ');
      execSync(`powershell -WindowStyle Hidden -Command "${minScript}"`,
        { windowsHide: true, timeout: 5000, stdio: 'ignore' },
      );
      console.log('[VPE] stopAllWordPressSites: Local.exe minimized');
    } catch (err) {
      console.warn('[VPE] stopAllWordPressSites: could not minimize Local.exe —', err?.message);
    }
  }
}

module.exports = MSC_ProjectRunner;
