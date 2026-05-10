/**
 * v1.6.0 — Factory defaults for VPE app settings (non-critical features **off**).
 * Main + renderer should align with these when a column / key is missing.
 */
const MSC_VPE_APP_SETTINGS_DEFAULTS = Object.freeze({
  launch_at_login: false,
  minimize_to_tray: false,
  auto_start_projects: false,
  /** v1.6.9 — `cinema` | `compact` | `list` (legacy `card` → cinema). */
  default_view: 'cinema',
  theme_accent: '#4fde82',
  /** v1.7.9 — UI font stack key (renderer maps to `--vpe-font-family`). */
  font_style: 'mulish_studio',
  /** v1.8.5 — persisted default port allocation window (inclusive). */
  port_range_start: 3000,
  port_range_end: 3020,
});

/**
 * @param {unknown} v
 * @returns {'cinema' | 'compact' | 'list'}
 */
function msc_normalizeDefaultView(v) {
  const s = v == null ? '' : String(v).trim().toLowerCase();
  if (s === 'list') return 'list';
  if (s === 'compact') return 'compact';
  if (s === 'cinema') return 'cinema';
  if (s === 'card') return 'cinema';
  return 'cinema';
}

/**
 * @param {unknown} v
 * @returns {'vpe_classic' | 'mulish_studio' | 'google_sans_modern' | 'noto_sans' | 'poppins'}
 */
function msc_normalizeFontStyle(v) {
  const s = v == null ? '' : String(v).trim().toLowerCase().replace(/-/g, '_');
  if (s === 'vpe_classic' || s === 'classic') return 'vpe_classic';
  if (s === 'google_sans_modern' || s === 'google_sans') return 'google_sans_modern';
  if (s === 'noto_sans' || s === 'noto') return 'noto_sans';
  if (s === 'poppins') return 'poppins';
  if (s === 'mulish_studio' || s === 'mulish') return 'mulish_studio';
  return 'mulish_studio';
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {typeof MSC_VPE_APP_SETTINGS_DEFAULTS & { minimize_to_tray: boolean, launch_at_login: boolean, auto_start_projects: boolean, default_view: 'cinema' | 'compact' | 'list', font_style: 'vpe_classic' | 'mulish_studio' | 'google_sans_modern' | 'noto_sans' | 'poppins' }}
 */
function msc_normalizeAppSettingsRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  const asBool = (v, def) => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    return def;
  };
  const dv = msc_normalizeDefaultView(r.default_view);
  const prs0 = Number(r.port_range_start);
  const pre0 = Number(r.port_range_end);
  let port_range_start = Number.isFinite(prs0)
    ? Math.floor(prs0)
    : MSC_VPE_APP_SETTINGS_DEFAULTS.port_range_start;
  let port_range_end = Number.isFinite(pre0)
    ? Math.floor(pre0)
    : MSC_VPE_APP_SETTINGS_DEFAULTS.port_range_end;
  port_range_start = Math.min(65535, Math.max(1024, port_range_start));
  port_range_end = Math.min(65535, Math.max(1024, port_range_end));
  if (port_range_end < port_range_start) port_range_end = port_range_start;
  return {
    theme_accent:
      typeof r.theme_accent === 'string' && r.theme_accent.trim()
        ? r.theme_accent.trim()
        : MSC_VPE_APP_SETTINGS_DEFAULTS.theme_accent,
    minimize_to_tray: asBool(r.minimize_to_tray, MSC_VPE_APP_SETTINGS_DEFAULTS.minimize_to_tray),
    launch_at_login: asBool(r.launch_at_login, MSC_VPE_APP_SETTINGS_DEFAULTS.launch_at_login),
    auto_start_projects: asBool(
      r.auto_start_projects,
      MSC_VPE_APP_SETTINGS_DEFAULTS.auto_start_projects,
    ),
    default_view: dv,
    font_style: msc_normalizeFontStyle(r.font_style),
    port_range_start,
    port_range_end,
  };
}

module.exports = {
  MSC_VPE_APP_SETTINGS_DEFAULTS,
  msc_normalizeAppSettingsRow,
  msc_normalizeDefaultView,
  msc_normalizeFontStyle,
};
