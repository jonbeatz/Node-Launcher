'use client'

import { useCallback, useState } from 'react'
import { Wrench, ListOrdered } from 'lucide-react'
import { useToast } from '@/components/vader-toast'
import { getVpeApi, msc_formatUnknownIPCError } from '@/lib/vpe-bridge'

type PathCheckMissing = { id: string; name: string; path: string }

/** JEDI_MOD_29 — internal tools: registry path audit + display_order reindex (shared by App Settings modal and `/settings`). */
export function MscSystemMaintenanceTools({ disabled = false }: { disabled?: boolean }) {
  const { addToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [lastMissing, setLastMissing] = useState<PathCheckMissing[] | null>(null)

  const combinedBusy = disabled || busy

  const handleVerifyPaths = useCallback(async () => {
    if (disabled) return
    const api = getVpeApi()
    if (!api?.repairVaultLinks) {
      addToast('Verify paths unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setBusy(true)
    try {
      const res = await api.repairVaultLinks()
      const missing = res.pathCheck?.missing ?? []
      setLastMissing(missing)
      const errN = Array.isArray(res.errors) ? res.errors.length : 0
      const thumbLine = `Vault thumbnails: repaired ${res.repaired ?? 0}, skipped ${res.skipped ?? 0}.`
      const pathLine =
        res.pathCheck != null
          ? `Paths: ${res.pathCheck.present}/${res.pathCheck.checked} present.`
          : ''
      if (missing.length > 0) {
        addToast(
          'Path audit: missing folders',
          'warning',
          `${pathLine} ${thumbLine} ${errN ? `${errN} thumbnail error(s).` : ''}`.trim(),
        )
      } else {
        addToast(
          'Path audit complete',
          errN > 0 ? 'warning' : 'success',
          `${pathLine} ${thumbLine}${errN ? ` ${errN} thumbnail error(s).` : ''}`.trim(),
        )
      }
    } catch (e: unknown) {
      setLastMissing(null)
      addToast('Verify paths failed', 'error', e instanceof Error ? e.message : msc_formatUnknownIPCError(e))
    } finally {
      setBusy(false)
    }
  }, [addToast, disabled])

  const handleResetOrder = useCallback(async () => {
    if (disabled) return
    const api = getVpeApi()
    if (!api?.reindexProjectDisplayOrder) {
      addToast('Reset order unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setBusy(true)
    try {
      const res = await api.reindexProjectDisplayOrder()
      if (res?.ok && typeof res.count === 'number') {
        addToast('Display order reset', 'success', `Renumbered ${res.count} project(s) 1…n.`)
      } else if (res && 'error' in res && typeof res.error === 'string') {
        addToast('Reset order failed', 'error', res.error)
      }
    } catch (e: unknown) {
      addToast('Reset order failed', 'error', e instanceof Error ? e.message : msc_formatUnknownIPCError(e))
    } finally {
      setBusy(false)
    }
  }, [addToast, disabled])

  return (
    <section
      className="msc-system-maintenance-surface rounded border border-[#333333] bg-[#1c1c1c] p-5 space-y-4"
      aria-labelledby="msc-system-maintenance-heading"
    >
      <div>
        <h2
          id="msc-system-maintenance-heading"
          className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A0A0A0]"
        >
          System Maintenance
        </h2>
        <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-[#555555]">
          Verify each catalog workspace path exists on disk (registry <span className="text-[#888888]">path</span>).
          The same run repairs vault thumbnail links. Use Reset Order to compact{' '}
          <span className="text-[#888888]">display_order</span> after manual edits.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={combinedBusy}
          onClick={() => void handleVerifyPaths()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#333333] bg-[#121212] px-4 font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-[#eaeaea] transition-all hover:border-[color:var(--msc-accent)]/50 hover:text-[color:var(--msc-accent)] vader-focus disabled:opacity-50"
        >
          <Wrench size={16} className="shrink-0 opacity-90" aria-hidden />
          Verify &amp; Repair Paths
        </button>
        <button
          type="button"
          disabled={combinedBusy}
          onClick={() => void handleResetOrder()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#333333] bg-[#121212] px-4 font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-[#A0A0A0] transition-all hover:border-[#555555] hover:text-white vader-focus disabled:opacity-50"
        >
          <ListOrdered size={16} className="shrink-0 opacity-90" aria-hidden />
          Reset Order
        </button>
      </div>
      {lastMissing && lastMissing.length > 0 ? (
        <div className="rounded border border-[#e02b20]/25 bg-[#121212] p-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f59e0b] mb-2">
            Missing path — {lastMissing.length} project(s)
          </p>
          <ul className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[10px] text-[#c8c8c8]">
            {lastMissing.map((m) => (
              <li key={m.id} className="break-all">
                <span className="text-[#eaeaea]">{m.name}</span>
                <span className="text-[#666666]"> · </span>
                {m.path || '(empty path)'}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-[10px] text-[#555555] leading-snug">
            Dashboard cards show PATH MISSING. Use the log drawer Relink control or Project Settings to pick a new folder.
          </p>
        </div>
      ) : null}
    </section>
  )
}
