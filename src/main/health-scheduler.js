/**
 * Backoff schedule for repeated HTTP health checks after dev starts.
 * Fast polling during boot (~30s), then slower steady-state probes.
 */

const MSC_HEALTH_FIRST_MS = 3000;
const MSC_HEALTH_BURST_MS = 2000;
const MSC_HEALTH_BURST_WINDOW_MS = 30000;
const MSC_HEALTH_STEADY_MS = 12000;

function msc_healthPollDelayMs(elapsedSinceStartMs) {
  const e =
    typeof elapsedSinceStartMs === 'number' && elapsedSinceStartMs >= 0
      ? elapsedSinceStartMs
      : 0;
  if (e < MSC_HEALTH_BURST_WINDOW_MS) return MSC_HEALTH_BURST_MS;
  return MSC_HEALTH_STEADY_MS;
}

module.exports = {
  msc_healthPollDelayMs,
  MSC_HEALTH_FIRST_MS,
};
