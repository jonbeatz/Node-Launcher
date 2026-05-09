/**
 * v1.6.0 — Factory defaults for VPE app settings (non-critical features **off**).
 * Main + renderer should align with these when a column / key is missing.
 */
const MSC_VPE_APP_SETTINGS_DEFAULTS = Object.freeze({
  launch_at_login: false,
  minimize_to_tray: false,
  auto_start_projects: false,
  /** Maps to dashboard card grid (`grid` in `useDashboardPersistedSettings`). */
  default_view: 'card',
  theme_accent: '#4fde82',
});

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {typeof MSC_VPE_APP_SETTINGS_DEFAULTS & { minimize_to_tray: boolean, launch_at_login: boolean, auto_start_projects: boolean, default_view: 'card' | 'list' }}
 */
function msc_normalizeAppSettingsRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  const asBool = (v, def) => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    return def;
  };
  const dv = r.default_view === 'list' ? 'list' : 'card';
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
  };
}

module.exports = {
  MSC_VPE_APP_SETTINGS_DEFAULTS,
  msc_normalizeAppSettingsRow,
};
