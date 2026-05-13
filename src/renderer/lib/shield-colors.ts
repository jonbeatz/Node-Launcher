/** Solid-dot colors for tactical indicators (sidebar, cards, pills) — VPE v1.2.7 dot system */

export function msc_shieldColorHex(t?: string | null): string {
  switch (t) {
    case 'v0':
      return '#2563eb'
    case 'electron':
      return '#a855f7'
    case 'web':
      return '#4fde82'
    case 'node':
      return '#737373'
    case 'unknown':
      return '#00FFFF'
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
    case 'unknown':
      return 'Other / uncategorized'
    default:
      return 'Unknown manifest'
  }
}
