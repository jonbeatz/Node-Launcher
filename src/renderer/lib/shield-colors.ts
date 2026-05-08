/** Shield accent colors — sidebar, list dot, tactical nav (VPE v1.2.6). */
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
    default:
      return '#f59e0b'
  }
}
