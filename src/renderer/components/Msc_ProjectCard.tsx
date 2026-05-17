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
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react'

import { getVpeApi, type VpeShieldProjectType } from '@/lib/vpe-bridge'
import { msc_shieldColorHex, msc_shieldTypeTitle } from '@/lib/shield-colors'
import { useToast } from '@/components/vader-toast'
import { VpeHealthEqualizerIcon } from '@/components/vpe-health-equalizer-icon'
import { Msc_ProjectEnvTab } from '@/components/vpe-project-env-tab'

export type { VpeShieldProjectType }

/** JEDI_MOD_01 / JEDI_MOD_06 — Obsidian Glass on single outer shell (border + outline in globals). */
const msc_obsidianGlassShellCls =
  'vpe-card-obsidian-glass box-border border border-solid border-t-white/20 border-x-white/5 border-b-white/[0.02] bg-[#1c1c1c]/80 backdrop-blur-lg shadow-[0_20px_50px_rgba(0,0,0,0.6)]'

/** JEDI_MOD_14 — readout strip + green banner values share one cadence vs micro-labels. */
const msc_readoutTracking = 'tracking-[0.12em]'
const msc_readoutDotCls =
  'size-1.5 shrink-0 rounded-full bg-[#4fde82] shadow-[0_0_4px_rgba(74,222,128,0.5)] ring-1 ring-white/15 motion-safe:animate-pulse'
const msc_readoutLiveTextCls = `min-w-0 flex-1 truncate text-left text-[10px] font-semibold uppercase leading-tight ${msc_readoutTracking} text-[#4fde82]`
const msc_readoutReadyTextCls = `min-w-0 flex-1 truncate text-left text-[10px] font-medium uppercase leading-tight ${msc_readoutTracking} text-[#888888]/45`
const msc_readoutStatusTextCls = `min-w-0 flex-1 truncate text-left text-[10px] font-medium uppercase leading-tight ${msc_readoutTracking}`

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
  projectId,
  projectPath,
  folderCreatedAt,
  folderModifiedAt,
  onOpenChange,
}: {
  isCompact: boolean
  projectId: string
  projectPath: string
  folderCreatedAt?: string | null
  folderModifiedAt?: string | null
  onOpenChange?: (open: boolean) => void
}) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [metaTab, setMetaTab] = useState<'details' | 'environment'>('details')
  const skipParentSync = useRef(true)

  useEffect(() => {
    if (skipParentSync.current) {
      skipParentSync.current = false
      return
    }
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) setMetaTab('details')
  }, [open])

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
    <div className="w-full min-w-0 border-t border-[#2a2a2a]/90 bg-[#121212]/95">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-center gap-1 bg-[#121212]/95 py-1 text-[10px] uppercase tracking-wide transition-colors vader-focus hover:bg-white/[0.04] ${
          isCompact
            ? 'text-[#888888] hover:text-white'
            : 'text-[#eaeaea] hover:text-[#4fde82]'
        }`}
        aria-expanded={open}
        title={open ? 'Hide project details' : 'Show project details'}
      >
        <ChevronDown
          size={isCompact ? 14 : 15}
          strokeWidth={2}
          className={`shrink-0 transition-transform duration-200 motion-safe:!animate-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        layout={false}
        animate={{ height: open ? 'auto' : 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden bg-[#121212]/95"
        style={{ contain: 'layout paint' }}
      >
        <div className={`space-y-2 bg-[#121212]/95 ${pad} pb-3 pt-2 text-[#A0A0A0]`}>
          <div
            className="flex gap-1 border-b border-[#2a2a2a] pb-2"
            role="tablist"
            aria-label="Project meta sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={metaTab === 'details'}
              onClick={(e) => {
                e.stopPropagation()
                setMetaTab('details')
              }}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors vader-focus ${
                metaTab === 'details'
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-[#888888] hover:text-[#d1d5db]'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metaTab === 'environment'}
              onClick={(e) => {
                e.stopPropagation()
                setMetaTab('environment')
              }}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors vader-focus ${
                metaTab === 'environment'
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-[#888888] hover:text-[#d1d5db]'
              }`}
            >
              Environment
            </button>
          </div>

          {metaTab === 'environment' ? (
            <Msc_ProjectEnvTab projectId={projectId} active={open && metaTab === 'environment'} />
          ) : null}

          {metaTab === 'details' ? (
            <>
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
            </>
          ) : null}
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
  /** JEDI_MOD_24 — project auto-restarting via watchdog. */
  watchdogRestartInProgress?: boolean
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
  /** JEDI_MOD_29 — registry workspace folder missing on disk. */
  projectPathMissing?: boolean
  /** JEDI_MOD_136 — false when no package.json on disk; health line stays staging vs offline. */
  repoRunnableForHttp?: boolean
  /** WordPress-Local: persisted custom domain (e.g. `https://sitename.local/`). */
  projectUrl?: string | null
  /** JEDI_MOD_27 — parent handles optimistic swap + `reorderProject` IPC when set. */
  onRegistryReorderNeighbor?: (
    projectId: string,
    direction: 'up' | 'down',
  ) => void | Promise<void>
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
    watchdogRestartInProgress,
    shieldProjectType,
    vaultHasReferenceFiles = false,
    isCompact = false,
    projectPath = '',
    project_folder_created_at,
    project_folder_modified_at,
    onCardInteraction,
    isSelected = false,
    devSessionStartedAt = null,
    onRegistryReorderNeighbor,
    projectPathMissing = false,
    repoRunnableForHttp = true,
    projectUrl = null,
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
  /** JEDI_MOD_15 — collapsed until user expands; never synced from HTTP/IPC or storage. */
  const [isStatusExpanded, setIsStatusExpanded] = useState(false)
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
  /** WordPress-Local: site is served by Local's own server stack — OPEN is always active. */
  const isWordPressLocal = shieldProjectType === 'wordpress-local'
  const runUrl = `http://localhost:${port}`
  /** For WordPress cards: show the local domain URL; for Node/Next: show localhost:port. */
  const displayRunUrl = isWordPressLocal && projectUrl ? projectUrl : runUrl
  /**
   * Status badge label: for WordPress shows the clean domain (e.g. "talkshowlandv1.local")
   * instead of a meaningless port number; for Node/Next shows the port as before.
   */
  const displayPortOrDomain = isWordPressLocal
    ? (projectUrl
        ? String(projectUrl).replace(/^https?:\/\//, '').replace(/\/$/, '')
        : 'WordPress Engine')
    : String(port)
  const isError = status === 'error'
  const isBuilding = status === 'building'

  /** JEDI_MOD_15 — collapse when stopped; resetting when card instance is reused for another `id`. */
  useEffect(() => {
    setIsStatusExpanded(false)
  }, [id])

  useEffect(() => {
    if (!isRunning) setIsStatusExpanded(false)
  }, [isRunning])

  const getPrimaryButton = () => {
    if (devInstallInProgress && isRunning) {
      return {
        label: 'Installing…',
        icon: Loader2,
        action: onStop,
        installingActive: true,
      }
    }
    if (projectPathMissing) {
      if (isRunning) return { label: 'STOP', icon: Square, action: onStop, active: true }
      return { label: 'RELINK', icon: Settings, action: () => onSettings?.() }
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
    if (watchdogRestartInProgress) return 'RESTARTING...'
    if (devInstallInProgress && isRunning) return 'INSTALLING'
    if (projectPathMissing && !isRunning && !isBuilding) return 'PATH MISSING'
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
    if (repoRunnableForHttp === false) {
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
      return {
        label: 'Staging — idle until project path is linked',
        cls: 'text-[#ffcc00]',
      }
    }
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

  const showVaultPaperclip = Boolean(vaultHasReferenceFiles)
  const isIdleStopped = !isRunning && !isError && !isBuilding

  /** v1.9.2 — equalizer colors: green if running (Universal Green Protocol); yellow if building. */
  const healthEqualizerClass = (() => {
    if (watchdogRestartInProgress) return 'text-[#ff7700]'
    if (isBuilding || (devInstallInProgress && isRunning)) return 'text-[#fbbf08]'
    if (isRunning) return 'text-[#22c55e]'
    return 'text-[#9ca3af]'
  })()

  /** High-contrast icon tiles (Favorite, Settings, Delete). */
  const msc_actionDarkTile =
    'shrink-0 flex items-center justify-center rounded-md border border-[#2a2a2a]/50 bg-[#121212] transition-colors vader-focus hover:bg-[#2a2a2a]'
  /** Cinema + compact: tighter vertical padding on management tiles. */
  const msc_actionTilePy1 = `${msc_actionDarkTile} py-1`

  const msc_reorderArrowTile =
    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#2a2a2a]/50 bg-[#121212]/80 backdrop-blur-sm text-[#eaeaea] transition-[color,background-color,border-color,box-shadow] duration-200 vader-focus hover:border-[color:color-mix(in_srgb,var(--msc-accent)_55%,#2a2a2a)] hover:bg-[#1a1f1c] hover:text-[color:var(--msc-accent)] hover:shadow-[0_0_14px_color-mix(in_srgb,var(--msc-accent)_22%,transparent)] disabled:opacity-40 disabled:pointer-events-none'

  const handleReorder = async (dir: 'up' | 'down') => {
    if (reorderBusy) return
    setReorderBusy(true)
    try {
      if (onRegistryReorderNeighbor) {
        await onRegistryReorderNeighbor(id, dir)
        return
      }
      const api = getVpeApi()
      if (!api?.reorderProject) return
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
    <div className="msc-reorder-arrow-stack absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-row gap-0.5 opacity-60 transition-opacity duration-200 ease-in-out group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
      <button
        type="button"
        disabled={reorderBusy}
        onClick={(e) => {
          e.stopPropagation()
          void handleReorder('up')
        }}
        className={msc_reorderArrowTile}
        title="Earlier in catalog order"
        aria-label="Move project earlier in catalog order"
      >
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        disabled={reorderBusy}
        onClick={(e) => {
          e.stopPropagation()
          void handleReorder('down')
        }}
        className={msc_reorderArrowTile}
        title="Later in catalog order"
        aria-label="Move project later in catalog order"
      >
        <ChevronRight size={12} strokeWidth={2.5} />
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

  /** JEDI_MOD_09 — chrome ring only on thumb + main header stack; accordion stays studio dark. */
  const cardChromeHeaderSelected =
    !isError && isSelected ? 'vpe-card-chrome-selected-header' : ''

  /** LOGS strip width matches header icon tiles (compact 1.5rem, cinema 1.75rem). */
  const msc_mgmtTileRemCinema = 1.75
  const msc_mgmtCount = 3
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

  /** JEDI_MOD_10 / JEDI_MOD_11 — Disable shell layout so accordion / selection chrome never squash the hero. */
  const msc_cinemaShellMotionProps = {
    ...msc_cardShellMotionProps,
    layout: false,
  }
  const msc_compactShellMotionProps = {
    ...msc_cardShellMotionProps,
    layout: false,
  }

  if (isCompact) {
    return (
      <motion.div
        {...msc_compactShellMotionProps}
        className={`group vader-card vpe-theme-font vpe-project-card boxBling relative w-[250px] max-w-full overflow-hidden rounded-[4px] ${
          isError
            ? `${msc_obsidianGlassShellCls} vpe-card-obsidian-glass--error`
            : msc_obsidianGlassShellCls
        }${projectPathMissing && !isError ? ' ring-1 ring-[#b45309]/50' : ''} ${motionExtraClassName ? ` ${motionExtraClassName}` : ''}`}
      >
        <div className={`flex flex-col rounded-t-[4px] ${cardChromeHeaderSelected}`}>
        <div className="relative w-full shrink-0 border-b border-[#333333] bg-[#0a0a0a]">
          {msc_reorderArrowStack}
          <div className="relative aspect-video w-full shrink-0 overflow-hidden will-change-transform">
            {thumbnailUrl ? (
              // v1.7.6 — native img for `vpe-vault:` (privileged custom scheme); avoids Next/Image URL restrictions.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
            ) : (
              <div className="flex h-full min-h-0 w-full items-center justify-center vader-grid-pattern">
                <span className="text-[10px] text-[#333333] uppercase tracking-wider">THUMB</span>
              </div>
            )}
          </div>

          <div
            className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            aria-hidden
          >
            <span
              className={`block shrink-0 rounded-full border-0 ring-1 ring-white/12 shadow-[0_0_6px_rgba(0,0,0,0.65)] ${
                isRunning || watchdogRestartInProgress ? 'motion-safe:animate-pulse' : ''
              }`}
              title={dotTitle}
              style={{
                width: 8,
                height: 8,
                backgroundColor: watchdogRestartInProgress ? '#ff7700' : isRunning ? '#4fde82' : dotHex,
              }}
            />
            {isRunning || watchdogRestartInProgress ? (
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
              className="pointer-events-none absolute right-2 top-2 z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
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
          {projectPathMissing ? (
            <div
              role="status"
              className="flex items-center gap-1.5 border-t border-[#7f1d1d]/35 bg-[#1a1212] px-2.5 py-1"
            >
              <AlertTriangle size={11} className="shrink-0 text-[#f97316]" aria-hidden />
              <span className="font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-[#fdba74]">
                Path missing · Terminal: Relink
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 bg-[#242424]/90">
        <div className="flex min-w-0 items-center justify-between gap-2.5 border-b border-[#2a2a2a] px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 min-h-6 pr-0.5">
            <h3
              className="vpe-card-title min-w-0 truncate text-xs leading-snug text-white"
              title={name}
            >
              {name}
            </h3>
            {projectPathMissing ? (
              <span
                className="shrink-0 rounded border border-[#78350f]/80 bg-[#292018] px-1 py-0.5 font-sans text-[8px] font-semibold uppercase tracking-[0.06em] text-[#fdba74]"
                title="Registry workspace path not found"
              >
                Missing
              </span>
            ) : null}
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

        <div className="flex h-auto flex-col gap-2 px-2.5 py-1.5">
          {watchdogRestartInProgress ? (
            <div className="flex min-h-[2.5rem] w-full shrink-0 items-center justify-between gap-1.5 rounded-[4px] border border-[#ff7700]/30 bg-[#ff7700]/10 px-2 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-[#ff7700] shadow-[0_0_4px_rgba(255,119,0,0.5)] ring-1 ring-white/15 motion-safe:animate-pulse" aria-hidden />
                <span className={`${msc_readoutLiveTextCls} text-[#ff7700]`}>
                  RESTARTING...
                </span>
              </div>
            </div>
          ) : isRunning && !isStatusExpanded ? (
            <div className="flex min-h-[2.5rem] w-full shrink-0 items-center justify-between gap-1.5 rounded-[4px] border border-white/5 bg-[#121212]/60 px-2 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className={msc_readoutDotCls} aria-hidden />
                <span
                  className={msc_readoutLiveTextCls}
                  title={`${getStatusLabel()} — ${displayPortOrDomain}${healthLine?.label ? ` · ${healthLine.label}` : ''}`}
                >
                  {getStatusLabel()} — {displayPortOrDomain}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsStatusExpanded((v) => !v)
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded text-[#4fde82] transition-colors hover:bg-white/[0.06] hover:text-white vader-focus"
                title="Show connection details"
                aria-label="Expand connection details"
                aria-expanded={false}
              >
                <ChevronDown
                  size={11}
                  strokeWidth={2}
                  className="shrink-0 motion-safe:!animate-none"
                />
              </button>
            </div>
          ) : isRunning && isStatusExpanded ? null : (
            <div className="flex min-h-[2.5rem] w-full shrink-0 items-center rounded-[4px] border border-white/5 bg-[#121212]/60 px-2 py-1.5">
              {isIdleStopped ? (
                <span className={msc_readoutReadyTextCls}>READY</span>
              ) : (
                <span
                  className={`${msc_readoutStatusTextCls} ${
                    isError
                      ? 'text-[#e02b20]'
                      : isBuilding || devInstallInProgress
                        ? 'text-[#ffcc00]'
                        : 'text-[#888888]'
                  }`}
                >
                  {getStatusLabel()}
                </span>
              )}
            </div>
          )}

          {isError && errorMessage && (
            <div className="rounded border border-[#ff4444]/30 bg-[#ff4444]/10 p-1.5">
              <span className="text-[10px] text-[#ff4444]">{errorMessage}</span>
            </div>
          )}

          {/* Green telemetry: only while user-expanded (non‑2xx e.g. 307 uses recessed readout, not forced banner). */}
          {isRunning && isStatusExpanded && (
            <div className="rounded border border-[#2d4a38]/80 bg-[#0f1612]/90 px-2 py-1.5">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1 pt-0">
                    <span className="mt-0 mb-0.5 block text-[8px] uppercase leading-none tracking-[0.12em] text-[#5c6b62]">
                      Started on
                    </span>
                    <span
                      className="block truncate text-[10px] font-medium leading-tight tracking-tight text-[#7dcea0]/95"
                      title={displayRunUrl}
                    >
                      {displayRunUrl}
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
                    className="mt-0 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/25 bg-[#121212]/90 text-white transition-colors hover:border-[#4fde82] hover:bg-[#1a2620] hover:text-[#4fde82] vader-focus"
                    title="Hide connection details"
                    aria-label="Collapse connection details"
                    aria-expanded
                  >
                    <ChevronUp size={12} strokeWidth={2.5} className="text-white" />
                  </button>
                </div>
                <div className="mt-1 border-t border-[#2d4a38]/50 pt-1">
                  <span className="mb-0.5 block text-[8px] uppercase tracking-[0.12em] text-[#5c6b62]">
                    Uptime
                  </span>
                  <span className="tabular-nums text-[10px] font-medium leading-tight tracking-tight text-[#7dcea0]/95">
                    {liveUptime}
                  </span>
                </div>
                {healthLine?.showErrorCta && onViewErrorConsole && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewErrorConsole()
                    }}
                    className="mt-1.5 text-[9px] font-medium uppercase tracking-wide text-[#e02b20] underline decoration-[#e02b20]/50 hover:text-[#ff5555]"
                  >
                    View error console →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.625rem] items-center gap-1 px-2.5 py-1.5">
          <button
            type="button"
            onClick={() => {
              if ('action' in primaryBtn && typeof primaryBtn.action === 'function') {
                primaryBtn.action()
              }
            }}
            disabled={Boolean('disabled' in primaryBtn && primaryBtn.disabled === true)}
            className={`
              box-border flex h-8 min-h-8 max-h-8 w-full min-w-0 shrink-0 items-center justify-center gap-1 rounded border border-transparent py-0 text-[10px] leading-none transition-all whitespace-nowrap vader-focus
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
            <span className="min-w-0 truncate whitespace-nowrap">{primaryBtn.label}</span>
          </button>
          <button
            type="button"
            disabled={!onOpenInBrowser || !isRunning}
            onClick={(e) => {
              e.stopPropagation()
              if (isRunning && onOpenInBrowser) onOpenInBrowser()
            }}
            className={`box-border flex h-8 min-h-8 max-h-8 w-full min-w-0 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded border text-[10px] font-medium uppercase leading-none tracking-wide transition-all disabled:cursor-not-allowed vader-focus ${
              isRunning && onOpenInBrowser ? openBtnActiveClass : openBtnIdleClass
            }`}
            title={
              isRunning
                ? isWordPressLocal
                  ? 'Open WordPress site in browser'
                  : 'Open in browser'
                : 'Start the project to open in browser'
            }
          >
            <ExternalLink size={11} className="shrink-0" />
            <span className="whitespace-nowrap">Open</span>
          </button>
          <button
            type="button"
            onClick={onLogs}
            className="box-border flex h-8 min-h-8 max-h-8 w-full shrink-0 items-center justify-center justify-self-center rounded border border-[#333333] bg-[#2a2a2a] text-[#E8E8E8] transition-all hover:bg-[#4b5563] hover:border-[#4b5563] hover:text-white whitespace-nowrap vader-focus"
            title="Logs"
          >
            <Terminal size={12} className="shrink-0" />
          </button>
        </div>
        </div>
        </div>
        <ProjectMetaAccordion
          isCompact
          projectId={id}
          projectPath={projectPath}
          folderCreatedAt={project_folder_created_at}
          folderModifiedAt={project_folder_modified_at}
          onOpenChange={setCompactInfoOpen}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      {...msc_cinemaShellMotionProps}
      className={`
        group vader-card vpe-theme-font vpe-project-card boxBling relative w-full min-w-0 overflow-hidden rounded-[4px]
        ${
          isError
            ? `${msc_obsidianGlassShellCls} vpe-card-obsidian-glass--error`
            : msc_obsidianGlassShellCls
        }${projectPathMissing && !isError ? ' ring-1 ring-[#b45309]/50' : ''}
        ${motionExtraClassName ? ` ${motionExtraClassName}` : ''}
      `}
    >
        <div
          className={`flex flex-col rounded-t-[4px] ${cardChromeHeaderSelected}`}
        >
        <div className="relative w-full shrink-0 rounded-t-[4px] border-b border-[#333333] bg-[#0a0a0a]">
        {msc_reorderArrowStack}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden will-change-transform">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={name}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${cinemaInspectOpen ? 'opacity-70' : 'opacity-80'}`}
          />
        ) : (
          <div className="flex h-full min-h-0 w-full items-center justify-center vader-grid-pattern">
            <span className="text-xs text-[#333333] uppercase tracking-wider">THUMBNAIL</span>
          </div>
        )}
        </div>

        <div
          className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          aria-hidden
        >
          <span
            className={`block shrink-0 rounded-full border-0 ring-1 ring-white/12 shadow-[0_0_8px_rgba(0,0,0,0.65)] ${
              isRunning || watchdogRestartInProgress ? 'motion-safe:animate-pulse' : ''
            }`}
            title={dotTitle}
            style={{
              width: 10,
              height: 10,
              backgroundColor: watchdogRestartInProgress ? '#ff7700' : isRunning ? '#4fde82' : dotHex,
            }}
          />
          {isRunning || watchdogRestartInProgress ? (
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
            className="pointer-events-none absolute right-2 top-2 z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
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
        {projectPathMissing ? (
          <div
            role="status"
            className="flex items-center gap-2 border-t border-[#7f1d1d]/35 bg-[#1a1212] px-3 py-1.5"
          >
            <AlertTriangle size={12} className="shrink-0 text-[#f97316]" aria-hidden />
            <span className="font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-[#fdba74]">
              Path missing on disk · logs: Relink
            </span>
          </div>
        ) : null}

      </div>

      <div className="min-w-0 bg-[#242424]/90">
      <div className="flex h-auto flex-col gap-2 px-4 pb-2 pt-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-h-7 min-w-0 flex-1 items-center gap-2 pr-0.5">
              <h3
                className="vpe-card-title min-w-0 truncate text-base leading-tight text-white"
                title={name}
              >
                {name}
              </h3>
              {isError && <AlertTriangle size={14} className="text-[#ff4444] shrink-0" />}
              {projectPathMissing && !isError && (
                <span
                  className="shrink-0 rounded border border-[#78350f]/80 bg-[#292018] px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-[#fdba74]"
                  title="Registry workspace path not found"
                >
                  Missing
                </span>
              )}
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

          {watchdogRestartInProgress ? (
            <div className="flex h-auto min-h-[2.5rem] w-full shrink-0 items-center justify-between gap-2 rounded-[4px] border border-[#ff7700]/30 bg-[#ff7700]/10 px-2 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-[#ff7700] shadow-[0_0_4px_rgba(255,119,0,0.5)] ring-1 ring-white/15 motion-safe:animate-pulse" aria-hidden />
                <span className={`${msc_readoutLiveTextCls} text-[#ff7700]`}>
                  RESTARTING...
                </span>
              </div>
            </div>
          ) : isRunning && !isStatusExpanded ? (
            <div className="flex h-auto min-h-[2.5rem] w-full shrink-0 items-center justify-between gap-2 rounded-[4px] border border-white/5 bg-[#121212]/60 px-2 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className={msc_readoutDotCls} aria-hidden />
                <span
                  className={msc_readoutLiveTextCls}
                  title={`${getStatusLabel()} — ${displayPortOrDomain}${healthLine?.label ? ` · ${healthLine.label}` : ''}`}
                >
                  {getStatusLabel()} — {displayPortOrDomain}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsStatusExpanded((v) => !v)
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded text-[#4fde82] transition-colors hover:bg-white/[0.06] hover:text-white vader-focus"
                title="Show connection details"
                aria-label="Expand connection details"
                aria-expanded={false}
              >
                <ChevronDown size={12} strokeWidth={2} className="shrink-0 motion-safe:!animate-none" />
              </button>
            </div>
          ) : isRunning && isStatusExpanded ? null : (
            <div className="flex h-auto min-h-[2.5rem] w-full shrink-0 items-center rounded-[4px] border border-white/5 bg-[#121212]/60 px-2 py-1.5">
              {isIdleStopped ? (
                <span className={msc_readoutReadyTextCls}>READY</span>
              ) : (
                <span
                  className={`${msc_readoutStatusTextCls} ${
                    isError
                      ? 'text-[#e02b20]'
                      : isBuilding || devInstallInProgress
                        ? 'text-[#ffcc00]'
                        : 'text-[#888888]'
                  }`}
                >
                  {getStatusLabel()}
                </span>
              )}
            </div>
          )}

          {isError && errorMessage && (
            <div className="rounded border border-[#ff4444]/30 bg-[#ff4444]/10 p-2">
              <span className="text-[11px] text-[#ff4444]">{errorMessage}</span>
            </div>
          )}

          {isRunning && isStatusExpanded && (
            <div className="rounded border border-[#2d4a38]/80 bg-[#0f1612]/90 px-2.5 py-2">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 pt-0">
                    <span className="mt-0 mb-0.5 block text-[8px] uppercase leading-none tracking-[0.12em] text-[#5c6b62]">
                      Started on
                    </span>
                    <span
                      className="block truncate text-[10px] font-medium leading-tight tracking-tight text-[#7dcea0]/95"
                      title={displayRunUrl}
                    >
                      {displayRunUrl}
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
                    <ChevronUp size={12} strokeWidth={2.5} className="text-white" />
                  </button>
                </div>
                <div className="mt-1.5 border-t border-[#2d4a38]/50 pt-1.5">
                  <span className="mb-0.5 block text-[8px] uppercase tracking-[0.12em] text-[#5c6b62]">
                    Uptime
                  </span>
                  <span className="tabular-nums text-[10px] font-medium leading-tight tracking-tight text-[#7dcea0]/95">
                    {liveUptime}
                  </span>
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
            </div>
          )}
        </div>

      <div className="flex min-w-0 flex-row flex-nowrap items-center gap-2 px-4 pb-3 pt-1">
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
          disabled={!onOpenInBrowser || !isRunning}
          onClick={(e) => {
            e.stopPropagation()
            if (isRunning && onOpenInBrowser) onOpenInBrowser()
          }}
          className={`box-border min-h-7 max-h-7 min-w-[5.5rem] flex-1 flex items-center justify-center gap-1.5 h-7 rounded border text-[11px] font-medium uppercase tracking-wide transition-all disabled:cursor-not-allowed vader-focus ${
            isRunning && onOpenInBrowser ? openBtnActiveClass : openBtnIdleClass
          }`}
          title={
            isRunning
              ? isWordPressLocal
                ? 'Open WordPress site in browser'
                : 'Open in browser'
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
      </div>
      </div>
      <ProjectMetaAccordion
        isCompact={false}
        projectId={id}
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
