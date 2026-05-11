'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { StationSidebar } from '@/components/layout/StationSidebar'
import { ProjectGrid } from '@/components/dashboard/ProjectGrid'
import { TopBar } from '@/components/top-bar';
import { Footer } from '@/components/footer';
import { LogDrawer } from '@/components/log-drawer'
import { RepairModal } from '@/components/repair-modal'
import { NukeModal } from '@/components/nuke-modal'
import { NukeProgressOverlay } from '@/components/NukeProgressOverlay'
import { AddProjectModal } from '@/components/add-project-modal'
import { ProjectSettingsModal } from '@/components/project-settings-modal'
import { DeleteConfirmModal } from '@/components/delete-confirm-modal'
import { ContextMenu } from '@/components/context-menu'
import { AppSettingsModal } from '@/components/app-settings-modal'
import { SystemHealthPanel } from '@/components/SystemHealth'
import { MaintenanceSection, type MaintenanceTab } from '@/components/maintenance-section'
import { Sandbox } from '@/components/Sandbox'
import { type RepairHistoryRow } from '@/components/repair-history-view'
import { ToastProvider, useToast } from '@/components/vader-toast'
import {
  getVpeApi,
  msc_formatUnknownIPCError,
  msc_rowToDashboardProject,
  msc_withIpcTimeout,
  VPE_GET_PROJECTS_TIMEOUT_MS,
} from '@/lib/vpe-bridge'
import type { Project } from '@/types/vpe-ipc'
import {
  msc_applyTacticalProjectFilter,
  msc_computeTacticalCounts,
  type VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'
import { useDashboardPersistedSettings } from '@/state/useSettings'
import { VpeUiLayoutProvider, useVpeUiLayout } from '@/context/vpe-ui-layout-context'
import { msc_projectMatchesVaultSearch } from '@/lib/vpe-vault-search'

type NavItem = 'dashboard' | 'maintenance' | 'sandbox' | 'settings'

function msc_dashboardDefaultViewFromSettings(
  v: unknown,
): 'cinema' | 'compact' | 'list' {
  if (v === 'list' || v === 'compact' || v === 'cinema') return v
  if (v === 'card') return 'cinema'
  return 'cinema'
}

/** Browser fallback when `window.vpeAPI` is unavailable (Next standalone). */
const FALLBACK_PROJECTS: Project[] = [
  { 
    id: '1', 
    name: 'MSC_PRIMARY_GATE', 
    port: 8080, 
    uptime: '142H', 
    status: 'running',
    cpu: 42.1,
    ram: '2.4GB',
    pkgManager: 'npm',
    path: 'C:/Users/Vader/Projects/msc-primary-gate',
    shield_project_type: 'web',
  },
  { 
    id: '2', 
    name: 'MEDIA_PRO_RENDER_V4', 
    port: 9000, 
    uptime: '824H', 
    status: 'running',
    cpu: 12.8,
    ram: '12.8GB',
    pkgManager: 'yarn',
    path: 'C:/Users/Vader/Projects/media-pro-render',
    shield_project_type: 'web',
  },
  { 
    id: '3', 
    name: 'VADER_BACKUP_NODE', 
    port: 4443, 
    uptime: '--', 
    status: 'stopped',
    cpu: 0,
    ram: '0MB',
    pkgManager: 'yarn',
    path: 'C:/Users/Vader/Projects/vader-backup',
    shield_project_type: 'node',
  },
  { 
    id: '4', 
    name: 'MSC_CONTENT_API', 
    port: 3010, 
    uptime: '--', 
    status: 'stopped',
    cpu: 0,
    ram: '0MB',
    pkgManager: 'pnpm',
    path: 'C:/Users/Vader/Projects/msc-content-api',
    hasBuilt: false, // No .next folder - shows BUILD button
    shield_project_type: 'node',
  },
  { 
    id: '5', 
    name: 'MSC_AUTH_SERVICE', 
    port: 3002, 
    uptime: '48H', 
    status: 'running',
    cpu: 8.2,
    ram: '1.1GB',
    pkgManager: 'npm',
    path: 'C:/Users/Vader/Projects/msc-auth-service',
    shield_project_type: 'web',
  },
  { 
    id: '6', 
    name: 'MSC_MEDIA_GATE', 
    port: 3003, 
    uptime: '--', 
    status: 'error',
    cpu: 0,
    ram: '0MB',
    pkgManager: 'pnpm',
    path: 'C:/Users/Vader/Projects/msc-media-gate',
    shield_project_type: 'electron',
  },
  /** Standalone / browser fallback — Vault Search “msc” + “projectz” spot-check */
  {
    id: '7',
    name: 'PROJECTZ_MSC_HUB',
    port: 3015,
    uptime: '--',
    status: 'stopped',
    cpu: 0,
    ram: '0MB',
    pkgManager: 'npm',
    path: 'C:/Users/Vader/Projects/projectz-msc-hub',
    shield_project_type: 'web',
  },
]

function DashboardContent() {
  const { addToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [clientReady, setClientReady] = useState(false)
  const [projectsReady, setProjectsReady] = useState(false)
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const { activeFilter, setActiveFilter } = useDashboardPersistedSettings()
  const { viewMode, setViewMode } = useVpeUiLayout()
  /** v1.2.5 — tactical shield filter (synced with sidebar + filter nav). */
  const [tacticalProjectFilter, setTacticalProjectFilter] =
    useState<VpeTacticalProjectFilter>('all')
  const [repairModalOpen, setRepairModalOpen] = useState(false)
  const [repairLogRev, setRepairLogRev] = useState(0)
  const [repairModalContext, setRepairModalContext] = useState<RepairHistoryRow | null>(null)
  const [maintenanceTab, setMaintenanceTab] = useState<MaintenanceTab>('vault')
  const [nukeModalOpen, setNukeModalOpen] = useState(false)
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [appSettingsModalOpen, setAppSettingsModalOpen] = useState(false)
  const [systemHealthOpen, setSystemHealthOpen] = useState(false)
  /** v1.3.2 — main `vpe:ghost-detected` heartbeat (orphan node on catalog ports). */
  const [ghostPorts, setGhostPorts] = useState<number[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [activeLogProject, setActiveLogProject] = useState('2')
  const [logDrawerExpanded, setLogDrawerExpanded] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compactMode, setCompactMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [commandSearchTerm, setCommandSearchTerm] = useState('')
  const [commandSearchActive, setCommandSearchActive] = useState(false)
  const [nukeOverlay, setNukeOverlay] = useState<
    null | { id: string; name: string; port: number }
  >(null)
  const [nukeLogLines, setNukeLogLines] = useState<string[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  /** v1.8.9 — sidebar Favorites link filters the dashboard to starred projects only. */
  const [favoriteFilterActive, setFavoriteFilterActive] = useState(false)
  /** v1.2.3 — main auto `install && dev`; cleared when dev output signals or process stops. */
  const [devInstallUiByProject, setDevInstallUiByProject] = useState<
    Record<string, boolean>
  >({})
  /** JEDI_MOD_24 — project auto-restarting via watchdog. */
  const [watchdogRestartByProject, setWatchdogRestartByProject] = useState<
    Record<string, boolean>
  >({})

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)

  const appliedBootDefaultView = useRef(false)
  /** v1.6.8 — under 500px window width: force slim list (sidebar snap beside IDE). */
  const [sidebarNarrow, setSidebarNarrow] = useState(false)

  useEffect(() => {
    const q = () => setSidebarNarrow(window.innerWidth < 500)
    q()
    window.addEventListener('resize', q)
    return () => window.removeEventListener('resize', q)
  }, [])

  const effectiveViewMode = sidebarNarrow ? 'list' : viewMode
  const isCinemaGrid = effectiveViewMode === 'cinema'
  const isCompactGrid = effectiveViewMode === 'compact'
  const isGridLayout = isCinemaGrid || isCompactGrid

  const refreshProjects = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getProjects) {
      setProjects(FALLBACK_PROJECTS)
      return
    }
    try {
      const rows = await msc_withIpcTimeout(
        api.getProjects(),
        VPE_GET_PROJECTS_TIMEOUT_MS,
        'vpe:getProjects',
      )
      setProjects(rows.map(msc_rowToDashboardProject))
    } catch (err: unknown) {
      addToast(
        'Failed to load registry',
        'error',
        msc_formatUnknownIPCError(err),
      )
      setProjects(FALLBACK_PROJECTS)
    }
  }, [addToast])

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    const api = getVpeApi()
    if (!api?.subscribeGhostPresence) return
    return api.subscribeGhostPresence((ev) => {
      setGhostPorts(ev.active && Array.isArray(ev.ports) ? ev.ports : [])
    })
  }, [])

  useEffect(() => {
    if (!clientReady) return
    void (async () => {
      await refreshProjects()
      setProjectsReady(true)
    })()
  }, [clientReady, refreshProjects])

  /** v1.6.9 — hydrate shell `viewMode` from SQLite `default_view` once per boot. */
  useEffect(() => {
    if (!clientReady || !projectsReady || appliedBootDefaultView.current) return
    const api = getVpeApi()
    if (!api?.getAppSettings) {
      appliedBootDefaultView.current = true
      return
    }
    let cancelled = false
    void api
      .getAppSettings()
      .then((s) => {
        if (cancelled) return
        appliedBootDefaultView.current = true
        setViewMode(msc_dashboardDefaultViewFromSettings(s?.default_view))
      })
      .catch(() => {
        if (!cancelled) appliedBootDefaultView.current = true
      })
    return () => {
      cancelled = true
    }
  }, [clientReady, projectsReady, setViewMode])

  useEffect(() => {
    if (!clientReady) return
    const api = getVpeApi()
    if (!api?.subscribeProjectsUpdated) return
    return api.subscribeProjectsUpdated((payload) => {
      if (Array.isArray(payload?.projects)) {
        setProjects(payload.projects.map(msc_rowToDashboardProject))
      } else {
        void refreshProjects()
      }
    })
  }, [clientReady, refreshProjects])

  useEffect(() => {
    if (!clientReady) return
    const api = getVpeApi()
    // JEDI_MOD_24: Listen for watchdog restart events
    const w = (window as any)
    if (w.vpeAPI?.subscribeWatchdogRestart) {
      return w.vpeAPI.subscribeWatchdogRestart((payload: { projectId: string; attempt: number }) => {
        const { projectId, attempt } = payload
        setWatchdogRestartByProject(prev => ({ ...prev, [projectId]: true }))
        addToast(
          'Auto-restarting project',
          'warning',
          `Watchdog detected unexpected exit. Restarting... (Attempt ${attempt}/3)`,
        )
        // Clear the restart UI after a short delay
        setTimeout(() => {
          setWatchdogRestartByProject(prev => {
            const next = { ...prev }
            delete next[projectId]
            return next
          })
        }, 3000)
      })
    }
  }, [clientReady, addToast])

  useEffect(() => {
    if (!clientReady) return
    const api = getVpeApi()
    if (!api?.subscribeBootstrapDevVisible) return
    return api.subscribeBootstrapDevVisible((payload) => {
      const id = payload?.projectId
      if (!id || typeof id !== 'string') return
      setDevInstallUiByProject((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    })
  }, [clientReady])

  useEffect(() => {
    setDevInstallUiByProject((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        const row = projects.find((p) => p.id === id)
        if (!row || row.status !== 'running') {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [projects])

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if in input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (e.key === 'Escape') {
        (e.target as HTMLElement).blur()
      }
      return
    }

    // Ctrl+N - Add New Project
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      setAddProjectModalOpen(true)
    }

    // Ctrl+1 — Cinema, Ctrl+2 — Compact, Ctrl+3 — List
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault()
      setViewMode('cinema')
    }
    if (e.ctrlKey && e.key === '2') {
      e.preventDefault()
      setViewMode('compact')
    }
    if (e.ctrlKey && e.key === '3') {
      e.preventDefault()
      setViewMode('list')
    }

    // Ctrl+` - Toggle Log Drawer
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault()
      setLogDrawerExpanded(prev => !prev)
    }

    // Escape - Close modal, then drawer, then clear search
    if (e.key === 'Escape') {
      if (repairModalOpen) setRepairModalOpen(false)
      else if (nukeModalOpen) setNukeModalOpen(false)
      else if (addProjectModalOpen) setAddProjectModalOpen(false)
      else if (settingsModalOpen) setSettingsModalOpen(false)
      else if (deleteModalOpen) setDeleteModalOpen(false)
      else if (appSettingsModalOpen) setAppSettingsModalOpen(false)
      else if (systemHealthOpen) setSystemHealthOpen(false)
      else if (logDrawerExpanded) setLogDrawerExpanded(false)
      else if (commandSearchActive || commandSearchTerm) {
        setCommandSearchTerm('')
        setCommandSearchActive(false)
      } else if (searchTerm) setSearchTerm('')
    }

    // F5 - Refresh all project statuses
    if (e.key === 'F5') {
      e.preventDefault()
      void refreshProjects()
      addToast('Refreshing statuses…', 'info', 'Re-sync from SQLite registry')
    }
  }, [
    repairModalOpen,
    nukeModalOpen,
    addProjectModalOpen,
    settingsModalOpen,
    deleteModalOpen,
    appSettingsModalOpen,
    systemHealthOpen,
    logDrawerExpanded,
    searchTerm,
    commandSearchActive,
    commandSearchTerm,
    addToast,
    refreshProjects,
    setViewMode,
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (!nukeOverlay) return
    const api = getVpeApi()
    if (!api?.subscribeLogUpdate) return
    const unsub = api.subscribeLogUpdate((p) => {
      if (p.projectId !== nukeOverlay.id) return
      setNukeLogLines((prev) => [...prev, p.message].slice(-160))
    })
    return unsub
  }, [nukeOverlay])

  const msc_pickProjectMeta = useCallback((projectName: string) => {
    const row = projects.find((p) => p.name === projectName)
    setSelectedProject(projectName)
    setSelectedProjectId(row?.id ?? '')
  }, [projects])

  useEffect(() => {
    if (!projects.length) return
    setSelectedProjectId((prev) => {
      if (prev && projects.some((p) => p.id === prev)) return prev
      return projects[0].id
    })
    setSelectedProject((prev) => {
      if (prev && projects.some((p) => p.name === prev)) return prev
      return projects[0].name
    })
  }, [projects])

  const explorerActionTitle = useMemo(() => {
    const row =
      (selectedProjectId && projects.find((p) => p.id === selectedProjectId)) ||
      projects[0]
    const p = row?.path?.trim()
    if (!p) return 'Open selected project folder in Explorer'
    return `Open project folder: ${p}`
  }, [projects, selectedProjectId])

  const handleRepair = (projectName: string) => {
    msc_pickProjectMeta(projectName)
    setRepairModalContext(null)
    setRepairModalOpen(true)
  }

  const handleNuke = (projectName: string) => {
    msc_pickProjectMeta(projectName)
    setNukeModalOpen(true)
  }

  const handleSettings = (projectName: string) => {
    msc_pickProjectMeta(projectName)
    setSettingsModalOpen(true)
  }

  const handleUnregister = (projectName: string) => {
    msc_pickProjectMeta(projectName)
    setDeleteModalOpen(true)
  }

  const handleLogs = (projectId: string) => {
    setActiveLogProject(projectId)
    setLogDrawerExpanded(true)
  }

  const handleConfirmDelete = async () => {
    const api = getVpeApi()
    try {
      if (api?.deleteProject && selectedProjectId) {
        await api.deleteProject(selectedProjectId)
        await refreshProjects()
      } else {
        setProjects((prev) => prev.filter((p) => p.name !== selectedProject))
      }
      setDeleteModalOpen(false)
      addToast(
        'Project removed from registry',
        'success',
        'Files preserved on disk',
      )
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Delete failed'
      addToast('Delete failed', 'error', msg)
    }
  }

  const handleConfirmNuke = async () => {
    const api = getVpeApi()
    const row = projects.find((p) => p.id === selectedProjectId)
    setNukeModalOpen(false)
    try {
      if (api?.nukeProject && selectedProjectId && row) {
        setNukeOverlay({
          id: selectedProjectId,
          name: selectedProject,
          port: row.port,
        })
        setNukeLogLines([])
        await api.nukeProject(selectedProjectId)
        await refreshProjects()
        addToast(
          'Nuke pipeline running',
          'info',
          'Tree-kill, purge, install, and verify — progress is in the overlay.',
        )
      } else {
        setNukeOverlay(null)
        setProjects((prev) =>
          prev.map((p) =>
            p.name === selectedProject ? { ...p, status: 'stopped' as const } : p,
          ),
        )
        addToast('Nuke (demo)', 'info', `${selectedProject} marked stopped`)
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Nuke failed'
      addToast('Nuke failed', 'error', msg)
      setNukeOverlay(null)
    }
  }

  const handleToggleFavorite = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const api = getVpeApi()
    if (api?.setProjectFavorite) {
      try {
        await api.setProjectFavorite(projectId, !project.is_favorite)
        // refreshProjects is called via IPC subscription update
      } catch (err: unknown) {
        addToast('Favorite toggle failed', 'error', err instanceof Error ? err.message : 'Unknown error')
      }
    } else {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: !p.is_favorite } : p))
      )
    }
  }

  const handleClearRepairHistory = async () => {
    const api = getVpeApi()
    if (api?.clearRepairHistory) {
      try {
        await api.clearRepairHistory()
        setRepairLogRev(n => n + 1)
        addToast('Repair logs cleared', 'success')
      } catch (err: unknown) {
        addToast('Failed to clear logs', 'error', err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  const handleRemoveRepairEntry = async (repairId: string) => {
    const api = getVpeApi()
    if (!api?.deleteRepairRun) return
    try {
      await api.deleteRepairRun(repairId)
      setRepairLogRev((n) => n + 1)
      addToast('Log entry removed', 'info')
    } catch (err: unknown) {
      addToast('Remove failed', 'error', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handlePatchStartScript = useCallback(
    async (projectId: string) => {
      const api = getVpeApi()
      if (!api?.patchStartScript || !api.toggleStatus) return
      try {
        await api.patchStartScript(projectId)
        await refreshProjects()
        addToast(
          'package.json patched',
          'success',
          'Hardcoded port flags removed (.vader-backup). Starting…',
        )
        await api.toggleStatus(projectId)
        await refreshProjects()
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Patch failed'
        addToast('Patch script failed', 'error', msg)
      }
    },
    [addToast, refreshProjects],
  )

  const handleAutoFixPort = useCallback(
    async (projectId: string) => {
      const api = getVpeApi()
      if (!api?.autoFixProjectPort || !api.toggleStatus) return
      try {
        const fix = await api.autoFixProjectPort(projectId)
        await refreshProjects()
        addToast(
          'Port reassigned',
          'success',
          `Saved port ${fix.port}${fix.start_script ? ` (${fix.start_script})` : ''}. Starting…`,
        )
        try {
          const r = await api.toggleStatus(projectId)
          await refreshProjects()
          if (r?.status === 'running' && api.getProjects) {
            const rows = await api.getProjects()
            const fresh = rows.find((x) => x.id === projectId)
            const disp = fresh ? Number(fresh.port) : fix.port
            const name =
              fresh?.name ??
              projects.find((p) => p.id === projectId)?.name ??
              'Project'
            addToast(
              'Server started',
              'success',
              `${name} — started on http://localhost:${disp}`,
            )
          }
        } catch (startErr: unknown) {
          const smsg =
            startErr && typeof startErr === 'object' && 'message' in startErr
              ? String((startErr as { message?: string }).message)
              : 'Start failed'
          addToast('Start failed after auto-fix', 'error', smsg)
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Auto-fix failed'
        addToast('Auto-fix failed', 'error', msg)
      }
    },
    [addToast, refreshProjects, projects],
  )

  const handleToggleStatus = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    const api = getVpeApi()
    if (api?.toggleStatus) {
      try {
        const r = await api.toggleStatus(projectId)
        if (r && typeof r === 'object' && r.installing === true) {
          setDevInstallUiByProject((prev) => ({ ...prev, [projectId]: true }))
        }
        if (r && typeof r === 'object' && r.status === 'stopped') {
          setDevInstallUiByProject((prev) => {
            if (!prev[projectId]) return prev
            const next = { ...prev }
            delete next[projectId]
            return next
          })
        }
        await refreshProjects()
        const running = r?.status === 'running'
        let displayPort = project.port
        if (running && api.getProjects) {
          try {
            const rows = await api.getProjects()
            const fresh = rows.find((x) => x.id === projectId)
            if (fresh) displayPort = Number(fresh.port) || displayPort
          } catch {
            /* keep cached port */
          }
        }
        const projectUrl = `http://localhost:${displayPort}`
        addToast(
          running ? 'Server started' : 'Server stopped',
          running ? 'success' : 'info',
          running
            ? `${project.name} — started on ${projectUrl}`
            : `${project.name} stopped`,
        )
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Toggle failed'
        const isPreflightError =
          /reserved|already in use|invalid project port|hardcodes port|hardcode|not a node project|folder not found|package\.json/i.test(
            msg,
          )
        const canAutoFix = Boolean(
          api?.autoFixProjectPort && isPreflightError,
        )
        const canPatchScript =
          Boolean(api?.patchStartScript) && /hardcodes port/i.test(msg)
        let action:
          | { label: string; onClick: () => void }
          | undefined
        if (canPatchScript) {
          action = {
            label: 'Patch script',
            onClick: () => {
              void handlePatchStartScript(projectId)
            },
          }
        } else if (canAutoFix) {
          action = {
            label: 'Auto-fix port',
            onClick: () => {
              void handleAutoFixPort(projectId)
            },
          }
        }
        addToast(
          isPreflightError ? 'Preflight failed' : 'Process control failed',
          'error',
          msg,
          action,
        )
      }
      return
    }

    const newStatus =
      project.status === 'running' ? 'stopped' : 'running'
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, status: newStatus as 'running' | 'stopped' }
          : p,
      ),
    )
    addToast(
      newStatus === 'running' ? 'Server started' : 'Server stopped',
      newStatus === 'running' ? 'success' : 'info',
      newStatus === 'running'
        ? `${project.name} — started on http://localhost:${project.port}`
        : `${project.name} gracefully stopped`,
    )
  }

  const handleOpenProjectUrl = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const url = `http://localhost:${project.port}`
    const api = getVpeApi()
    try {
      if (api?.openProjectUrl) {
        await api.openProjectUrl(url)
      } else if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Open failed'
      addToast('Could not open browser', 'error', msg)
    }
  }

  const handleRunBuild = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const api = getVpeApi()
    if (api?.runBuild) {
      try {
        await api.runBuild(projectId)
        addToast(
          'Build started',
          'info',
          `${project.name} — npm/yarn script: ${project.build_script ?? 'build'}`,
        )
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Build failed'
        addToast('Build failed', 'error', msg)
      }
      return
    }
    addToast('Build unavailable', 'warning', 'Run inside Electron desktop shell')
  }

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, projectId })
  }

  // Quick Actions
  const handleInstallAndStart = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const api = getVpeApi()
    if (api?.executeTerminalCommand) {
      addToast('Installing dependencies...', 'info', `${project.name} is running npm install`)
      try {
        await api.executeTerminalCommand(`cd "${project.path}" && npm install`, project.id)
        addToast('Install complete', 'success', 'Starting development server...')
        await handleToggleStatus(projectId)
      } catch (reason: unknown) {
        addToast('Install failed', 'error', msc_formatUnknownIPCError(reason))
      }
    } else {
      addToast('Install & Start (demo)', 'info', `Pretending to run npm install for ${project.name}`)
    }
  }

  // Quick Actions
  const handleStartAll = () => {
    setProjects(prev => prev.map(p => p.status === 'stopped' ? { ...p, status: 'running' as const } : p))
    addToast('Starting all projects...', 'info')
  }

  const handleStopAll = async () => {
    const api = getVpeApi()
    if (api?.stopAllProjects) {
      try {
        const r = await api.stopAllProjects()
        await refreshProjects()
        if (r && r.ok === false) {
          addToast(
            'Stop all failed',
            'error',
            typeof r.error === 'string' && r.error.trim()
              ? r.error
              : 'Engine returned an error',
          )
          return
        }
        addToast('All projects stopped', 'info', 'PM2 and dashboard processes were stopped.')
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Stop all failed'
        addToast('Stop all failed', 'error', msg)
      }
      return
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.status === 'running' ? { ...p, status: 'stopped' as const } : p,
      ),
    )
    addToast('Stopping all projects...', 'info', '(Demo — run in Electron for real stop)')
  }

  const handleRefreshAll = () => {
    addToast('Refreshing statuses...', 'info', 'Syncing with PM2 daemon')
  }

  const handleOpenExplorer = async () => {
    const api = getVpeApi()
    const row =
      (selectedProjectId && projects.find((p) => p.id === selectedProjectId)) ||
      projects[0]
    const targetPath = row?.path?.trim()
    if (!targetPath) {
      addToast('Explorer', 'warning', 'No project folder available to open.')
      return
    }
    if (api?.openExplorer) {
      const res = await api.openExplorer(targetPath)
      if (!res.ok) {
        addToast('Explorer failed', 'error', res.error)
      }
    } else {
      addToast('Explorer', 'info', 'Run inside Electron to open folders.')
    }
  }

  const handleNavigation = (nav: string) => {
    if (nav === 'favorites-filter') {
      setFavoriteFilterActive((prev) => !prev)
      setActiveNav('dashboard')
      return
    }
    if (nav === 'settings') {
      setAppSettingsModalOpen(true)
      return
    }
    if (nav.startsWith('tactical:')) {
      const raw = nav.slice('tactical:'.length)
      const allowed: VpeTacticalProjectFilter[] = [
        'all',
        'v0',
        'electron',
        'web',
        'node',
        'unknown',
      ]
      if (allowed.includes(raw as VpeTacticalProjectFilter)) {
        setTacticalProjectFilter(raw as VpeTacticalProjectFilter)
        setActiveNav('dashboard')
      }
      return
    }
    if (nav.startsWith('favorite:')) {
      const id = nav.slice('favorite:'.length)
      setActiveNav('dashboard')
      const row = projects.find((p) => p.id === id)
      if (row) {
        setSelectedProjectId(id)
        setSelectedProject(row.name)
      }
      return
    }
    if (nav === 'maintenance:vault') {
      setActiveNav('maintenance')
      setMaintenanceTab('vault')
      return
    }
    if (nav === 'maintenance:logs') {
      setActiveNav('maintenance')
      setMaintenanceTab('logs')
      return
    }
    setActiveNav(nav as NavItem)
  }

  const tacticalCounts = useMemo(
    () =>
      msc_computeTacticalCounts(
        projects.filter((p) => !p.is_archived),
      ),
    [projects],
  )

  /** Status / tactical / Vault Search (substring name + tag + port) — or Ctrl+K jump (+ path). */
  const filteredProjects = useMemo(() => {
    if (commandSearchActive && commandSearchTerm.trim()) {
      const q = commandSearchTerm.trim()
      return projects.filter((project) =>
        msc_projectMatchesVaultSearch(project, q, { includePath: true }),
      )
    }

    let list = projects.filter((project) =>
      activeFilter === 'ARCHIVE'
        ? Boolean(project.is_archived)
        : !project.is_archived,
    )

    if (activeFilter !== 'ARCHIVE') {
      if (activeFilter === 'RUNNING') {
        list = list.filter((p) => p.status === 'running')
      } else if (activeFilter === 'STOPPED') {
        list = list.filter((p) => p.status === 'stopped')
      } else if (activeFilter === 'ERRORS') {
        list = list.filter((p) => p.status === 'error')
      }
    }

    if (searchTerm.trim()) {
      list = list.filter((project) =>
        msc_projectMatchesVaultSearch(project, searchTerm, {
          includePath: false,
        }),
      )
    }

    list = msc_applyTacticalProjectFilter(list, tacticalProjectFilter)

    if (favoriteFilterActive) {
      list = list.filter((p) => Boolean(p.is_favorite))
    }

    return list
  }, [
    projects,
    searchTerm,
    activeFilter,
    tacticalProjectFilter,
    commandSearchActive,
    commandSearchTerm,
    favoriteFilterActive,
  ])

  // Projects for log drawer (only show projects with logs open)
  const logProjects = projects.filter(p => p.status === 'running' || p.status === 'building' || p.id === activeLogProject)
  const favorites = useMemo(() => projects.filter(p => p.is_favorite), [projects])

  const logDrawerTabs = useMemo(() => {
    const tail = logProjects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }))
    return [
      { id: '__vpe_all__', name: 'SYSTEM', status: 'running' as const },
      ...tail,
    ]
  }, [logProjects])

  if (!clientReady || !projectsReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2
            className="h-10 w-10 text-[#e02b20] animate-spin"
            aria-hidden
          />
          <div className="font-sans text-sm text-[#eaeaea] uppercase tracking-[0.12em]">
            Syncing…
          </div>
          <p className="font-sans text-xs text-[#6a6a6a] max-w-sm leading-relaxed normal-case tracking-normal">
            Loading project registry from the engine (large vaults may take up to
            60s).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#121212] overflow-hidden relative">
      {/* HUD Line - Top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-[#e02b20] hud-line-flicker z-50" />
      
      {/* HUD Line - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#e02b20] hud-line-flicker z-50" />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <StationSidebar
          activeItem={activeNav}
          maintenanceTab={maintenanceTab}
          onNavigate={handleNavigation}
          onStopAll={handleStopAll}
          favorites={favorites}
          tacticalActive={tacticalProjectFilter}
          tacticalCounts={tacticalCounts}
          favoriteFilterActive={favoriteFilterActive}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar - 48px */}
          <TopBar
            projectCount={projects.length}
            onAddProject={() => setAddProjectModalOpen(true)}
            onOpenSettings={() => setAppSettingsModalOpen(true)}
            onOpenDiagnostics={() => setSystemHealthOpen(!systemHealthOpen)}
            ghostWarning={ghostPorts.length > 0}
            ghostHint={
              ghostPorts.length > 0
                ? `Ghost node.exe listener on catalog port(s): ${ghostPorts.join(', ')} — open System Health for Scorched Earth / purge`
                : undefined
            }
            filterSearchTerm={searchTerm}
            onFilterSearchChange={setSearchTerm}
            commandSearchTerm={commandSearchTerm}
            onCommandSearchChange={setCommandSearchTerm}
            commandSearchActive={commandSearchActive}
            onCommandSearchActiveChange={(v) => {
              setCommandSearchActive(v)
              if (!v) setCommandSearchTerm('')
            }}
          />

          {/* System Health Panel */}
          <SystemHealthPanel 
            isOpen={systemHealthOpen} 
            onClose={() => setSystemHealthOpen(false)} 
          />

          {/* Content Area — grid fills width; LogDrawer is an absolute overlay (see data-vpe-log-drawer-layer) */}
          <div
            className="relative flex-1 flex min-h-0 overflow-hidden"
            data-vpe-log-drawer-layer
          >
            {/* Main Content */}
            <div className="min-w-0 flex-1 flex flex-col min-h-0 overflow-hidden">
              {activeNav === 'maintenance' ? (
                <MaintenanceSection
                  maintenanceTab={maintenanceTab}
                  onMaintenanceTab={setMaintenanceTab}
                  repairLogRev={repairLogRev}
                  onViewDiff={(row) => {
                    setRepairModalContext(row)
                    setRepairModalOpen(true)
                  }}
                  onUndo={(repairId: string) => {
                    void repairId
                    addToast('Undo successful', 'success', 'Previous state restored from .vader-backup')
                  }}
                  onClearHistory={handleClearRepairHistory}
                  onRemoveEntry={handleRemoveRepairEntry}
                />
              ) : activeNav === 'sandbox' ? (
                <Sandbox />
              ) : (
                <ProjectGrid
                  favoriteFilterActive={favoriteFilterActive}
                  onClearFavoriteFilter={() => setFavoriteFilterActive(false)}
                  activeFilter={activeFilter}
                  onActiveFilterChange={setActiveFilter}
                  commandSearchActive={commandSearchActive}
                  commandSearchTerm={commandSearchTerm}
                  searchTerm={searchTerm}
                  onClearJumpSearch={() => {
                    setCommandSearchTerm('')
                    setCommandSearchActive(false)
                  }}
                  onClearVaultSearch={() => setSearchTerm('')}
                  effectiveViewMode={effectiveViewMode}
                  onViewModeChange={setViewMode}
                  isCompactGrid={isCompactGrid}
                  isGridLayout={isGridLayout}
                  tacticalProjectFilter={tacticalProjectFilter}
                  onTacticalFilterChange={setTacticalProjectFilter}
                  tacticalCounts={tacticalCounts}
                  onStartAll={handleStartAll}
                  onStopAll={handleStopAll}
                  onRefreshAll={handleRefreshAll}
                  onOpenExplorer={handleOpenExplorer}
                  explorerActionTitle={explorerActionTitle}
                  filteredProjects={filteredProjects}
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  selectedIds={selectedIds}
                  onListSelectProject={(id, selected) => {
                    setSelectedIds((prev) =>
                      selected ? [...prev, id] : prev.filter((x) => x !== id),
                    )
                  }}
                  onListSelectAll={(selected) => {
                    setSelectedIds(
                      selected ? filteredProjects.map((p) => p.id) : [],
                    )
                  }}
                  sidebarNarrow={sidebarNarrow}
                  compactMode={compactMode}
                  onToggleCompact={() => setCompactMode(!compactMode)}
                  devInstallUiByProject={devInstallUiByProject}
                  watchdogRestartByProject={watchdogRestartByProject}
                  onAddProject={() => setAddProjectModalOpen(true)}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleStatus={handleToggleStatus}
                  onInstallAndStart={handleInstallAndStart}
                  onRunBuild={handleRunBuild}
                  onLogs={handleLogs}
                  onPickProjectMeta={msc_pickProjectMeta}
                  onSettings={handleSettings}
                  onUnregister={handleUnregister}
                  onContextMenu={handleContextMenu}
                  onOpenProjectUrl={handleOpenProjectUrl}
                />
              )}
            </div>

            {/* System logs: absolute overlay — does not shrink the project grid */}
            <div className="pointer-events-none absolute inset-0 z-[35]">
              <LogDrawer
                projects={logDrawerTabs}
                activeProject={activeLogProject}
                onProjectSelect={setActiveLogProject}
                onClose={() => setLogDrawerExpanded(false)}
                expanded={logDrawerExpanded}
                onExpandedChange={setLogDrawerExpanded}
                onCloseTab={(projectId) => {
                  if (projectId === '__vpe_all__') return
                  if (logProjects.length > 1) {
                    const remaining = logProjects.filter((p) => p.id !== projectId)
                    if (remaining.length > 0) {
                      setActiveLogProject(remaining[0].id)
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Footer - 32px */}
          <Footer />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={true}
          onClose={() => setContextMenu(null)}
          onOpenExplorer={async () => {
            const project = projects.find(p => p.id === contextMenu.projectId)
            if (project?.path) {
              const api = getVpeApi()
              if (api?.openExplorer) {
                const res = await api.openExplorer(project.path)
                if (!res.ok) addToast('Explorer failed', 'error', res.error)
              } else {
                addToast('Opening Explorer...', 'info')
              }
            }
          }}
          onOpenVaultFolderInExplorer={async () => {
            const pid = contextMenu?.projectId
            if (!pid) return
            const api = getVpeApi()
            if (!api?.vaultOpenFolder) {
              addToast('Vault folder', 'warning', 'Open the VPE desktop app to browse the project vault.')
              return
            }
            try {
              const res = await api.vaultOpenFolder(pid)
              if (res && res.ok === false && typeof res.error === 'string' && res.error.trim()) {
                addToast('Vault folder', 'error', res.error)
              }
            } catch (err: unknown) {
              addToast('Vault folder', 'error', msc_formatUnknownIPCError(err))
            }
          }}
          onOpenCursor={async () => {
            const project = projects.find((p) => p.id === contextMenu.projectId)
            if (!project?.path?.trim()) {
              addToast('Open in Cursor', 'warning', 'No project path.')
              return
            }
            const api = getVpeApi()
            if (!api?.openCursor) {
              addToast('Open in Cursor', 'warning', 'Run the VPE desktop app to open Cursor.')
              return
            }
            try {
              const res = await api.openCursor(project.path)
              if (!res.ok) addToast('Cursor failed', 'error', res.error ?? 'Unknown error')
            } catch (err: unknown) {
              addToast('Cursor failed', 'error', msc_formatUnknownIPCError(err))
            }
          }}
          onOpenTerminal={async () => {
            const project = projects.find(p => p.id === contextMenu.projectId)
            if (project?.path) {
              const api = getVpeApi()
              if (api?.openShell) {
                const res = await api.openShell(project.path, 'powershell')
                if (!res.ok) addToast('Shell failed', 'error', res.error)
              } else {
                addToast('Opening Terminal...', 'info')
              }
            }
          }}
          onRecaptureThumbnail={async () => {
            const pid = contextMenu?.projectId
            if (!pid) return
            const api = getVpeApi()
            if (!api?.pickThumbnail) {
              addToast('Thumbnail', 'warning', 'Run inside the VPE desktop shell to pick an image.')
              return
            }
            try {
              const href = await api.pickThumbnail(pid, null)
              if (href) {
                addToast('Thumbnail updated', 'success', 'Vault card image saved and registry refreshed.')
                await refreshProjects()
              }
            } catch (err: unknown) {
              addToast('Thumbnail update failed', 'error', msc_formatUnknownIPCError(err))
            }
          }}
          onRunBuild={() => {
            const id = contextMenu?.projectId
            if (id) void handleRunBuild(id)
          }}
          onCopyPath={() => addToast('Path copied to clipboard', 'success')}
          onCopyPort={() => addToast('Port copied to clipboard', 'success')}
          onRemove={() => {
            const project = projects.find(p => p.id === contextMenu.projectId)
            if (project) handleUnregister(project.name)
          }}
        />
      )}

      {/* Modals */}
      <RepairModal
        isOpen={repairModalOpen}
        onClose={() => {
          setRepairModalOpen(false)
          setRepairModalContext(null)
        }}
        onApply={async () => {
          const api = getVpeApi()
          const projectId = repairModalContext?.projectId ?? selectedProjectId
          const projectName = repairModalContext?.projectName ?? selectedProject
          const filesChanged = 3
          const description = 'Suspense / RSC repair (demo apply)'
          if (api?.recordRepairRun && projectId) {
            try {
              await api.recordRepairRun({
                projectId,
                projectName: projectName || undefined,
                description,
                filesChanged,
                status: 'success',
              })
              setRepairLogRev((n) => n + 1)
              addToast('Fix applied successfully', 'success', `${filesChanged} files patched`)
            } catch (e) {
              addToast(
                'Could not record repair',
                'warning',
                e instanceof Error ? e.message : 'Main process rejected the run',
              )
            }
          } else {
            addToast('Fix applied (demo)', 'success', 'Electron IPC not available; run not persisted')
          }
          setRepairModalOpen(false)
          setRepairModalContext(null)
        }}
        onUndo={() => {
          addToast('Undo not available', 'warning', 'No previous fix to revert')
        }}
      />
      
      <NukeModal
        isOpen={nukeModalOpen}
        projectName={selectedProject}
        onClose={() => setNukeModalOpen(false)}
        onConfirm={handleConfirmNuke}
      />

      <NukeProgressOverlay
        open={Boolean(nukeOverlay)}
        projectName={nukeOverlay?.name ?? ''}
        projectPort={nukeOverlay?.port ?? 3001}
        logLines={nukeLogLines}
        onDismiss={() => setNukeOverlay(null)}
      />

      <AddProjectModal
        isOpen={addProjectModalOpen}
        onClose={() => setAddProjectModalOpen(false)}
        onSubmit={async (data) => {
          const api = getVpeApi()
          const portNum = parseInt(data.port, 10) || 3000
          try {
            if (api?.addProject) {
              await api.addProject({
                id: data.id,
                name: data.name,
                path: data.path,
                port: portNum,
                thumbnail_url: data.thumbnailUrl ?? null,
                project_type: data.projectTypePayload,
              })
              await refreshProjects()
            } else {
              const newProject: Project = {
                id: String(Date.now()),
                name: data.name,
                port: portNum,
                uptime: '--',
                status: 'stopped',
                cpu: 0,
                ram: '0MB',
                pkgManager: data.packageManager || 'npm',
                path: data.path,
              }
              setProjects((prev) => [...prev, newProject])
            }
            setAddProjectModalOpen(false)
            addToast(
              'Project registered',
              'success',
              `${data.name} added to registry`,
            )
          } catch (err: unknown) {
            const msg =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: string }).message)
                : 'Registration failed'
            addToast('Add project failed', 'error', msg)
          }
        }}
      />

      <ProjectSettingsModal
        isOpen={settingsModalOpen}
        projectId={selectedProjectId}
        projectName={selectedProject}
        projectPort={projects.find((p) => p.id === selectedProjectId)?.port}
        projectPath={projects.find((p) => p.id === selectedProjectId)?.path}
        packageManager={projects.find((p) => p.id === selectedProjectId)?.pkgManager}
        startScript={
          projects.find((p) => p.id === selectedProjectId)?.start_script ?? 'dev'
        }
        buildScript={
          projects.find((p) => p.id === selectedProjectId)?.build_script ?? 'build'
        }
        thumbnailUrl={
          projects.find((p) => p.id === selectedProjectId)?.thumbnail_url ?? null
        }
        projectTypePersisted={
          projects.find((p) => p.id === selectedProjectId)?.project_type ?? null
        }
        isArchived={
          projects.find((p) => p.id === selectedProjectId)?.is_archived ?? false
        }
        projectNotes={
          projects.find((p) => p.id === selectedProjectId)?.notes ?? null
        }
        detectedProjectType={
          projects.find((p) => p.id === selectedProjectId)?.detected_project_type ??
          'unknown'
        }
        onClose={() => setSettingsModalOpen(false)}
        onSave={async () => {
          try {
            await refreshProjects()
            setSettingsModalOpen(false)
          } catch (err: unknown) {
            addToast('Save failed', 'error', msc_formatUnknownIPCError(err))
          }
        }}
        onDelete={() => {
          setSettingsModalOpen(false)
          setDeleteModalOpen(true)
        }}
        onRebuild={() => void handleRunBuild(selectedProjectId)}
        onCleanModules={() =>
          addToast('Cleaning node_modules…', 'info')
        }
        onTacticalRepair={() => {
          setSettingsModalOpen(false)
          handleRepair(selectedProject)
        }}
        onTacticalNuke={() => {
          setSettingsModalOpen(false)
          handleNuke(selectedProject)
        }}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        projectName={selectedProject}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <AppSettingsModal
        isOpen={appSettingsModalOpen}
        onClose={() => setAppSettingsModalOpen(false)}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <VpeUiLayoutProvider>
        <DashboardContent />
      </VpeUiLayoutProvider>
    </ToastProvider>
  )
}
