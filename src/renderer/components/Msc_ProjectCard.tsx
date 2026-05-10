'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  type MouseEvent,
} from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import {
  Play,
  Square,
  Terminal,
  Trash2,
  Settings,
  AlertTriangle,
  Hammer,
  ExternalLink,
  Star,
  Loader2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Copy,
  Activity,
} from 'lucide-react'

import { getVpeApi, type VpeShieldProjectType } from '@/lib/vpe-bridge'
import { msc_shieldColorHex, msc_shieldTypeTitle } from '@/lib/shield-colors'
import { useToast } from '@/components/vader-toast'
import { VpeHealthEqualizerIcon } from '@/components/vpe-health-equalizer-icon'

export type { VpeShieldProjectType }

function msc_formatUptimeSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return '—'
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Live session duration from persisted start (main) or client anchor when missing. */
function useVpeLiveSessionUptime(
  isRunning: boolean,
  devSessionStartedAt: string | null | undefined,
): string {
  const [now, setNow] = useState(() => Date.now())
  const [fallbackStart, setFallbackStart] = useState<number | null>(null)

  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isRunning])

  useEffect(() => {
    if (!isRunning) {
      setFallbackStart(null)
      return
    }
    if (!devSessionStartedAt) {
      setFallbackStart((prev) => (prev === null ? Date.now() : prev))
    } else {
      setFallbackStart(null)
    }
  }, [isRunning, devSessionStartedAt])

  if (!isRunning) return '—'
  const t0 = devSessionStartedAt
    ? new Date(devSessionStartedAt).getTime()
    : fallbackStart
  if (t0 == null || Number.isNaN(t0)) return '—'
  const sec = Math.max(0, Math.floor((now - t0) / 1000))
  return msc_formatUptimeSeconds(sec)
}

function msc_formatFolderTimestamp(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return '—'
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function ProjectMetaAccordion({
  isCompact,
  projectPath,
  folderCreatedAt,
  folderModifiedAt,
  onOpenChange,
  runningStrip,
}: {
  isCompact: boolean
  projectPath: string
  folderCreatedAt?: string | null
  folderModifiedAt?: string | null
  onOpenChange?: (open: boolean) => void
  /** Compact-only: show “Started on” inside the dropdown when running (v1.8.1). */
  runningStrip?: {
    runUrl: string
    healthLabel: string | null
    healthCls: string | null
    uptimeLabel: string
    port?: number
    /** HTTP 2xx — enables collapsible “green connection” strip in compact accordion. */
    isHttpConnected?: boolean
    isConnectionExpanded?: boolean
    onToggleConnectionExpanded?: (e: React.MouseEvent) => void
  } | null
}) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const skipParentSync = useRef(true)

  useEffect(() => {
    if (skipParentSync.current) {
      skipParentSync.current = false
      return
    }
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const copyPath = () => {
    if (!projectPath.trim()) return
    void navigator.clipboard.writeText(projectPath).then(() => {
      addToast('Copied!', 'success', 'Project path copied to clipboard.', undefined, 1000)
    })
  }

  const pad = isCompact ? 'px-2.5 pb-2' : 'px-4 pb-3'
  const labelCls = isCompact ? 'text-[11px]' : 'text-[12px]'
  const valueCls = isCompact ? 'text-[12px]' : 'text-[13px]'

  return (
    <div className="border-t border-[#2a2a2a] bg-[#121212]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-center gap-1 bg-[#121212] py-1 text-[10px] uppercase tracking-wide transition-colors vader-focus ${
          isCompact
            ? 'text-[#888888] hover:text-white'
            : 'text-[#eaeaea] hover:text-[#4fde82]'
        }`}
        aria-expanded={open}
        title={open ? 'Hide project details' : 'Show project details'}
      >
        <ChevronDown
          size={isCompact ? 14 : 15}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden bg-[#121212]"
      >
        <div className={`space-y-2 bg-[#121212] ${pad} pb-3 pt-2 text-[#A0A0A0]`}>
          {isCompact && runningStrip && (
            <>
              {runningStrip.isHttpConnected &&
              runningStrip.onToggleConnectionExpanded &&
              runningStrip.isConnectionExpanded === false ? (
                <div className="flex min-h-6 items-center justify-between gap-2 rounded border border-[#2d4a38]/80 bg-[#0f1612]/90 px-2 py-0.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-[#4fde82] shadow-[0_0_6px_rgba(74,222,128,0.45)]"
                      aria-hidden
                    />
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7dcea0]/95">
                      LIVE — {runningStrip.port ?? '—'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      runningStrip.onToggleConnectionExpanded?.(e)
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/25 bg-[#121212]/90 text-white transition-colors hover:border-[#4fde82] hover:bg-[#1a2620] hover:text-[#4fde82] vader-focus"
                    title="Show connection details"
                    aria-expanded={false}
                    aria-label="Expand connection details"
                  >
                    <Activity size={13} strokeWidth={2} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="rounded border border-[#2d4a38]/80 bg-[#0f1612]/90 px-2 py-2">
                  {runningStrip.isHttpConnected && runningStrip.onToggleConnectionExpanded ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 pt-0">
                          <span className="mt-0 mb-0.5 block text-[9px] uppercase leading-none tracking-[0.12em] text-[#5c6b62]">
                            Started on
                          </span>
                          <span
                            className="block truncate text-[12px] leading-tight text-[#7dcea0]/95"
                            title={runningStrip.runUrl}
                          >
                            {runningStrip.runUrl}
                          </span>
                          {runningStrip.healthLabel && (
                            <span
                              className={`mt-0.5 block text-[11px] leading-snug ${runningStrip.healthCls ?? 'text-[#4fde82]'}`}
                            >
                              {runningStrip.healthLabel}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            runningStrip.onToggleConnectionExpanded?.(e)
                          }}
                          className="mt-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/25 bg-[#121212]/90 text-white transition-colors hover:border-[#4fde82] hover:bg-[#1a2620] hover:text-[#4fde82] vader-focus"
                          title="Hide connection details"
                          aria-expanded
                          aria-label="Collapse connection details"
                        >
                          <ChevronUp size={13} strokeWidth={2.5} className="text-white" />
                        </button>
                      </div>
                      <div className="mt-1.5 border-t border-[#2d4a38]/50 pt-1.5">
                        <span className="mb-0.5 block text-[9px] uppercase tracking-[0.12em] text-[#5c6b62]">
                          Uptime
                        </span>
                        <span className="tabular-nums text-[12px] text-[#7dcea0]/95">
                          {runningStrip.uptimeLabel}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="mb-0.5 block text-[9px] uppercase tracking-[0.12em] text-[#5c6b62]">
                        Started on
                      </span>
                      <span
                        className="block truncate text-[12px] leading-tight text-[#7dcea0]/95"
                        title={runningStrip.runUrl}
                      >
                        {runningStrip.runUrl}
                      </span>
                      {runningStrip.healthLabel && (
                        <span
                          className={`mt-0.5 block text-[11px] leading-snug ${runningStrip.healthCls ?? 'text-[#4fde82]'}`}
                        >
                          {runningStrip.healthLabel}
                        </span>
                      )}
                      <div className="mt-1.5 border-t border-[#2d4a38]/50 pt-1.5">
                        <span className="mb-0.5 block text-[9px] uppercase tracking-[0.12em] text-[#5c6b62]">
                          Uptime
                        </span>
                        <span className="tabular-nums text-[12px] text-[#7dcea0]/95">
                          {runningStrip.uptimeLabel}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <div>
            <span className={`mb-0.5 block uppercase tracking-wider text-[#555555] ${labelCls}`}>
              Project Started
            </span>
            <span className={`text-[#e8e8e8] tabular-nums ${valueCls}`}>
              {msc_formatFolderTimestamp(folderCreatedAt)}
            </span>
          </div>
          <div>
            <span className={`mb-0.5 block uppercase tracking-wider text-[#555555] ${labelCls}`}>
              Last Modified
            </span>
            <span className={`text-[#e8e8e8] tabular-nums ${valueCls}`}>
              {msc_formatFolderTimestamp(folderModifiedAt)}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <span className={`mb-0.5 block uppercase tracking-wider text-[#555555] ${labelCls}`}>
                Path
              </span>
              <span className={`block break-all text-[#c8c8c8] ${valueCls}`} title={projectPath}>
                {projectPath.trim() ? projectPath : '—'}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                copyPath()
              }}
              disabled={!projectPath.trim()}
              className={`mt-4 flex shrink-0 items-center gap-1 rounded border border-[#444444] px-2 py-1 uppercase tracking-wide text-[#A0A0A0] transition-colors hover:border-[#22c55e] hover:bg-[#22c55e] hover:text-white disabled:opacity-40 vader-focus ${isCompact ? 'text-[11px]' : 'text-[12px]'}`}
              title="Copy path"
            >
              <Copy size={11} />
              COPY
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

interface Msc_ProjectCardOwnProps {
  id: string
  name: string
  port: number
  status: 'running' | 'stopped' | 'error' | 'building'
  errorMessage?: string
  thumbnailUrl?: string
  hasBuilt?: boolean
  node_modules_missing?: boolean
  isFavorite?: boolean
  onInstallAndStart?: () => void
  onToggleFavorite?: () => void
  onStart?: () => void
  onStop?: () => void
  onBuild?: () => void
  onLogs?: () => void
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
  /** v1.2.3 — dependency auto-install before dev is still running. */
  devInstallInProgress?: boolean
  /** v1.2.4 — resolved shield (manual override or auto classifier). */
  shieldProjectType?: VpeShieldProjectType
  /** Vault has user reference files; v1.9.5+ paperclip on thumbnail overlay only. */
  vaultHasReferenceFiles?: boolean
  /** v1.6.8 — dense grid: ~250px card (v1.7.9+), 4:3 thumb, truncated title. */
  isCompact?: boolean
  /** v1.6.9 — project folder on disk (accordion + copy). */
  projectPath?: string
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
  /** v1.8.0 — marks this project as the global Explorer / folder-action target. */
  onCardInteraction?: () => void
  /** v1.8.1 — focused card: subtle stroke until another card is picked. */
  isSelected?: boolean
  /** ISO dev session start from persistence (v1.8.2); drives live uptime. */
  devSessionStartedAt?: string | null
}

export type Msc_ProjectCardProps = Msc_ProjectCardOwnProps &
  Omit<HTMLMotionProps<'div'>, keyof Msc_ProjectCardOwnProps>

const MSC_PROJECT_CARD_LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
}

const MSC_PROJECT_CARD_MOTION_TRANSITION = {
  layout: MSC_PROJECT_CARD_LAYOUT_SPRING,
  opacity: { duration: 0.2 },
  scale: { duration: 0.2 },
}

/** Cinema: fixed status strip height — idle ↔ live (collapsed/expanded) does not shift card vertical rhythm. */
const MSC_STATUS_BAR_HEIGHT = 'h-6'

export const Msc_ProjectCard = forwardRef<HTMLDivElement, Msc_ProjectCardProps>(
  function Msc_ProjectCard(props, forwardedRef) {
  const {
    id,
    name,
    port,
    status,
    errorMessage,
    thumbnailUrl,
    hasBuilt = true,
    node_modules_missing,
    isFavorite,
    onInstallAndStart,
    onToggleFavorite,
    onStart,
    onStop,
    onBuild,
    onLogs,
    onSettings,
    onUnregister,
    onContextMenu,
    onOpenInBrowser,
    health_http_code,
    health_checked_at,
    health_reachable,
    onViewErrorConsole,
    devInstallInProgress,
    shieldProjectType,
    vaultHasReferenceFiles = false,
    isCompact = false,
    projectPath = '',
    project_folder_created_at,
    project_folder_modified_at,
    onCardInteraction,
    isSelected = false,
    devSessionStartedAt = null,
    initial,
    animate,
    exit,
    transition,
    layout = true,
    ...motionPassThrough
  } = props
  const { className: motionExtraClassName, ...motionDivAttrs } = motionPassThrough
  const { addToast } = useToast()
  const cardShellRef = useRef<HTMLDivElement | null>(null)
  const setShellRef = useCallback(
    (node: HTMLDivElement | null) => {
      cardShellRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )
  const [cinemaInspectOpen, setCinemaInspectOpen] = useState(false)
  const [compactInfoOpen, setCompactInfoOpen] = useState(false)
  const [reorderBusy, setReorderBusy] = useState(false)
  const [isStatusExpanded, setIsStatusExpanded] = useState(false)
  /** `null` = first run (skip pop so already-connected projects stay collapsed on load). */
  const wasHttpConnectedRef = useRef<boolean | null>(null)
  const accordionExpanded = isCompact ? compactInfoOpen : cinemaInspectOpen

  useEffect(() => {
    if (!accordionExpanded) return
    const el = cardShellRef.current
    if (!el) return
    const tid = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 300)
    return () => window.clearTimeout(tid)
  }, [accordionExpanded])
  const dotTitle = msc_shieldTypeTitle(shieldProjectType)
  const dotHex = msc_shieldColorHex(shieldProjectType)
  const isRunning = status === 'running'
  const runUrl = `http://localhost:${port}`
  const isError = status === 'error'
  const isBuilding = status === 'building'

  const isHttpConnected =
    isRunning &&
    typeof health_http_code === 'number' &&
    health_http_code >= 200 &&
    health_http_code < 300

  useEffect(() => {
    if (!isRunning) {
      setIsStatusExpanded(false)
      wasHttpConnectedRef.current = false
      return
    }
    if (wasHttpConnectedRef.current === null) {
      wasHttpConnectedRef.current = isHttpConnected
      return
    }
    const prev = wasHttpConnectedRef.current
    if (isHttpConnected && !prev) {
      setIsStatusExpanded(true)
    }
    wasHttpConnectedRef.current = isHttpConnected
  }, [isRunning, isHttpConnected])

  const getPrimaryButton = () => {
    if (devInstallInProgress && isRunning) {
      return {
        label: 'Installing…',
        icon: Loader2,
        action: onStop,
        installingActive: true,
      }
    }
    if (isBuilding) return { label: 'BUILDING...', icon: Hammer, disabled: true }
    if (!hasBuilt) {
      if (node_modules_missing) return { label: 'INSTALL & START', icon: Play, action: onInstallAndStart }
      return { label: 'BUILD', icon: Hammer, action: onBuild }
    }
    if (isRunning) return { label: 'STOP', icon: Square, action: onStop, active: true }
    if (isError) return { label: 'REBUILD', icon: Hammer, action: onBuild }
    return { label: 'START', icon: Play, action: onStart }
  }

  const primaryBtn = getPrimaryButton()

  const getStatusLabel = () => {
    if (devInstallInProgress && isRunning) return 'INSTALLING'
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
  const liveUptime = useVpeLiveSessionUptime(isRunning, devSessionStartedAt)

  /** Warm-up: running but not yet checked — drives equalizer amber (not paperclip). */
  const isBootingHttp =
    isRunning &&
    health_reachable !== false &&
    !health_checked_at &&
    (health_http_code === undefined || health_http_code === null)

  const showVaultPaperclip = Boolean(vaultHasReferenceFiles)
  const isIdleStopped = !isRunning && !isError && !isBuilding

  /** v1.9.2 — equalizer colors only while running (glyph omitted when stopped). */
  const healthEqualizerClass = (() => {
    if (!isRunning) return 'text-[#9ca3af]'
    if (isBuilding || (devInstallInProgress && isRunning)) return 'text-[#fbbf08]'
    if (
      typeof health_http_code === 'number' &&
      health_http_code >= 200 &&
      health_http_code < 300
    ) {
      return 'text-[#22c55e]'
    }
    if (isBootingHttp) return 'text-[#fbbf08]'
    return 'text-[#fbbf08]'
  })()

  /** High-contrast icon tiles (Favorite, Settings, Delete). */
  const msc_actionDarkTile =
    'shrink-0 flex items-center justify-center rounded-md border border-[#2a2a2a]/50 bg-[#121212] transition-colors vader-focus hover:bg-[#2a2a2a]'
  /** Cinema + compact: tighter vertical padding on management tiles. */
  const msc_actionTilePy1 = `${msc_actionDarkTile} py-1`

  const msc_reorderArrowTile =
    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a]/50 bg-[#121212]/80 backdrop-blur-sm text-[#eaeaea] transition-colors vader-focus hover:bg-[#2a2a2a]/90 disabled:opacity-40 disabled:pointer-events-none'

  const handleReorder = async (dir: 'up' | 'down') => {
    if (reorderBusy) return
    const api = getVpeApi()
    if (!api?.reorderProject) return
    setReorderBusy(true)
    try {
      const r = await api.reorderProject(id, dir)
      if (!r?.ok && r?.error && r.error !== 'no_neighbor') {
        addToast('Reorder failed', 'error', r.error)
      }
    } catch (e) {
      addToast('Reorder failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setReorderBusy(false)
    }
  }

  const msc_reorderArrowStack = (
    <div className="absolute left-2 top-1/2 z-30 hidden md:flex -translate-y-1/2 flex-col gap-0.5 opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
      <button
        type="button"
        disabled={reorderBusy}
        onClick={(e) => {
          e.stopPropagation()
          void handleReorder('up')
        }}
        className={msc_reorderArrowTile}
        title="Move project up"
        aria-label="Move project up"
      >
        <ChevronUp size={12} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        disabled={reorderBusy}
        onClick={(e) => {
          e.stopPropagation()
          void handleReorder('down')
        }}
        className={msc_reorderArrowTile}
        title="Move project down"
        aria-label="Move project down"
      >
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>
    </div>
  )

  const msc_onCardSurfaceDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return
    onCardInteraction?.()
  }

  const openBtnActiveClass =
    'border-[#121816] bg-[#080b09] text-white hover:bg-[#0f1411] hover:border-[#2a322c]'
  const openBtnIdleClass =
    'border-[#3f3f3f] bg-transparent text-[#555555] opacity-50'

  const cardChromeSelected = !isError && isSelected ? 'vpe-card-chrome-selected' : ''

  /** LOGS strip width matches header icon tiles (compact 1.5rem, cinema 1.75rem). */
  const msc_mgmtTileRem = 1.5
  const msc_mgmtTileRemCinema = 1.75
  const msc_mgmtCount = 3
  const msc_logsStripWidth = `${msc_mgmtCount * msc_mgmtTileRem + (msc_mgmtCount - 1) * 0.25}rem`
  const msc_logsStripWidthCinema = `${msc_mgmtCount * msc_mgmtTileRemCinema + (msc_mgmtCount - 1) * 0.25}rem`

  const primaryIsPlayCta =
    primaryBtn.label === 'START' || primaryBtn.label === 'INSTALL & START'
  const primaryIsStopCta =
    'active' in primaryBtn && primaryBtn.active === true && primaryBtn.label === 'STOP'

  const msc_cardShellMotionProps = {
    ...motionDivAttrs,
    ref: setShellRef,
    layout,
    initial: initial ?? { opacity: 0, scale: 0.95 },
    animate: animate ?? { opacity: 1, scale: 1 },
    exit: exit ?? { opacity: 0, scale: 0.95 },
    transition: transition ?? MSC_PROJECT_CARD_MOTION_TRANSITION,
    onContextMenu,
    onMouseDown: msc_onCardSurfaceDown,
  }

  if (isCompact) {
    return (
      <motion.div
        {...msc_cardShellMotionProps}
        className={`group vader-card vpe-theme-font vpe-project-card boxBling relative w-[250px] max-w-full ${
          compactInfoOpen ? 'overflow-visible' : 'overflow-hidden'
        } ${isError ? 'border-[#e02b20] bg-[#1c1c1c]' : 'bg-[#1c1c1c]'} ${cardChromeSelected}${
          motionExtraClassName ? ` ${motionExtraClassName}` : ''
        }`}
      >
        <div className="relative aspect-[4/3] bg-[#121212] overflow-hidden border-b border-[#333333]">
          {msc_reorderArrowStack}
          {thumbnailUrl ? (
            // v1.7.6 — native img for `vpe-vault:` (privileged custom scheme); avoids Next/Image URL restrictions.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="w-full h-full vader-grid-pattern flex items-center justify-center">
              <span className="text-[10px] text-[#333333] uppercase tracking-wider">THUMB</span>
            </div>
          )}

          <div
            className="absolute left-2 top-2 z-20 flex flex-col items-center gap-1 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            aria-hidden
          >
            <span
              className="block rounded-full border-0 shrink-0 ring-1 ring-black/40"
              title={dotTitle}
              style={{ width: 8, height: 8, backgroundColor: dotHex }}
            />
            {isRunning ? (
              <span
                className={`inline-flex size-[14px] shrink-0 items-center justify-center ${healthEqualizerClass}`}
              >
                <VpeHealthEqualizerIcon size={14} title={getStatusLabel()} className="shrink-0" />
              </span>
            ) : (
              <span className="inline-flex size-[14px] shrink-0" aria-hidden />
            )}
          </div>
          {showVaultPaperclip ? (
            <div
              className="absolute right-2 top-2 z-20 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
              title="Vault reference files"
            >
              <span
                className="inline-flex size-6 items-center justify-center rounded-md bg-[#00000066] text-[#eaeaea]"
                aria-hidden
              >
                <Paperclip size={11} strokeWidth={2} />
              </span>
            </div>
          ) : null}
        </div>

        <div
          className={`border-b border-[#2a2a2a] flex min-w-0 items-center justify-between gap-2.5 px-3 ${isIdleStopped ? 'py-1.5' : 'py-2'}`}
        >
          <div className="flex min-w-0 flex-1 items-center min-h-6 pr-0.5">
            <h3
              className="vpe-card-title min-w-0 truncate text-xs leading-snug text-white"
              title={name}
            >
              {name}
            </h3>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 self-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite?.()
              }}
              className={`${msc_actionTilePy1} h-6 w-6 ${
                isFavorite ? 'text-[#ffcc00]' : 'text-[#A0A0A0] hover:text-[#ffcc00]'
              }`}
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Star size={12} fill={isFavorite ? '#ffcc00' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSettings?.()
              }}
              className={`${msc_actionTilePy1} h-6 w-6 text-[#A0A0A0] hover:text-[#4fde82]`}
              title="Project Settings"
            >
              <Settings size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onUnregister?.()
              }}
              className={`${msc_actionTilePy1} h-6 w-6 text-[#A0A0A0] hover:text-[#e02b20]`}
              title="Remove from Registry"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div
          className={`px-2.5 flex flex-wrap items-center gap-1 ${isIdleStopped ? 'py-1.5' : 'py-2'}`}
        >
          <button
            type="button"
            onClick={() => {
              if ('action' in primaryBtn && typeof primaryBtn.action === 'function') {
                primaryBtn.action()
              }
            }}
            disabled={Boolean('disabled' in primaryBtn && primaryBtn.disabled === true)}
            className={`
              box-border min-h-7 max-h-7 h-7 flex-1 min-w-[72px] flex items-center justify-center gap-1 rounded border border-transparent py-0 leading-tight text-[10px] transition-all vader-focus
              ${primaryBtn.active
                ? 'border-transparent bg-[#e02b20] text-white hover:bg-[#c41e17] hover:text-white'
                : primaryBtn.disabled
                  ? 'border-[#333333] bg-transparent text-[#555555] cursor-not-allowed'
                  : primaryBtn.label === 'Installing…'
                    ? 'border-[#ffcc00] bg-transparent text-[#ffcc00]'
                    : primaryIsPlayCta
                      ? 'border-transparent bg-[#181818] text-white hover:bg-[#22c55e] hover:text-white'
                      : 'border-[#555555] bg-transparent text-white hover:border-[#22c55e] hover:bg-[#22c55e] hover:text-white'
              }
            `}
          >
            <primaryBtn.icon
              size={11}
              className={
                'installingActive' in primaryBtn && primaryBtn.installingActive
                  ? 'animate-spin shrink-0'
                  : primaryIsPlayCta || primaryIsStopCta
                    ? 'shrink-0 text-white'
                    : undefined
              }
              fill={primaryIsPlayCta || primaryIsStopCta ? 'currentColor' : undefined}
              strokeWidth={primaryIsPlayCta || primaryIsStopCta ? 0 : undefined}
            />
            <span className="truncate">{primaryBtn.label}</span>
          </button>
          <button
            type="button"
            disabled={!isRunning || !onOpenInBrowser}
            onClick={(e) => {
              e.stopPropagation()
              if (isRunning && onOpenInBrowser) onOpenInBrowser()
            }}
            className={`box-border flex min-h-7 max-h-7 min-w-[4.25rem] flex-1 items-center justify-center gap-1 h-7 rounded border text-[10px] font-medium uppercase tracking-wide transition-all disabled:cursor-not-allowed vader-focus ${
              isRunning && onOpenInBrowser ? openBtnActiveClass : openBtnIdleClass
            }`}
            title={
              isRunning
                ? `Open ${runUrl} in browser`
                : 'Start the project to open in browser'
            }
          >
            <ExternalLink size={11} className="shrink-0" />
            Open
          </button>
          <button
            type="button"
            onClick={onLogs}
            style={{ width: msc_logsStripWidth }}
            className="box-border min-h-7 max-h-7 h-7 shrink-0 rounded border border-[#333333] bg-[#2a2a2a] flex items-center justify-center text-[#E8E8E8] hover:bg-[#4b5563] hover:border-[#4b5563] hover:text-white transition-all vader-focus"
            title="Logs"
          >
            <Terminal size={12} />
          </button>
        </div>
        <ProjectMetaAccordion
          isCompact
          projectPath={projectPath}
          folderCreatedAt={project_folder_created_at}
          folderModifiedAt={project_folder_modified_at}
          onOpenChange={setCompactInfoOpen}
          runningStrip={
            isRunning
              ? {
                  runUrl,
                  healthLabel: healthLine?.label ?? null,
                  healthCls: healthLine?.cls ?? null,
                  uptimeLabel: liveUptime,
                  port,
                  isHttpConnected,
                  isConnectionExpanded: isStatusExpanded,
                  onToggleConnectionExpanded: (e) => {
                    e.stopPropagation()
                    setIsStatusExpanded((v) => !v)
                  },
                }
              : null
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      {...msc_cardShellMotionProps}
      className={`
        group vader-card vpe-theme-font vpe-project-card boxBling relative w-full min-w-0
        ${cinemaInspectOpen ? 'overflow-visible' : 'overflow-hidden'}
        ${isError ? 'border-[#e02b20] bg-[#1c1c1c]' : 'bg-[#1c1c1c]'}
        ${cardChromeSelected}${motionExtraClassName ? ` ${motionExtraClassName}` : ''}
      `}
    >
        <div
          className="relative aspect-[4/3] bg-[#0a0a0a] overflow-hidden border-b border-[#333333]"
          style={{ borderRadius: '4px 4px 0 0' }}
        >
        {msc_reorderArrowStack}
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={name}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${cinemaInspectOpen ? 'opacity-70' : 'opacity-80'}`}
          />
        ) : (
          <div className="w-full h-full vader-grid-pattern flex items-center justify-center">
            <span className="text-xs text-[#333333] uppercase tracking-wider">THUMBNAIL</span>
          </div>
        )}

        <div
          className="absolute left-2 top-2 z-20 flex flex-col items-center gap-1 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          aria-hidden
        >
          <span
            className="block rounded-full border-0 shrink-0 ring-1 ring-black/50"
            title={dotTitle}
            style={{
              width: 10,
              height: 10,
              backgroundColor: dotHex,
            }}
          />
          {isRunning ? (
            <span
              className={`inline-flex size-4 shrink-0 items-center justify-center ${healthEqualizerClass}`}
            >
              <VpeHealthEqualizerIcon size={16} title={getStatusLabel()} className="shrink-0" />
            </span>
          ) : (
            <span className="inline-flex size-4 shrink-0" aria-hidden />
          )}
        </div>
        {showVaultPaperclip ? (
          <div
            className="absolute right-2 top-2 z-20 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            title="Vault reference files"
          >
            <span
              className="inline-flex size-6 items-center justify-center rounded-md bg-[#00000066] text-[#eaeaea]"
              aria-hidden
            >
              <Paperclip size={11} strokeWidth={2} />
            </span>
          </div>
        ) : null}

      </div>

      <div className={isIdleStopped ? 'px-4 pt-3 pb-2' : 'p-4'}>
          <div
            className={`flex min-w-0 items-center justify-between gap-2 ${isIdleStopped ? 'mb-1' : 'mb-2'}`}
          >
            <div className="flex min-h-7 min-w-0 flex-1 items-center gap-2 pr-0.5">
              <h3
                className="vpe-card-title min-w-0 truncate text-base leading-tight text-white"
                title={name}
              >
                {name}
              </h3>
              {isError && <AlertTriangle size={14} className="text-[#ff4444] shrink-0" />}
            </div>
            <div className="inline-flex shrink-0 items-center gap-1 self-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite?.()
                }}
                className={`${msc_actionDarkTile} h-7 w-7 ${
                  isFavorite ? 'text-[#ffcc00]' : 'text-[#A0A0A0] hover:text-[#ffcc00]'
                }`}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Star size={12} fill={isFavorite ? '#ffcc00' : 'none'} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSettings?.()
                }}
                className={`${msc_actionDarkTile} h-7 w-7 text-[#A0A0A0] hover:text-[#4fde82]`}
                title="Project Settings"
              >
                <Settings size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnregister?.()
                }}
                className={`${msc_actionDarkTile} h-7 w-7 text-[#A0A0A0] hover:text-[#e02b20]`}
                title="Remove from Registry"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div
            className={`mb-2 flex w-full shrink-0 items-center justify-between gap-2 ${MSC_STATUS_BAR_HEIGHT}`}
          >
            {isRunning && isHttpConnected && !isStatusExpanded ? (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-[#4fde82]">
                  ● LIVE - {port}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsStatusExpanded((v) => !v)
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#4fde82] transition-colors hover:bg-[#4fde82]/15 hover:text-white vader-focus"
                  title="Show connection details"
                  aria-label="Expand connection details"
                  aria-expanded={false}
                >
                  <Activity size={12} strokeWidth={2} className="text-[#4fde82]" />
                </button>
              </>
            ) : isRunning && isHttpConnected && isStatusExpanded ? null : isIdleStopped ? (
              <span className="min-w-0 flex-1 truncate text-left text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-[#888888]/30">
                READY
              </span>
            ) : (
              <span
                className={`min-w-0 flex-1 truncate text-left text-[10px] uppercase leading-none tracking-[0.08em] ${
                  isError
                    ? 'text-[#e02b20]'
                    : devInstallInProgress && isRunning
                      ? 'text-[#ffcc00]'
                      : isRunning
                        ? 'text-[#6ee7a8]/90'
                        : 'text-[#888888]'
                }`}
              >
                {getStatusLabel()}
              </span>
            )}
          </div>

          {isError && errorMessage && (
            <div className="mt-3 p-2 rounded bg-[#ff4444]/10 border border-[#ff4444]/30">
              <span className="text-[11px] text-[#ff4444]">{errorMessage}</span>
            </div>
          )}

          {isRunning && (!isHttpConnected || isStatusExpanded) && (
            <div
              className={`rounded border border-[#2d4a38]/80 bg-[#0f1612]/90 px-2.5 py-2 ${
                isHttpConnected ? 'mb-2' : 'mt-3'
              }`}
            >
              {isHttpConnected ? (
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 pt-0">
                      <span className="mt-0 mb-0.5 block text-[8px] uppercase leading-none tracking-[0.12em] text-[#5c6b62]">
                        Started on
                      </span>
                      <span
                        className="block truncate text-[11px] leading-tight text-[#7dcea0]/95"
                        title={runUrl}
                      >
                        {runUrl}
                      </span>
                      {healthLine && (
                        <span
                          className={`mt-0.5 block text-[10px] leading-snug ${healthLine.cls}`}
                          title="GET / on project port after start"
                        >
                          {healthLine.label}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsStatusExpanded((v) => !v)
                      }}
                      className="mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/25 bg-[#121212]/90 text-white transition-colors hover:border-[#4fde82] hover:bg-[#1a2620] hover:text-[#4fde82] vader-focus"
                      title="Hide connection details"
                      aria-label="Collapse connection details"
                      aria-expanded
                    >
                      <ChevronUp size={14} strokeWidth={2.5} className="text-white" />
                    </button>
                  </div>
                  <div className="mt-1.5 border-t border-[#2d4a38]/50 pt-1.5">
                    <span className="mb-0.5 block text-[8px] uppercase tracking-[0.12em] text-[#5c6b62]">
                      Uptime
                    </span>
                    <span className="tabular-nums text-[11px] text-[#7dcea0]/95">{liveUptime}</span>
                  </div>
                  {healthLine?.showErrorCta && onViewErrorConsole && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewErrorConsole()
                      }}
                      className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[#e02b20] underline decoration-[#e02b20]/50 hover:text-[#ff5555]"
                    >
                      View error console →
                    </button>
                  )}
                </div>
              ) : (
                <div className="min-w-0">
                  <span className="mb-0.5 block text-[8px] uppercase tracking-[0.12em] text-[#5c6b62]">
                    Started on
                  </span>
                  <span
                    className="block truncate text-[11px] leading-tight text-[#7dcea0]/95"
                    title={runUrl}
                  >
                    {runUrl}
                  </span>
                  {healthLine && (
                    <span
                      className={`mt-0.5 block text-[10px] leading-snug ${healthLine.cls}`}
                      title="GET / on project port after start"
                    >
                      {healthLine.label}
                    </span>
                  )}
                  <div className="mt-1.5 border-t border-[#2d4a38]/50 pt-1.5">
                    <span className="mb-0.5 block text-[8px] uppercase tracking-[0.12em] text-[#5c6b62]">
                      Uptime
                    </span>
                    <span className="tabular-nums text-[11px] text-[#7dcea0]/95">{liveUptime}</span>
                  </div>
                  {healthLine?.showErrorCta && onViewErrorConsole && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewErrorConsole()
                      }}
                      className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[#e02b20] underline decoration-[#e02b20]/50 hover:text-[#ff5555]"
                    >
                      View error console →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      <div
        className={`flex min-w-0 flex-row flex-nowrap items-center gap-2 px-4 ${
          isRunning || isError ? 'pb-3 pt-3' : isIdleStopped ? 'pb-3 pt-0' : 'pb-3 pt-1'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if ('action' in primaryBtn && typeof primaryBtn.action === 'function') {
              primaryBtn.action()
            }
          }}
          disabled={Boolean(
            'disabled' in primaryBtn && primaryBtn.disabled === true,
          )}
          title={
            primaryBtn.label === 'Installing…'
              ? 'Stop cancels install + dev pipeline'
              : undefined
          }
          className={`
            box-border min-h-7 max-h-7 min-w-[5rem] flex-1 flex items-center justify-center gap-1.5 h-7 rounded border border-transparent text-xs transition-all vader-focus
            ${primaryBtn.active
              ? 'border-transparent bg-[#e02b20] text-white hover:bg-[#c41e17] hover:text-white'
              : primaryBtn.disabled
                ? 'border-[#333333] bg-transparent text-[#555555] cursor-not-allowed'
                : primaryBtn.label === 'Installing…'
                  ? 'border-[#ffcc00] bg-transparent text-[#ffcc00] hover:border-[#e02b20] hover:text-[#e02b20]'
                : primaryIsPlayCta
                  ? 'border-transparent bg-[#181818] text-white hover:bg-[#22c55e] hover:text-white'
                  : 'border-[#555555] bg-transparent text-white hover:border-[#22c55e] hover:bg-[#22c55e] hover:text-white'
            }
          `}
        >
          <primaryBtn.icon
            size={12}
            className={
              'installingActive' in primaryBtn && primaryBtn.installingActive
                ? 'animate-spin shrink-0'
                : primaryIsPlayCta || primaryIsStopCta
                  ? 'shrink-0 text-white'
                  : undefined
            }
            fill={primaryIsPlayCta || primaryIsStopCta ? 'currentColor' : undefined}
            strokeWidth={primaryIsPlayCta || primaryIsStopCta ? 0 : undefined}
          />
          <span className="truncate">{primaryBtn.label}</span>
        </button>

        <button
          type="button"
          disabled={!isRunning || !onOpenInBrowser}
          onClick={(e) => {
            e.stopPropagation()
            if (isRunning && onOpenInBrowser) onOpenInBrowser()
          }}
          className={`box-border min-h-7 max-h-7 min-w-[5.5rem] flex-1 flex items-center justify-center gap-1.5 h-7 rounded border text-[11px] font-medium uppercase tracking-wide transition-all disabled:cursor-not-allowed vader-focus ${
            isRunning && onOpenInBrowser ? openBtnActiveClass : openBtnIdleClass
          }`}
          title={
            isRunning
              ? `Open ${runUrl} in browser`
              : 'Start the project to open in browser'
          }
        >
          <ExternalLink size={13} className="shrink-0" />
          Open
        </button>

        <button
          type="button"
          onClick={onLogs}
          style={{ width: msc_logsStripWidthCinema }}
          className="box-border min-h-7 max-h-7 h-7 shrink-0 flex items-center justify-center gap-1.5 rounded bg-[#2a2a2a] border border-[#333333] text-xs text-[#E8E8E8] hover:bg-[#4b5563] hover:border-[#4b5563] hover:text-white transition-all vader-focus"
        >
          <Terminal size={12} className="shrink-0" />
          <span>LOGS</span>
        </button>
      </div>
      <ProjectMetaAccordion
        isCompact={false}
        projectPath={projectPath}
        folderCreatedAt={project_folder_created_at}
        folderModifiedAt={project_folder_modified_at}
        onOpenChange={setCinemaInspectOpen}
      />
    </motion.div>
  )
  },
)

Msc_ProjectCard.displayName = 'Msc_ProjectCard'
