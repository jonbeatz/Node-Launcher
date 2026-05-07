'use client'

import { useCallback, useEffect, useState } from 'react'
import { getVpeApi } from '@/lib/vpe-bridge'

type NetLedState = 'unknown' | 'forge' | 'dev' | 'conflict'

function msc_engineVersionLabel(): string {
  if (typeof window === 'undefined') return '1.1.4'
  const w = window as Window & { vpeInfo?: { version?: string } }
  return w.vpeInfo?.version ?? '1.1.4'
}

export function Footer() {
  const [led, setLed] = useState<NetLedState>('unknown')
  const [purging, setPurging] = useState(false)
  const [engineVer] = useState(() => msc_engineVersionLabel())

  const refresh = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getLauncherPortHealth) {
      setLed('unknown')
      return
    }
    try {
      const h = await api.getLauncherPortHealth()
      const stackOk = Boolean(h?.ok)
      const p3000 = Boolean(h?.p3000)
      const p3001 = Boolean(h?.p3001)
      const p9222 = Boolean(h?.p9222)
      const forgeReady = h?.forgeReady ?? (!p3000 && !p3001)
      if (!stackOk) setLed('conflict')
      else if (forgeReady && !p9222) setLed('forge')
      else setLed('dev')
    } catch {
      setLed('unknown')
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

  const ledEl =
    led === 'unknown' ? (
      <span className="text-[#666666]" title="Port status unknown (browser mode)">
        ●
      </span>
    ) : led === 'forge' ? (
      <span
        className="text-[#4fde82]"
        title="Ports 3000 & 3001 free and 9222 CDP idle — pre-forge / packaging ready"
      >
        ●
      </span>
    ) : led === 'dev' ? (
      <span
        className="text-[#e8a838]"
        title="Dev stack on 3000/3001 and/or CDP on 9222 (debug bridge) — gold until clear + idle"
      >
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
        {ledEl}
        <button
          type="button"
          disabled={purging || led === 'unknown'}
          onClick={() => void handlePurge()}
          className="h-6 px-2 rounded border border-[#444444] font-sans text-[10px] uppercase tracking-wide text-[#A0A0A0] hover:text-white hover:border-[#4fde82]/60 disabled:opacity-40 vader-focus"
          title="taskkill /F /T tree-kill node/electron on 3000, 3001, 9222 — skips own PID and parent PID"
        >
          {purging ? 'Purging…' : 'Purge env'}
        </button>
      </div>
      <span className="font-sans text-[11px] text-[#A0A0A0]">
        Powered by the MSC Media Engine v{engineVer}
      </span>
    </footer>
  )
}
