'use strict';

/**
 * v1.2.0: fire-and-forget stall detector for `vader:post-dev-forge`.
 * If 3000/9222 remain bound shortly after forge prep starts, show a desktop hint.
 */

const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_WAIT_MS = 5000;

function msc_tryPortConnect(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    let done = false;
    const finish = (busy) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch (_) {
        /* */
      }
      resolve(busy);
    };
    sock.setTimeout(300);
    sock.on('connect', () => finish(true));
    sock.on('timeout', () => finish(false));
    sock.on('error', () => finish(false));
    sock.on('close', () => finish(false));
  });
}

function msc_windowsPopup(title, msg) {
  const escaped = msg.replace(/"/g, '""').replace(/\r?\n/g, '\n');
  const ps = `$o = New-Object -ComObject WScript.Shell; $o.Popup("${escaped}", 12, "${title.replace(/"/g, '""')}", 48)`;
  spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

async function msc_daemonMain() {
  const waitMs = Number(process.argv[3]) || DEFAULT_WAIT_MS;
  await new Promise((r) => setTimeout(r, waitMs));

  const p3000 = await msc_tryPortConnect(3000);
  const p9222 = await msc_tryPortConnect(9222);

  if (p3000 || p9222) {
    const ports = [];
    if (p3000) ports.push('3000');
    if (p9222) ports.push('9222');
    msc_windowsPopup(
      'VPE — Forge',
      [
        'Build blocked by Ghost Process.',
        `Ports still active: ${ports.join(', ')}.`,
        '',
        'Run: npm run vpe:force-clear',
      ].join('\n'),
    );
  }

  process.exit(p3000 || p9222 ? 2 : 0);
}

function msc_launchDetached() {
  const child = spawn(process.execPath, [__filename, 'daemon', String(DEFAULT_WAIT_MS)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

if (require.main === module) {
  if (process.argv[2] === 'daemon') {
    msc_daemonMain().catch(() => process.exit(1));
  } else if (process.argv[2] === 'launch') {
    msc_launchDetached();
    process.exit(0);
  } else {
    console.error('[vpe-forge-stall-watchdog] use: launch | daemon');
    process.exit(1);
  }
}
