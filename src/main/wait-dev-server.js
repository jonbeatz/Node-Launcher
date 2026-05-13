const http = require('http');

/**
 * Poll until GET / on the launcher dev origin responds (any 2xx/3xx counts as ready).
 * Next.js briefly returns 404 on / during boot; accept that so we proceed and let the client hydrate.
 *
 * @param {string} origin e.g. http://localhost:3000
 * @param {{ maxAttempts?: number; intervalMs?: number; timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function msc_waitForDevServer(origin, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 120;
  const intervalMs = opts.intervalMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 2500;
  let u;
  try {
    u = new URL(origin.endsWith('/') ? origin.slice(0, -1) : origin);
  } catch {
    return false;
  }
  const port = u.port
    ? parseInt(u.port, 10)
    : u.protocol === 'https:'
      ? 443
      : 80;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: u.hostname,
          port,
          path: '/',
          method: 'GET',
          timeout: timeoutMs,
          headers: { Connection: 'close' },
        },
        (res) => {
          res.resume();
          const code = res.statusCode ?? 0;
          resolve(code > 0);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });

    if (ok) {
      if (attempt > 2) {
        console.log(`[VPE Main] Dev server responded at ${origin} (attempt ${attempt})`);
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn(`[VPE Main] Dev server not reachable at ${origin} after ${maxAttempts} attempts`);
  return false;
}

module.exports = { msc_waitForDevServer };
