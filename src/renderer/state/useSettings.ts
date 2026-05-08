'use client'

import { useCallback, useEffect, useState } from 'react'

const LS_VIEW = 'vpe.settings.dashboard.viewMode'
const LS_FILTER = 'vpe.settings.dashboard.activeFilter'

export type DashboardViewMode = 'grid' | 'list'

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

function readViewMode(): DashboardViewMode {
  if (typeof window === 'undefined') return 'grid'
  try {
    const v = localStorage.getItem(LS_VIEW)
    if (v === 'grid' || v === 'list') return v
  } catch {
    /* */
  }
  return 'grid'
}

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
 * Persists tactical dashboard layout: grid vs list and status filter pill (incl. ARCHIVE).
 */
export function useDashboardPersistedSettings() {
  const [viewMode, setVm] = useState<DashboardViewMode>('grid')
  const [activeFilter, setAf] = useState<DashboardActiveFilter>('ALL')

  useEffect(() => {
    setVm(readViewMode())
    setAf(readActiveFilter())
  }, [])

  const setViewMode = useCallback(
    (next: DashboardViewMode | ((p: DashboardViewMode) => DashboardViewMode)) => {
      setVm((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(LS_VIEW, v)
        } catch {
          /* */
        }
        return v
      })
    },
    [],
  )

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
    viewMode,
    setViewMode,
    activeFilter,
    setActiveFilter,
  }
}
