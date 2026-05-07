/** Persisted System_Log typography + buffer (Settings modal + LogDrawer). Drawer open/closed is not stored here. */

export const VPE_TERM_FONT_KEY = 'vpe.term.fontSize'
export const VPE_TERM_SCROLL_KEY = 'vpe.term.scrollback'

export function msc_getTerminalFontSize(): number {
  if (typeof window === 'undefined') return 13
  const n = parseInt(window.localStorage.getItem(VPE_TERM_FONT_KEY) || '13', 10)
  return Number.isFinite(n) ? Math.min(24, Math.max(10, n)) : 13
}

export function msc_getTerminalScrollback(): number {
  if (typeof window === 'undefined') return 1000
  const n = parseInt(window.localStorage.getItem(VPE_TERM_SCROLL_KEY) || '1000', 10)
  return Number.isFinite(n) ? Math.min(50_000, Math.max(100, n)) : 1000
}

export function msc_emitTerminalPrefsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('vpe-terminal-prefs'))
}
