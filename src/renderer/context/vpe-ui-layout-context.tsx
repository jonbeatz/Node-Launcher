'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

/** v1.6.9 — unified shell layout (replaces separate grid/list + density toggles). */
export type VpeShellViewMode = 'cinema' | 'compact' | 'list'

const LS_VIEW = 'vpe.settings.dashboard.viewMode'
const LS_LEGACY_DENSITY = 'vpe.settings.dashboard.gridDensity'

function readShellViewFromStorage(): VpeShellViewMode {
  if (typeof window === 'undefined') return 'cinema'
  try {
    const v = localStorage.getItem(LS_VIEW)
    if (v === 'cinema' || v === 'compact' || v === 'list') return v
    if (v === 'grid') {
      const d = localStorage.getItem(LS_LEGACY_DENSITY)
      return d === 'compact' ? 'compact' : 'cinema'
    }
  } catch {
    /* */
  }
  return 'cinema'
}

type VpeUiLayoutValue = {
  viewMode: VpeShellViewMode
  setViewMode: (m: VpeShellViewMode) => void
}

const VpeUiLayoutContext = createContext<VpeUiLayoutValue | null>(null)

export function VpeUiLayoutProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<VpeShellViewMode>('cinema')

  useEffect(() => {
    setViewModeState(readShellViewFromStorage())
  }, [])

  const setViewMode = useCallback((m: VpeShellViewMode) => {
    setViewModeState((prev) => {
      if (prev === m) return prev
      try {
        localStorage.setItem(LS_VIEW, m)
      } catch {
        /* */
      }
      return m
    })
  }, [])

  return (
    <VpeUiLayoutContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </VpeUiLayoutContext.Provider>
  )
}

export function useVpeUiLayout(): VpeUiLayoutValue {
  const ctx = useContext(VpeUiLayoutContext)
  if (!ctx) {
    throw new Error('useVpeUiLayout must be used within VpeUiLayoutProvider')
  }
  return ctx
}
