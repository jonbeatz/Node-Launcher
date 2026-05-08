'use client'

import {
  VPE_TACTICAL_NAV_META,
  type VpeTacticalCounts,
  type VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'

export interface Msc_ProjectFilterNavProps {
  activeFilter: VpeTacticalProjectFilter
  onFilterChange: (next: VpeTacticalProjectFilter) => void
  counts: VpeTacticalCounts
}

/** Horizontal tactical filter pills — v1.2.5 (Vader red active state). */
export function Msc_ProjectFilterNav({
  activeFilter,
  onFilterChange,
  counts,
}: Msc_ProjectFilterNavProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {VPE_TACTICAL_NAV_META.map((pill) => {
        const isActive = activeFilter === pill.id
        const n = counts[pill.countKey]
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onFilterChange(pill.id)}
            title={`${pill.label} (${n})`}
            className={`
              group inline-flex items-baseline gap-1.5 rounded-t px-3 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors vader-focus
              border-b-2
              ${
                isActive
                  ? 'border-[var(--msc-accent)] bg-[rgba(224,43,32,0.2)] text-white'
                  : 'border-transparent text-[#A0A0A0] hover:text-white hover:bg-[#252525]/60'
              }
            `}
          >
            <span>{pill.label}</span>
            <span
              className="font-sans font-medium normal-case tracking-normal tabular-nums text-[var(--text-muted,#A0A0A0)] opacity-90"
              style={{ fontSize: '0.7rem' }}
            >
              ({n})
            </span>
          </button>
        )
      })}
    </div>
  )
}
