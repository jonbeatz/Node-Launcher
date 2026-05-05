'use client'

import { useState } from 'react'
import { Activity, RefreshCw, AlertTriangle, XCircle, Loader2, Zap, Trash2 } from 'lucide-react'
import { useVpeSystemStats } from '@/hooks/use-vpe-system-stats'

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
  const systemStats = useVpeSystemStats(isOpen, 3000)
  const [warnings, setWarnings] = useState<Warning[]>([
    { 
      id: '1', 
      severity: 'warning', 
      message: 'Port 3000 conflict — MSC_PRIMARY_GATE',
      action: { label: 'KILL PROCESS', onClick: () => handleKillProcess('1') }
    },
    { 
      id: '2', 
      severity: 'warning', 
      message: 'Node version mismatch — v18.17.0 detected, v20.11.0 expected' 
    },
    { 
      id: '3', 
      severity: 'warning', 
      message: 'Build cache stale — 14 days old',
      action: { label: 'CLEAR CACHE', onClick: () => handleClearCache('3') }
    },
  ])

  const handleQuickCheck = async () => {
    setRunningCheck(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setRunningCheck(false)
  }

  const handleAutoResolve = () => {
    // Simulate auto-resolve by removing fixable warnings
    setWarnings(prev => prev.filter(w => !w.action))
  }

  const handleDismissAll = () => {
    setWarnings([])
  }

  const handleKillProcess = (id: string) => {
    setWarnings(prev => prev.filter(w => w.id !== id))
  }

  const handleClearCache = (id: string) => {
    setWarnings(prev => prev.filter(w => w.id !== id))
  }

  const dismissWarning = (id: string) => {
    setWarnings(prev => prev.filter(w => w.id !== id))
  }

  const cpuDisplay =
    systemStats?.cpuPercent != null ? `${systemStats.cpuPercent}%` : '—'
  const projectsLine =
    systemStats != null
      ? `${systemStats.projectsActive} of ${systemStats.projectsTotal} active`
      : '—'
  const resourcesLine =
    systemStats != null
      ? `CPU: ${cpuDisplay} | RAM: ${systemStats.memoryFreeLabel} free (${systemStats.memoryUsedPercent}% used)`
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
      <div className="absolute top-12 right-4 z-50 w-96 bg-[#1c1c1c] border border-[#333333] rounded shadow-xl overflow-hidden">
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
              {systemStats?.vpeUptimeLabel ?? '—'}
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
                      systemStats.pm2Online
                        ? 'w-2 h-2 rounded-full bg-[#00cc66] animate-pulse-led'
                        : 'w-2 h-2 rounded-full bg-[#666666]'
                    }
                  />
                  <span
                    className={
                      systemStats.pm2Online
                        ? 'font-sans text-sm text-[#00cc66]'
                        : 'font-sans text-sm text-[#A0A0A0]'
                    }
                  >
                    {systemStats.pm2Online ? 'Online' : 'Offline'}
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
                  Warnings will reappear on next diagnostic check.
                </p>
              </div>
            </div>
          )}

          {/* No Warnings State */}
          {warnings.length === 0 && (
            <div className="p-4 rounded bg-[#00cc66]/10 border border-[#00cc66]/30 flex items-center gap-3">
              <Zap size={16} className="text-[#00cc66]" />
              <span className="font-sans text-sm text-[#00cc66]">All systems healthy</span>
            </div>
          )}

          {/* Quick Check Button - VPE Green primary */}
          <button
            onClick={handleQuickCheck}
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

          <p className="font-sans text-[10px] text-[#555555] text-center pt-2">
            Powered by the MSC Media Engine
          </p>
        </div>
      </div>
    </>
  )
}
