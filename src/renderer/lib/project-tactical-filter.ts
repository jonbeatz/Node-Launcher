/** Tactical project type filtering (shields) — used by dashboard + sidebar (v1.2.5+). */

export type VpeTacticalProjectFilter =
  | 'all'
  | 'v0'
  | 'electron'
  | 'web'
  | 'node'
  /** v2.1 — WordPress / Local by Flywheel sites. */
  | 'wordpress'
  /** v1.8.7 — uncategorized / unknown shields ("Other" in UI). */
  | 'unknown'

export interface VpeTacticalCounts {
  all: number
  v0: number
  electron: number
  web: number
  node: number
  /** v2.1 — WordPress / Local by Flywheel sites. */
  wordpress: number
  unknown: number
}

export function msc_computeTacticalCounts(
  projects: { shield_project_type?: string | null; project_type?: string | null }[],
): VpeTacticalCounts {
  const c: VpeTacticalCounts = {
    all: projects.length,
    v0: 0,
    electron: 0,
    web: 0,
    node: 0,
    wordpress: 0,
    unknown: 0,
  }
  for (const p of projects) {
    const t = (p.shield_project_type ?? 'unknown') as string
    // wordpress-local shield type OR project_type maps to the wordpress bucket.
    if (t === 'wordpress-local' || p.project_type === 'wordpress-local') {
      c.wordpress += 1
    } else if (t === 'v0') {
      c.v0 += 1
    } else if (t === 'electron') {
      c.electron += 1
    } else if (t === 'web') {
      c.web += 1
    } else if (t === 'node') {
      c.node += 1
    } else {
      c.unknown += 1
    }
  }
  return c
}

export function msc_applyTacticalProjectFilter<
  T extends { shield_project_type?: string | null; project_type?: string | null },
>(projects: T[], filter: VpeTacticalProjectFilter): T[] {
  if (filter === 'all') return projects
  if (filter === 'wordpress') {
    return projects.filter(
      (p) =>
        p.shield_project_type === 'wordpress-local' ||
        p.project_type === 'wordpress-local',
    )
  }
  if (filter === 'unknown') {
    return projects.filter((p) => {
      const t = (p.shield_project_type ?? 'unknown') as string
      // Exclude wordpress-local from "Other" — it has its own bucket.
      return !['v0', 'electron', 'web', 'node', 'wordpress-local'].includes(t) &&
        p.project_type !== 'wordpress-local'
    })
  }
  return projects.filter((p) => (p.shield_project_type ?? 'unknown') === filter)
}

/** Labels shared by `Msc_ProjectFilterNav` + sidebar (v1.2.5). */
export const VPE_TACTICAL_NAV_META: {
  id: VpeTacticalProjectFilter
  label: string
  countKey: keyof Pick<
    VpeTacticalCounts,
    'all' | 'v0' | 'electron' | 'web' | 'node' | 'wordpress' | 'unknown'
  >
}[] = [
  { id: 'all', label: 'All', countKey: 'all' },
  { id: 'v0', label: 'v0 Prototypes', countKey: 'v0' },
  { id: 'electron', label: 'Desktop Apps', countKey: 'electron' },
  { id: 'web', label: 'Web Engines', countKey: 'web' },
  { id: 'node', label: 'Node', countKey: 'node' },
  { id: 'wordpress', label: 'WordPress', countKey: 'wordpress' },
  { id: 'unknown', label: 'Other', countKey: 'unknown' },
]
