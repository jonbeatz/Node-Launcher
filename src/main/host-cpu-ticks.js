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

  const pct = Math.round((1 - idleDiff / totalDiff) * 100);
  lastCpuPercent = Math.max(0, Math.min(100, pct));
  return lastCpuPercent;
}

module.exports = { msc_hostCpuPercentSinceLastPoll };
