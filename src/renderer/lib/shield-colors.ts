/** Solid-dot colors for tactical indicators (sidebar, cards, pills) — VPE v2.2.6 high-contrast palette */

export function msc_shieldColorHex(t?: string | null): string {
  switch (t) {
    /** v0 Prototypes: Deep Cyberpunk Magenta/Pink */
    case 'v0':
      return '#ec4899'
    /** Desktop Apps (Electron): Bright Neon Amber/Yellow */
    case 'electron':
      return '#eab308'
    /** Web Engines (Next/React): Vivid Orange */
    case 'web':
      return '#f97316'
    /** Node.js Engines: Electric Green */
    case 'node':
      return '#22c55e'
    /** WordPress / Local by Flywheel: Rich Royal Blue */
    case 'wordpress':
    case 'wordpress-local':
      return '#2563eb'
    /** Other / uncategorized: Mid-Tone Slate Gray */
    case 'unknown':
      return '#64748b'
    default:
      return '#f59e0b'
  }
}

export function msc_shieldTypeTitle(t?: string | null): string {
  switch (t) {
    case 'v0':
      return 'v0 (components/ui)'
    case 'electron':
      return 'Electron'
    case 'web':
      return 'Web (Next/React)'
    case 'node':
      return 'Node'
    /** v2.1 — WordPress / Local by Flywheel */
    case 'wordpress':
    case 'wordpress-local':
      return 'WordPress (Local by Flywheel)'
    case 'unknown':
      return 'Other / uncategorized'
    default:
      return 'Unknown manifest'
  }
}
