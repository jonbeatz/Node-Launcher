'use client'

import { useCallback, useEffect, useState } from 'react'
import { getVpeApi } from '@/lib/vpe-bridge'

export function Footer() {
  const [ok, setOk] = useState<boolean | null>(null)
  const [purging, setPurging] = useState(false)

  const refresh = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getLauncherPortHealth) {
      setOk(null)
      return
    }
    try {
      const h = await api.getLauncherPortHealth()
      setOk(Boolean(h?.ok))
    } catch {
      setOk(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(t)
  }, [refresh])

  const handlePurge = async () => {
    const api = getVpeApi()
    if (!api?.purgeLauncherPorts) return
    setPurging(true)
    try {
      await api.purgeLauncherPorts()
      await refresh()
    } finally {
      setPurging(false)
    }
  }

  const led =
    ok === null ? (
      <span className="text-[#666666]" title="Port status unknown (browser mode)">
        ●
      </span>
    ) : ok ? (
      <span className="text-[#4fde82]" title="Ports 3000 / 3001: free or only node.exe / electron.exe">
        ●
      </span>
    ) : (
      <span
        className="text-[#e02b20] animate-pulse"
        title="Port conflict: non-launcher process on 3000 / 3001"
      >
        ●
      </span>
    )

  return (
    <footer className="h-8 w-full bg-[#1c1c1c] border-t border-[#333333] flex items-center justify-center gap-4 shrink-0 px-3">
      <div className="flex items-center gap-2" title="Launcher dev ports 3000 / 3001">
        <span className="font-sans text-[10px] text-[#666666] uppercase tracking-wide">
          Net
        </span>
        {led}
        <button
          type="button"
          disabled={purging || ok === null}
          onClick={() => void handlePurge()}
          className="h-6 px-2 rounded border border-[#444444] font-sans text-[10px] uppercase tracking-wide text-[#A0A0A0] hover:text-white hover:border-[#4fde82]/60 disabled:opacity-40 vader-focus"
          title="taskkill node/electron on LISTEN for 3000, 3001, 9222 (excludes own PID)"
        >
          {purging ? 'Purging…' : 'Purge env'}
        </button>
      </div>
      <span className="font-sans text-[11px] text-[#A0A0A0]">
        Powered by the MSC Media Engine v1.1.0
      </span>
    </footer>
  )
}
