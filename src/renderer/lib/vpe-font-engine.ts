'use client'

/**
 * v1.7.9+ — persisted in SQLite `settings.font_style`; drives `--vpe-font-family` + title metrics (v1.8.1).
 * v1.8.4 — App / Project settings modals and `Msc_ProjectCard` rely on `.vpe-theme-font` / inheritance;
 * avoid `font-sans` / inline `font-family` Tailwind on those surfaces so `--vpe-font-family` stays authoritative.
 */
export type VpeFontStyleKey =
  | 'vpe_classic'
  | 'mulish_studio'
  | 'google_sans_modern'
  | 'noto_sans'
  | 'poppins'

const STACK: Record<VpeFontStyleKey, string> = {
  vpe_classic:
    "'JetBrains Mono', ui-monospace, 'Cascadia Code', Consolas, monospace",
  mulish_studio:
    "'Mulish', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  /** Product-sans adjacency: Inter structure + Roboto (Google Fonts) — “Google Sans” is not licensed for general web. */
  google_sans_modern:
    "'Inter', 'Roboto', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  noto_sans:
    "'Noto Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  poppins:
    "'Poppins', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

/** Distinct title rhythm per stack so theme swaps are visibly different (v1.8.1). */
const TITLE: Record<VpeFontStyleKey, { weight: string; spacing: string }> = {
  vpe_classic: { weight: '600', spacing: '0' },
  mulish_studio: { weight: '700', spacing: '-0.03em' },
  google_sans_modern: { weight: '600', spacing: '-0.015em' },
  noto_sans: { weight: '600', spacing: '-0.02em' },
  poppins: { weight: '600', spacing: '-0.02em' },
}

export function msc_normalizeFontStyle(v: unknown): VpeFontStyleKey {
  const s = v == null ? '' : String(v).trim().toLowerCase().replace(/-/g, '_')
  if (s === 'vpe_classic' || s === 'classic') return 'vpe_classic'
  if (s === 'google_sans_modern' || s === 'google_sans') return 'google_sans_modern'
  if (s === 'noto_sans' || s === 'noto') return 'noto_sans'
  if (s === 'poppins') return 'poppins'
  if (s === 'mulish_studio' || s === 'mulish') return 'mulish_studio'
  return 'mulish_studio'
}

export function msc_applyVpeFontFamily(style: VpeFontStyleKey): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--vpe-font-family', STACK[style])
  const t = TITLE[style]
  root.style.setProperty('--vpe-title-font-weight', t.weight)
  root.style.setProperty('--vpe-title-letter-spacing', t.spacing)
}
