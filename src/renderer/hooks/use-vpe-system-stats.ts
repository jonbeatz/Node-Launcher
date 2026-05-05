'use client'

import { useEffect, useState } from 'react'
import { getVpeApi, type VpeSystemStats } from '@/lib/vpe-bridge'

export function useVpeSystemStats(enabled: boolean, intervalMs = 3000) {
  const [stats, setStats] = useState<VpeSystemStats | null>(null)

  useEffect(() => {
    if (!enabled) return
    const api = getVpeApi()
    if (!api?.getSystemStats) return

    let cancelled = false

    const tick = async () => {
      try {
        const next = await api.getSystemStats!()
        if (!cancelled) setStats(next)
      } catch {
        if (!cancelled) setStats(null)
      }
    }

    void tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, intervalMs])

  return stats
}
