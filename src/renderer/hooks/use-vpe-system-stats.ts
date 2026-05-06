'use client'

import { useCallback, useEffect, useState } from 'react'
import { getVpeApi, type VpeSystemStats } from '@/lib/vpe-bridge'

function msc_isVpeSystemStats(v: unknown): v is VpeSystemStats {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.cpu !== 'number') return false
  const mem = o.memory
  if (!mem || typeof mem !== 'object') return false
  const m = mem as Record<string, unknown>
  if (
    typeof m.total !== 'number' ||
    typeof m.free !== 'number' ||
    typeof m.used !== 'number' ||
    typeof m.percentage !== 'number'
  ) {
    return false
  }
  const pm2 = o.pm2
  if (!pm2 || typeof pm2 !== 'object') return false
  const p2 = pm2 as Record<string, unknown>
  if (typeof p2.status !== 'string' || typeof p2.activeCount !== 'number') return false
  const up = o.uptime
  if (!up || typeof up !== 'object') return false
  const u = up as Record<string, unknown>
  if (typeof u.seconds !== 'number' || typeof u.label !== 'string') return false
  const pr = o.projects
  if (!pr || typeof pr !== 'object') return false
  const pj = pr as Record<string, unknown>
  if (typeof pj.active !== 'number' || typeof pj.total !== 'number') return false
  return true
}

/** Shown when IPC is missing or fails so the health panel never renders entirely blank. */
function msc_placeholderSystemStats(): VpeSystemStats {
  return {
    cpu: -1,
    memory: { total: 0, free: 0, used: 0, percentage: 0 },
    pm2: { status: 'offline', activeCount: 0 },
    uptime: { seconds: 0, label: '—' },
    projects: { active: 0, total: 0 },
  }
}

export function useVpeSystemStats(enabled: boolean, intervalMs = 3000) {
  const [stats, setStats] = useState<VpeSystemStats | null>(null)

  const fetchStats = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getSystemStats) {
      setStats(msc_placeholderSystemStats())
      return
    }
    try {
      const next = await api.getSystemStats()
      if (msc_isVpeSystemStats(next)) {
        setStats(next)
      } else {
        setStats(msc_placeholderSystemStats())
      }
    } catch {
      setStats(msc_placeholderSystemStats())
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const api = getVpeApi()
    if (!api?.getSystemStats) {
      setStats(msc_placeholderSystemStats())
      return
    }

    void fetchStats()
    const id = window.setInterval(() => {
      void fetchStats()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, fetchStats])

  return { stats, refetch: fetchStats }
}
