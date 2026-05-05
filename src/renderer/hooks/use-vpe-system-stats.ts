'use client'

import { useCallback, useEffect, useState } from 'react'
import { getVpeApi, type VpeSystemStats } from '@/lib/vpe-bridge'

export function useVpeSystemStats(enabled: boolean, intervalMs = 3000) {
  const [stats, setStats] = useState<VpeSystemStats | null>(null)

  const fetchStats = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getSystemStats) return
    try {
      const next = await api.getSystemStats()
      setStats(next)
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const api = getVpeApi()
    if (!api?.getSystemStats) return

    void fetchStats()
    const id = window.setInterval(() => {
      void fetchStats()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, fetchStats])

  return { stats, refetch: fetchStats }
}
