/**
 * Host CPU busy % from `os.cpus()` tick deltas (idle vs total across all cores).
 * First call primes baseline and returns null so the UI can show "—" until the next poll (~3s).
 * Result is clamped to [0, 100]; non-finite deltas reuse the last good value.
 */
const os = require('os');

/** @type {{ idle: number, total: number } | null} */
let lastCpuSnapshot = null;
/** Last good reading when deltas are unreliable */
let lastCpuPercent = /** @type {number | null} */ (null);

function msc_sumCpuTicks() {
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  const cpus = os.cpus();
  if (!cpus?.length) return { idle: 0, total: 0 };

  for (const cpu of cpus) {
    const t = cpu.times;
    user += t.user;
    nice += t.nice;
    sys += t.sys;
    idle += t.idle;
    irq += t.irq || 0;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

/**
 * Host CPU busy % from kernel tick deltas (low overhead vs spawning PowerShell).
 * First invocation primes baseline and returns null; UI shows "—" until next poll (~3s).
 * @returns {number | null}
 */
function msc_hostCpuPercentSinceLastPoll() {
  const cur = msc_sumCpuTicks();

  if (!lastCpuSnapshot) {
    lastCpuSnapshot = cur;
    return null;
  }

  const idleDiff = cur.idle - lastCpuSnapshot.idle;
  const totalDiff = cur.total - lastCpuSnapshot.total;
  lastCpuSnapshot = cur;

  if (totalDiff <= 0) {
    return lastCpuPercent;
  }

  const busyRatio = 1 - idleDiff / totalDiff;
  const pct = Math.round(busyRatio * 100);
  if (!Number.isFinite(pct)) {
    return lastCpuPercent;
  }
  lastCpuPercent = Math.max(0, Math.min(100, pct));
  return lastCpuPercent;
}

module.exports = { msc_hostCpuPercentSinceLastPoll };
