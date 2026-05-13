'use client'

import { useCallback, useEffect, useState } from 'react'

/** @deprecated v1.6.9 — view mode lives in `VpeUiLayoutProvider`; key kept for docs / boot migration. */
export const VPE_DASHBOARD_VIEW_LS_KEY = 'vpe.settings.dashboard.viewMode'
const LS_FILTER = 'vpe.settings.dashboard.activeFilter'

export type DashboardActiveFilter =
  | 'ALL'
  | 'RUNNING'
  | 'STOPPED'
  | 'ERRORS'
  | 'ARCHIVE'

const ALLOWED_FILTERS: DashboardActiveFilter[] = [
  'ALL',
  'RUNNING',
  'STOPPED',
  'ERRORS',
  'ARCHIVE',
]

function readActiveFilter(): DashboardActiveFilter {
  if (typeof window === 'undefined') return 'ALL'
  try {
    const v = localStorage.getItem(LS_FILTER)
    if (v && (ALLOWED_FILTERS as string[]).includes(v)) return v as DashboardActiveFilter
  } catch {
    /* */
  }
  return 'ALL'
}

/**
 * Persists tactical dashboard status filter pill (incl. ARCHIVE).
 * v1.6.9: grid/cinema/compact/list moved to `useVpeUiLayout`.
 */
export function useDashboardPersistedSettings() {
  const [activeFilter, setAf] = useState<DashboardActiveFilter>('ALL')

  useEffect(() => {
    setAf(readActiveFilter())
  }, [])

  const setActiveFilter = useCallback(
    (
      next: DashboardActiveFilter | ((p: DashboardActiveFilter) => DashboardActiveFilter),
    ) => {
      setAf((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(LS_FILTER, v)
        } catch {
          /* */
        }
        return v
      })
    },
    [],
  )

  return {
    activeFilter,
    setActiveFilter,
  }
}
