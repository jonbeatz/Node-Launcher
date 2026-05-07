'use client'

import Image from 'next/image'
import {
  Play,
  Square,
  Wrench,
  Trash2,
  Terminal,
  X,
  Settings,
  AlertTriangle,
  Hammer,
  ExternalLink,
  Star,
} from 'lucide-react'

interface Msc_ProjectCardProps {
  id: string
  name: string
  port: number
  uptime: string
  status: 'running' | 'stopped' | 'error' | 'building'
  errorMessage?: string
  thumbnailUrl?: string
  hasBuilt?: boolean
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onStart?: () => void
  onStop?: () => void
  onBuild?: () => void
  onLogs?: () => void
  onRepair?: () => void
  onNuke?: () => void
  onSettings?: () => void
  onUnregister?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  /** When running, opens project URL in the system browser (Electron). */
  onOpenInBrowser?: () => void
  /** Last GET / health result from main after dev start. */
  health_http_code?: number | null
  health_checked_at?: string | null
  health_reachable?: boolean | null
  /** Opens log drawer (e.g. when health is degraded). */
  onViewErrorConsole?: () => void
}

export function Msc_ProjectCard({
  name,
  port,
  uptime,
  status,
  errorMessage,
  thumbnailUrl,
  hasBuilt = true,
  isFavorite,
  onToggleFavorite,
  onStart,
  onStop,
  onBuild,
  onLogs,
  onRepair,
  onNuke,
  onSettings,
  onUnregister,
  onContextMenu,
  onOpenInBrowser,
  health_http_code,
  health_checked_at,
  health_reachable,
  onViewErrorConsole,
}: Msc_ProjectCardProps) {
  const isRunning = status === 'running'
  const runUrl = `http://localhost:${port}`
  const isError = status === 'error'
  const isBuilding = status === 'building'

  const getPrimaryButton = () => {
    if (isBuilding) return { label: 'BUILDING...', icon: Hammer, disabled: true }
    if (!hasBuilt) return { label: 'BUILD', icon: Hammer, action: onBuild }
    if (isRunning) return { label: 'STOP', icon: Square, action: onStop, active: true }
    if (isError) return { label: 'REBUILD', icon: Hammer, action: onBuild }
    return { label: 'START', icon: Play, action: onStart }
  }

  const primaryBtn = getPrimaryButton()

  const getLedColor = () => {
    if (isRunning) return 'bg-[#4fde82] shadow-[0_0_6px_#4fde82]'
    if (isError) return 'bg-[#e02b20] animate-pulse-led shadow-[0_0_6px_#e02b20]'
    if (isBuilding) return 'bg-[#ffcc00] animate-pulse-led'
    return 'bg-[#555555]'
  }

  const getStatusLabel = () => {
    if (isRunning) return 'RUNNING'
    if (isError) return 'ERROR'
    if (isBuilding) return 'BUILDING'
    return 'STOPPED'
  }

  const getHealthLine = (): {
    label: string
    cls: string
    showErrorCta?: boolean
  } | null => {
    if (!isRunning) return null
    if (!health_checked_at && (health_http_code === undefined || health_http_code === null)) {
      return {
        label: 'Booting… (waiting for HTTP)',
        cls: 'text-[#ffcc00]',
      }
    }
    if (
      health_reachable === false &&
      (health_http_code === undefined || health_http_code === null)
    ) {
      return {
        label: 'Offline (no TCP/HTTP)',
        cls: 'text-[#e02b20]',
        showErrorCta: true,
      }
    }
    if (typeof health_http_code === 'number' && health_http_code >= 200 && health_http_code < 300) {
      return { label: `Active — HTTP ${health_http_code}`, cls: 'text-[#4fde82]' }
    }
    if (typeof health_http_code === 'number' && health_http_code >= 500) {
      return {
        label: `Degraded — HTTP ${health_http_code}`,
        cls: 'text-[#e02b20]',
        showErrorCta: true,
      }
    }
    if (typeof health_http_code === 'number') {
      return {
        label: `HTTP ${health_http_code}`,
        cls: 'text-[#ffcc00]',
        showErrorCta: health_http_code >= 400,
      }
    }
    return { label: 'No HTTP response', cls: 'text-[#e02b20]', showErrorCta: true }
  }

  const healthLine = getHealthLine()

  return (
    <div
      className={`vader-card box-bling overflow-hidden relative ${isError ? 'border-[#e02b20]' : ''}`}
      onContextMenu={onContextMenu}
    >
      <div className="relative aspect-[4/3] bg-[#0a0a0a] overflow-hidden border-b border-[#333333]" style={{ borderRadius: '4px 4px 0 0' }}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full vader-grid-pattern flex items-center justify-center">
            <span className="font-sans text-xs text-[#333333] uppercase tracking-wider">THUMBNAIL</span>
          </div>
        )}

        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 z-10 pointer-events-none">
          <div
            className="msc-9700x-badge pointer-events-auto px-2 py-0.5 rounded border border-[#333333] bg-[#1c1c1c] font-sans text-[10px] font-semibold text-[#A0A0A0] uppercase tracking-tight"
            title="Ryzen 9700x tuned profile"
          >
            9700x Tuned
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite?.()
              }}
              className={`w-7 h-7 rounded bg-[#0a0a0a]/70 backdrop-blur-sm flex items-center justify-center transition-colors ${
                isFavorite ? 'text-[#ffcc00]' : 'text-[#A0A0A0] hover:text-[#ffcc00]'
              }`}
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Star size={14} fill={isFavorite ? '#ffcc00' : 'none'} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSettings?.()
              }}
              className="w-7 h-7 rounded bg-[#0a0a0a]/70 backdrop-blur-sm flex items-center justify-center text-[#A0A0A0] hover:text-[#4fde82] transition-colors"
              title="Project Settings"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUnregister?.()
              }}
              className="w-7 h-7 rounded bg-[#0a0a0a]/70 backdrop-blur-sm flex items-center justify-center text-[#A0A0A0] hover:text-[#e02b20] transition-colors"
              title="Remove from Registry"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-sans font-bold text-white text-base">{name}</h3>
          {isError && <AlertTriangle size={14} className="text-[#ff4444]" />}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${getLedColor()}`} />
          <span
            className={`font-sans text-[11px] uppercase tracking-[0.05em] ${isError ? 'text-[#e02b20]' : isRunning ? 'text-[#4fde82]' : 'text-[#A0A0A0]'}`}
          >
            {getStatusLabel()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] uppercase">
          <div>
            <span className="text-[#555555]">PORT</span>
            <span className="ml-2 text-[#A0A0A0] text-[13px] normal-case">{port}</span>
          </div>
          <div>
            <span className="text-[#555555]">UPTIME</span>
            <span className="ml-2 text-[#A0A0A0] text-[13px] normal-case">{uptime}</span>
          </div>
        </div>

        {isError && errorMessage && (
          <div className="mt-3 p-2 rounded bg-[#ff4444]/10 border border-[#ff4444]/30">
            <span className="font-sans text-[11px] text-[#ff4444]">{errorMessage}</span>
          </div>
        )}

        {isRunning && (
          <div className="mt-3 flex flex-col gap-2 rounded border border-[#2a4a3a] bg-[#0d1a14] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-0.5 block font-sans text-[9px] uppercase tracking-wider text-[#555555]">
                Started on
              </span>
              <span
                className="block truncate font-mono text-[12px] text-[#4fde82]"
                title={runUrl}
              >
                {runUrl}
              </span>
              {healthLine && (
                <span
                  className={`mt-1 block font-mono text-[11px] ${healthLine.cls}`}
                  title="GET / on project port after start"
                >
                  {healthLine.label}
                </span>
              )}
              {healthLine?.showErrorCta && onViewErrorConsole && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewErrorConsole()
                  }}
                  className="mt-2 font-sans text-[10px] font-medium uppercase tracking-wide text-[#e02b20] underline decoration-[#e02b20]/50 hover:text-[#ff5555]"
                >
                  View error console →
                </button>
              )}
            </div>
            {onOpenInBrowser && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenInBrowser()
                }}
                className="flex shrink-0 items-center justify-center gap-1.5 self-start rounded border border-[#4fde82] bg-transparent px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-wide text-[#4fde82] transition-colors hover:bg-[#4fde82] hover:text-black vader-focus sm:self-center"
              >
                <ExternalLink size={14} />
                Open
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-3 flex items-center gap-2">
        <button
          onClick={primaryBtn.action}
          disabled={primaryBtn.disabled}
          className={`
            flex-1 flex items-center justify-center gap-1.5 h-7 rounded font-sans text-xs transition-all vader-focus
            ${primaryBtn.active
              ? 'bg-[#4fde82] text-black'
              : primaryBtn.disabled
                ? 'bg-transparent border border-[#333333] text-[#555555] cursor-not-allowed'
                : 'bg-transparent border border-[#555555] text-white hover:border-[#4fde82] hover:text-[#4fde82]'
            }
          `}
        >
          <primaryBtn.icon size={12} />
          <span>{primaryBtn.label}</span>
        </button>

        <button
          onClick={onLogs}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all vader-focus"
        >
          <Terminal size={12} />
          <span>LOGS</span>
        </button>

        <button
          onClick={onRepair}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all vader-focus"
        >
          <Wrench size={12} />
          <span>REPAIR</span>
        </button>

        <button
          onClick={onNuke}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#555555] font-sans text-xs text-[#A0A0A0] hover:border-[#e02b20] hover:text-[#e02b20] transition-all vader-focus"
        >
          <Trash2 size={12} />
          <span>NUKE</span>
        </button>
      </div>
    </div>
  )
}
