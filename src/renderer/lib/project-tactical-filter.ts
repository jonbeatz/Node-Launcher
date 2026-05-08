/** Tactical project type filtering (shields) — used by dashboard + sidebar (v1.2.5+). */

export type VpeTacticalProjectFilter = 'all' | 'v0' | 'electron' | 'web' | 'node'

export interface VpeTacticalCounts {
  all: number
  v0: number
  electron: number
  web: number
  node: number
  unknown: number
}

export function msc_computeTacticalCounts(
  projects: { shield_project_type?: string | null }[],
): VpeTacticalCounts {
  const c: VpeTacticalCounts = {
    all: projects.length,
    v0: 0,
    electron: 0,
    web: 0,
    node: 0,
    unknown: 0,
  }
  for (const p of projects) {
    const t = (p.shield_project_type ?? 'unknown') as string
    if (t === 'v0') c.v0 += 1
    else if (t === 'electron') c.electron += 1
    else if (t === 'web') c.web += 1
    else if (t === 'node') c.node += 1
    else c.unknown += 1
  }
  return c
}

export function msc_applyTacticalProjectFilter<
  T extends { shield_project_type?: string | null },
>(projects: T[], filter: VpeTacticalProjectFilter): T[] {
  if (filter === 'all') return projects
  return projects.filter((p) => (p.shield_project_type ?? 'unknown') === filter)
}

/** Labels shared by `Msc_ProjectFilterNav` + sidebar (v1.2.5). */
export const VPE_TACTICAL_NAV_META: {
  id: VpeTacticalProjectFilter
  label: string
  countKey: keyof Pick<
    VpeTacticalCounts,
    'all' | 'v0' | 'electron' | 'web' | 'node'
  >
}[] = [
  { id: 'all', label: 'All', countKey: 'all' },
  { id: 'v0', label: 'v0 Prototypes', countKey: 'v0' },
  { id: 'electron', label: 'Desktop Apps', countKey: 'electron' },
  { id: 'web', label: 'Web Engines', countKey: 'web' },
  { id: 'node', label: 'Node', countKey: 'node' },
]
