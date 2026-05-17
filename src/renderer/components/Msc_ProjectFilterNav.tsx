'use client'

import {
  VPE_TACTICAL_NAV_META,
  type VpeTacticalCounts,
  type VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'
import { msc_shieldColorHex } from '@/lib/shield-colors'

export interface Msc_ProjectFilterNavProps {
  activeFilter: VpeTacticalProjectFilter
  onFilterChange: (next: VpeTacticalProjectFilter) => void
  counts: VpeTacticalCounts
}

/** Horizontal tactical pills — v1.2.7 neutral active + dot indicators */
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
        const dot = pill.id === 'all' ? '#ffffff' : msc_shieldColorHex(pill.id)
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onFilterChange(pill.id)}
            title={`${pill.label} (${n})`}
            className={`
              group inline-flex items-center gap-2 rounded-t px-3 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors vader-focus
              ${
                isActive
                  ? 'bg-[#2a2a2a] text-[#D4D4D4]'
                  : 'bg-transparent text-[#A0A0A0] hover:text-[#E0E0E0] hover:bg-[#252525]/60'
              }
            `}
          >
            <span
              className={`rounded-full shrink-0 ${
                pill.id === 'unknown'
                  ? 'ring-1 ring-[#00FFFF]/45 shadow-[0_0_6px_rgba(0,255,255,0.2)]'
                  : pill.id === 'wordpress'
                    ? 'ring-1 ring-[#3b82f6]/50 shadow-[0_0_6px_rgba(59,130,246,0.25)]'
                    : ''
              }`}
              style={{
                width: 10,
                height: 10,
                backgroundColor: dot,
              }}
              aria-hidden
            />
            <span>{pill.label}</span>
            <span
              className="font-sans font-medium normal-case tracking-normal tabular-nums text-[#A0A0A0] opacity-90"
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
