const http = require('http');

const MSC_PROBE_MS = Number(process.env.VPE_HEALTH_PROBE_MS) || 8000;

/** HTTP GET `/` on 127.0.0.1 with timeout; used after dev start. */
function msc_probeHttpHealth(port) {
  const p = Number(port);
  if (!Number.isFinite(p) || p <= 0) {
    return Promise.resolve({ statusCode: null, reachedServer: false });
  }

  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: p,
        path: '/',
        timeout: MSC_PROBE_MS,
        headers: { Connection: 'close' },
      },
      (res) => {
        res.resume();
        resolve({
          statusCode: typeof res.statusCode === 'number' ? res.statusCode : null,
          reachedServer: true,
        });
      },
    );
    req.on('error', () => resolve({ statusCode: null, reachedServer: false }));
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve({ statusCode: null, reachedServer: false });
    });
  });
}

module.exports = { msc_probeHttpHealth };
