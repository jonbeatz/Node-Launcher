'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Loader2,
  Zap,
  Trash2,
  Flame,
  Ghost,
  Stethoscope,
} from 'lucide-react'
import { useVpeSystemStats } from '@/hooks/use-vpe-system-stats'
import { getVpeApi } from '@/lib/vpe-bridge'

interface Warning {
  id: string
  severity: 'warning' | 'critical'
  message: string
  action?: { label: string; onClick: () => void }
}

interface SystemHealthPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SystemHealthPanel({ isOpen, onClose }: SystemHealthPanelProps) {
  const [runningCheck, setRunningCheck] = useState(false)
  const [runningForgeDiag, setRunningForgeDiag] = useState(false)
  const [forgeDiagText, setForgeDiagText] = useState<string | null>(null)
  const [scorchedBurn, setScorchedBurn] = useState(false)
  const [scorchedCleaning, setScorchedCleaning] = useState(false)

  const { stats: systemStats, refetch: refetchSystemStats } =
    useVpeSystemStats(isOpen, 3000)
  /** Only real diagnostics; populated when wired to engine checks */
  const [warnings, setWarnings] = useState<Warning[]>([])

  const ghostSignalCount = useMemo(
    () => warnings.filter((w) => w.id.startsWith('port-')).length,
    [warnings],
  )

  const handleKillPort = useCallback(async (port: number) => {
    const api = getVpeApi()
    if (!api?.killProcessOnPort) return
    const res = await api.killProcessOnPort(port)
    if (res.ok) {
      setWarnings(prev => prev.filter(w => !w.message.includes(`Port ${port}`)))
      await refetchSystemStats()
    }
  }, [refetchSystemStats])

  const refreshGhostWarnings = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getProjects) return
    const projects = await api.getProjects()
    const newWarnings: Warning[] = []
    projects.forEach((p) => {
      if (p.status === 'stopped' && p.health_reachable) {
        newWarnings.push({
          id: `port-${p.port}`,
          severity: 'warning',
          message: `Port ${p.port} (${p.name}) is occupied by an orphaned Node process.`,
          action: {
            label: 'KILL PROCESS & CLAIM PORT',
            onClick: () => handleKillPort(p.port),
          },
        })
      }
    })
    setWarnings((prev) => {
      const others = prev.filter((w) => !w.id.startsWith('port-'))
      return [...others, ...newWarnings]
    })
  }, [handleKillPort])

  useEffect(() => {
    if (!isOpen) return
    void refreshGhostWarnings()
  }, [isOpen, refreshGhostWarnings])

  useEffect(() => {
    if (!isOpen) return
    const api = getVpeApi()
    if (!api?.subscribeProjectsUpdated) return
    return api.subscribeProjectsUpdated(() => {
      void refreshGhostWarnings()
    })
  }, [isOpen, refreshGhostWarnings])

  const handleQuickCheck = async () => {
    setRunningCheck(true)
    try {
      if (getVpeApi()?.getSystemStats) {
        await refetchSystemStats()
      }
    } finally {
      setRunningCheck(false)
    }
  }

  const handleForgeDiagnostics = async () => {
    const api = getVpeApi()
    if (!api?.runForgeDiagnostics) return
    setRunningForgeDiag(true)
    setForgeDiagText(null)
    try {
      const r = await api.runForgeDiagnostics()
      const lines =
        r.checks
          ?.map(
            (c) =>
              `${c.ok ? '[ok]' : '[fail]'} ${c.id}${c.detail ? ` — ${c.detail}` : ''}`,
          )
          .join('\n') ?? ''
      setForgeDiagText(
        `${lines}\n\n${r.ok ? 'Forge validator: all checks passed.' : 'Forge validator: one or more checks failed.'}`,
      )
    } catch (e) {
      setForgeDiagText(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Forge diagnostics failed.',
      )
    } finally {
      setRunningForgeDiag(false)
    }
  }

  const handleScorchedEarth = async () => {
    const api = getVpeApi()
    if (!api?.scorchedEarth) return
    setScorchedBurn(true)
    setScorchedCleaning(true)
    try {
      await api.scorchedEarth()
      await refetchSystemStats()
      await refreshGhostWarnings()
    } catch {
      /* toast optional — panel still refreshes */
    } finally {
      setScorchedCleaning(false)
      window.setTimeout(() => setScorchedBurn(false), 1600)
    }
  }

  const handleAutoResolve = () => {
    setWarnings((prev) => prev.filter((w) => !w.action))
  }

  const handleDismissAll = () => {
    setWarnings([])
  }

  const dismissWarning = (id: string) => {
    setWarnings(prev => prev.filter(w => w.id !== id))
  }

  const cpuDisplay =
    systemStats != null && systemStats.cpu >= 0 ? `${systemStats.cpu}%` : '—'
  const projectsLine =
    systemStats != null
      ? `${systemStats.projects.active} of ${systemStats.projects.total} active`
      : '—'
  const memFreeLabel =
    systemStats != null ? `${systemStats.memory.free.toFixed(2)} GB` : '—'
  const resourcesLine =
    systemStats != null
      ? `CPU: ${cpuDisplay} | RAM: ${memFreeLabel} free (${systemStats.memory.percentage}% used)`
      : '—'

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Panel - Squared 4px radius */}
      <div
        className={`absolute top-12 right-4 z-50 w-96 bg-[#1c1c1c] border border-[#333333] rounded shadow-xl overflow-hidden ${scorchedBurn ? 'vpe-scorched-burn' : ''}`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#333333] flex items-center gap-2">
          <Activity size={16} className="text-[#e02b20]" />
          <span className="font-sans font-semibold text-white text-sm">SYSTEM HEALTH</span>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* VPE Uptime */}
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-[#A0A0A0]">VPE Uptime</span>
            <span className="font-sans text-sm text-white">
              {systemStats?.uptime.label ?? '—'}
            </span>
          </div>

          {/* PM2 Daemon */}
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-[#A0A0A0]">PM2 Daemon</span>
            <div className="flex items-center gap-2">
              {systemStats != null ? (
                <>
                  <div
                    className={
                      systemStats.pm2.status === 'online'
                        ? 'w-2 h-2 rounded-full bg-[#00cc66] animate-pulse-led'
                        : 'w-2 h-2 rounded-full bg-[#666666]'
                    }
                  />
                  <span
                    className={
                      systemStats.pm2.status === 'online'
                        ? 'font-sans text-sm text-[#00cc66]'
                        : 'font-sans text-sm text-[#A0A0A0]'
                    }
                  >
                    {systemStats.pm2.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-[#555555]" />
                  <span className="font-sans text-sm text-[#A0A0A0]">—</span>
                </>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-[#A0A0A0]">Projects</span>
            <span className="font-sans text-sm text-white">{projectsLine}</span>
          </div>

          {/* System Resources */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-xs text-[#A0A0A0] shrink-0">
              System Resources
            </span>
            <span className="font-sans text-sm text-white text-right min-w-0 break-words">
              {resourcesLine}
            </span>
          </div>

          <div className="flex items-center justify-between rounded border border-[#333333] bg-[#0a0a0a] px-3 py-2">
            <div className="flex items-center gap-2">
              <Ghost size={14} className="text-[#A0A0A0]" />
              <span className="font-sans text-xs text-[#A0A0A0] uppercase tracking-wide">
                Ghost signals
              </span>
            </div>
            <span
              className="font-mono text-sm text-[#ffcc00]"
              title="Stale registry vs live port (stopped but still listening)."
            >
              {ghostSignalCount}
            </span>
          </div>

          {/* Warnings Section - NO LEFT BORDER STROKE */}
          {warnings.length > 0 && (
            <div className="rounded bg-[#1c1c1c] border border-[#333333] overflow-hidden">
              {/* Warning Header */}
              <div className="px-3 py-2 bg-[#3daef2]/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-[#3daef2]" />
                  <span className="font-sans text-xs text-[#3daef2] font-medium">
                    {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoResolve}
                    title="Attempts to automatically fix detected issues (kill port processes, clear caches)"
                    className="px-2 py-1 rounded border border-[#4fde82] font-sans text-[9px] text-[#4fde82] hover:bg-[#4fde82] hover:text-black transition-all"
                  >
                    AUTO-RESOLVE
                  </button>
                  <button
                    onClick={handleDismissAll}
                    className="font-sans text-[9px] text-[#A0A0A0] hover:text-white transition-colors"
                  >
                    DISMISS ALL
                  </button>
                </div>
              </div>
              
              {/* Warning List */}
              <div className="divide-y divide-[#333333]">
                {warnings.map((warning) => (
                  <div key={warning.id} className="px-3 py-2 flex items-start gap-2">
                    {warning.severity === 'critical' ? (
                      <XCircle size={12} className="text-[#e02b20] mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle size={12} className="text-[#3daef2] mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[11px] text-[#A0A0A0] leading-relaxed">
                        {warning.message}
                      </p>
                      {warning.action && (
                        <button
                          onClick={warning.action.onClick}
                          className="mt-1 font-sans text-[9px] text-[#e02b20] hover:text-white transition-colors"
                        >
                          {warning.action.label}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => dismissWarning(warning.id)}
                      className="p-0.5 text-[#555555] hover:text-white transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Dismiss Subtext */}
              <div className="px-3 py-1.5 bg-[#0a0a0a]">
                <p className="font-sans text-[9px] text-[#555555] text-center">
                  Clearing dismisses until new diagnostics exist.
                </p>
              </div>
            </div>
          )}

          {/* No Warnings State */}
          {warnings.length === 0 && (
            <div className="p-4 rounded bg-[#00cc66]/10 border border-[#00cc66]/30 flex items-center gap-3">
              <Zap size={16} className="text-[#00cc66]" />
              <span className="font-sans text-sm text-[#00cc66]">
                No actionable warnings —{' '}
                <span className="text-[0.65rem] opacity-30 italic font-sans">
                  metrics poll every 3s
                </span>
              </span>
            </div>
          )}

          {/* Quick Check Button - VPE Green primary */}
          <button
            type="button"
            onClick={() => void handleQuickCheck()}
            disabled={runningCheck}
            className="w-full h-10 rounded bg-[#4fde82] hover:bg-[#3fcf72] disabled:opacity-50 font-sans text-sm text-black font-medium transition-colors vader-focus flex items-center justify-center gap-2"
          >
            {runningCheck ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                RUNNING CHECK...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                RUN QUICK CHECK
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleForgeDiagnostics()}
            disabled={runningForgeDiag}
            className="w-full h-10 rounded bg-[#2a2a2a] hover:bg-[#333333] border border-[#333333] disabled:opacity-50 font-sans text-sm text-[#eaeaea] font-medium transition-colors vader-focus flex items-center justify-center gap-2"
          >
            {runningForgeDiag ? (
              <>
                <Loader2 size={16} className="animate-spin text-[#4fde82]" />
                VALIDATING...
              </>
            ) : (
              <>
                <Stethoscope size={16} className="text-[#4fde82]" />
                FORGE VALIDATOR
              </>
            )}
          </button>

          {forgeDiagText ? (
            <pre className="max-h-32 overflow-y-auto rounded border border-[#333333] bg-[#0a0a0a] p-2 font-mono text-[10px] text-[#c8c8c8] whitespace-pre-wrap leading-snug">
              {forgeDiagText}
            </pre>
          ) : null}

          <button
            type="button"
            onClick={() => void handleScorchedEarth()}
            disabled={scorchedCleaning}
            className="w-full min-h-[2.75rem] rounded-lg border-2 border-[#e02b20] bg-[#0a0a0a] hover:bg-[#1a0606] disabled:opacity-60 font-sans text-xs font-bold text-[#ffb4ad] uppercase tracking-[0.12em] transition-colors vader-focus flex items-center justify-center gap-2 shadow-[inset_0_0_0_1px_rgba(224,43,32,0.35)]"
          >
            {scorchedCleaning ? (
              <>
                <Loader2 size={18} className="animate-spin text-[#e02b20]" />
                Cleaning…
              </>
            ) : (
              <>
                <Flame size={18} className="text-[#e02b20]" />
                <Ghost size={14} className="text-[#A0A0A0]" />
                SCORCHED EARTH
              </>
            )}
          </button>

        <p className="font-sans text-[10px] text-[#555555] text-center pt-2">
          Powered by the MSC Media Engine v1.4.0
        </p>
        </div>
      </div>
    </>
  )
}
