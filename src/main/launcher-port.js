/**
 * Electron shell / Next dev server URL port.
 * Uses only `VPE_RENDERER_PORT` — never `process.env.PORT`, which tooling often overrides.
 */
function msc_launcherRendererPort() {
  const n = parseInt(process.env.VPE_RENDERER_PORT ?? '3000', 10);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

module.exports = {
  msc_launcherRendererPort,
};
