'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List, FolderPlus } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar';
import { TopBar } from '@/components/top-bar';
import { Footer } from '@/components/footer';
import { Msc_ProjectCard } from '@/components/Msc_ProjectCard'
import { Msc_ProjectFilterNav } from '@/components/Msc_ProjectFilterNav'
import { ProjectListView } from '@/components/project-list-view'
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
import { QuickActionsBar } from '@/components/quick-actions-bar'
import { ToastProvider, useToast } from '@/components/vader-toast'
import {
  getVpeApi,
  msc_formatUnknownIPCError,
  msc_rowToDashboardProject,
} from '@/lib/vpe-bridge'
import {
  msc_applyTacticalProjectFilter,
  msc_computeTacticalCounts,
  type VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'

type FilterType = 'ALL' | 'RUNNING' | 'STOPPED' | 'ERRORS' | 'ARCHIVE'
type ViewMode = 'grid' | 'list'
type NavItem = 'dashboard' | 'maintenance' | 'sandbox' | 'settings'

interface Project {
  id: string
  name: string
  port: number
  uptime: string
  status: 'running' | 'stopped' | 'error' | 'building'
  cpu: number
  ram: string
  pkgManager: 'npm' | 'yarn' | 'pnpm'
  path: string
  group?: string
  hasBuilt?: boolean
  start_script?: string
  build_script?: string
  thumbnail_url?: string | null
  health_http_code?: number | null
  health_checked_at?: string | null
  health_reachable?: boolean | null
  is_favorite?: boolean
  node_modules_missing?: boolean
  project_type?: string | null
  detected_project_type?:
    | 'v0'
    | 'electron'
    | 'web'
    | 'node'
    | 'unknown'
  shield_project_type?:
    | 'v0'
    | 'electron'
    | 'web'
    | 'node'
    | 'unknown'
  is_archived?: boolean
  notes?: string | null
  vault_has_files?: boolean
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
]

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: 'RUNNING', label: 'RUNNING' },
  { id: 'STOPPED', label: 'STOPPED' },
  { id: 'ERRORS', label: 'ERRORS' },
  { id: 'ARCHIVE', label: 'ARCHIVE' },
]

function DashboardContent() {
  const { addToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [clientReady, setClientReady] = useState(false)
  const [projectsReady, setProjectsReady] = useState(false)
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL')
  /** v1.2.5 — tactical shield filter (synced with sidebar + filter nav). */
  const [tacticalProjectFilter, setTacticalProjectFilter] =
    useState<VpeTacticalProjectFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid') // Card View as default per revision spec
  const [repairModalOpen, setRepairModalOpen] = useState(false)
  const [repairLogRev, setRepairLogRev] = useState(0)
  const [repairModalContext, setRepairModalContext] = useState<RepairHistoryRow | null>(null)
  const [maintenanceTab, setMaintenanceTab] = useState<MaintenanceTab>('logs')
  const [nukeModalOpen, setNukeModalOpen] = useState(false)
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [appSettingsModalOpen, setAppSettingsModalOpen] = useState(false)
  const [systemHealthOpen, setSystemHealthOpen] = useState(false)
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
  /** v1.2.3 — main auto `install && dev`; cleared when dev output signals or process stops. */
  const [devInstallUiByProject, setDevInstallUiByProject] = useState<
    Record<string, boolean>
  >({})

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)

  const refreshProjects = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.getProjects) {
      setProjects(FALLBACK_PROJECTS)
      return
    }
    try {
      const rows = await api.getProjects()
      setProjects(rows.map(msc_rowToDashboardProject))
    } catch {
      addToast('Failed to load registry', 'error', 'Check SQLite engine in main process')
    }
  }, [addToast])

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    if (!clientReady) return
    void (async () => {
      await refreshProjects()
      setProjectsReady(true)
    })()
  }, [clientReady, refreshProjects])

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

    // Ctrl+1 - Grid View
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault()
      setViewMode('grid')
    }

    // Ctrl+2 - List View
    if (e.ctrlKey && e.key === '2') {
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
        await api.stopAllProjects()
        await refreshProjects()
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
    if (api?.openExplorer) {
      const res = await api.openExplorer('D:/Cursor_Projectz/Node-Launcher')
      if (!res.ok) {
        addToast('Explorer failed', 'error', res.error)
      }
    } else {
      addToast('Opening Explorer...', 'info')
    }
  }

  const handleNavigation = (nav: string) => {
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
      setActiveLogProject(id)
      setLogDrawerExpanded(true)
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

  /** Status / tactical / narrow search — or Ctrl+K jump (ignores filters). */
  const filteredProjects = useMemo(() => {
    const cmd = commandSearchTerm.trim().toLowerCase()
    if (commandSearchActive && cmd) {
      return projects.filter((project) => {
        const name = project.name.toLowerCase()
        const path = project.path.toLowerCase()
        return (
          name.includes(cmd) ||
          path.includes(cmd) ||
          project.port.toString().includes(cmd)
        )
      })
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
      const term = searchTerm.toLowerCase()
      list = list.filter((project) => {
        return (
          project.name.toLowerCase().includes(term) ||
          project.port.toString().includes(term) ||
          project.path.toLowerCase().includes(term)
        )
      })
    }

    return msc_applyTacticalProjectFilter(list, tacticalProjectFilter)
  }, [
    projects,
    searchTerm,
    activeFilter,
    tacticalProjectFilter,
    commandSearchActive,
    commandSearchTerm,
  ])

  const projectCount = filteredProjects.length

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
        <div className="font-sans text-sm text-[#A0A0A0] uppercase tracking-[0.08em]">
          Initializing Vader Project Engine...
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
        <AppSidebar 
          activeItem={activeNav} 
          onNavigate={handleNavigation}
          onAddProject={() => setAddProjectModalOpen(true)}
          onStopAll={handleStopAll}
          favorites={favorites}
          tacticalActive={tacticalProjectFilter}
          tacticalCounts={tacticalCounts}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar - 48px */}
          <TopBar
            onOpenSettings={() => setAppSettingsModalOpen(true)}
            onOpenDiagnostics={() => setSystemHealthOpen(!systemHealthOpen)}
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

          {/* Content Area */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                <>
                  <div className="shrink-0">
                    {/* Filter Pills Bar */}
                    <div className="px-6 py-3 flex items-center justify-between">
                      {/* Left: status filter pills — neutral active (matches sidebar / tactical tabs). */}
                      <div className="flex items-center gap-2">
                        {FILTERS.map((filter) => (
                          <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`
                              h-7 px-4 rounded font-sans text-[11px] font-medium uppercase tracking-[0.05em] transition-all vader-focus
                              ${activeFilter === filter.id
                                ? 'bg-[#2a2a2a] text-white'
                                : 'bg-transparent text-[#A0A0A0] border border-[#333333] hover:text-white hover:border-[#444444]'
                              }
                            `}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>

                      {/* Center: Project Count */}
                      <span className="font-sans text-[11px] text-[#A0A0A0] uppercase tracking-[0.05em]">
                        {projectCount} PROJECT{projectCount !== 1 ? 'S' : ''}
                        {commandSearchActive && commandSearchTerm.trim() ? (
                          <span className="ml-2 text-[#d4d4d4]">(jump)</span>
                        ) : null}
                        {searchTerm.trim() &&
                        !(commandSearchActive && commandSearchTerm.trim()) ? (
                          <span className="ml-2 text-[#d4d4d4]">(filtered)</span>
                        ) : null}
                      </span>

                      {/* Right: grid / list toggle */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`
                            w-7 h-7 rounded flex items-center justify-center transition-all border border-transparent vader-focus
                            ${viewMode === 'grid' 
                              ? 'bg-[#2a2a2a] text-white border-[#444444]' 
                              : 'bg-transparent text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a]/50'
                            }
                          `}
                        >
                          <LayoutGrid size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`
                            w-7 h-7 rounded flex items-center justify-center transition-all border border-transparent vader-focus
                            ${viewMode === 'list' 
                              ? 'bg-[#2a2a2a] text-white border-[#444444]' 
                              : 'bg-transparent text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a]/50'
                            }
                          `}
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="px-6 pb-3 border-b border-[#2a2a2a]">
                      <Msc_ProjectFilterNav
                        activeFilter={tacticalProjectFilter}
                        onFilterChange={setTacticalProjectFilter}
                        counts={tacticalCounts}
                      />
                    </div>
                  </div>

                  {/* Quick Actions Bar */}
                  <QuickActionsBar
                    onStartAll={handleStartAll}
                    onStopAll={handleStopAll}
                    onRefreshAll={handleRefreshAll}
                    onOpenExplorer={handleOpenExplorer}
                  />

                  {/* Project Content */}
                  <div className="flex-1 px-6 pb-6 overflow-y-auto">
                    {filteredProjects.length === 0 ? (
                      /* Empty State */
                      <div className="h-full flex flex-col items-center justify-center">
                        <FolderPlus size={48} className="text-[#333333] mb-4" />
                        {commandSearchActive && commandSearchTerm.trim() ? (
                          <>
                            <p className="font-sans text-[#A0A0A0] mb-1">
                              No projects match &apos;{commandSearchTerm.trim()}&apos;
                            </p>
                            <button
                              onClick={() => {
                                setCommandSearchTerm('')
                                setCommandSearchActive(false)
                              }}
                              className="font-sans text-sm text-[#eaeaea] hover:underline"
                              type="button"
                            >
                              Clear jump search
                            </button>
                          </>
                        ) : searchTerm.trim() ? (
                          <>
                            <p className="font-sans text-[#A0A0A0] mb-1">
                              No projects match &apos;{searchTerm}&apos;
                            </p>
                            <button
                              onClick={() => setSearchTerm('')}
                              className="font-sans text-sm text-[#eaeaea] hover:underline"
                              type="button"
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="font-sans text-[#A0A0A0] mb-1">No projects registered</p>
                            <p className="font-sans text-sm text-[#555555] mb-4">Add your first project to get started</p>
                            <button
                              onClick={() => setAddProjectModalOpen(true)}
                              className="h-9 px-6 rounded bg-[#2a2a2a] hover:bg-[#333333] border border-[#555555] font-sans text-sm font-medium text-white transition-colors vader-focus"
                            >
                              ADD PROJECT
                            </button>
                          </>
                        )}
                      </div>
                    ) : viewMode === 'grid' ? (
                      /* Grid View */
                      <motion.div
                        key={tacticalProjectFilter}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.22 }}
                        className="grid gap-5"
                        style={{
                          gridTemplateColumns:
                            'repeat(auto-fill, minmax(380px, 1fr))',
                        }}
                      >
                        <AnimatePresence mode="popLayout">
                          {filteredProjects.map((project) => (
                            <motion.div
                              key={project.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18 }}
                            >
                          <Msc_ProjectCard
                            id={project.id}
                            name={project.name}
                            port={project.port}
                            uptime={project.uptime}
                            status={project.status}
                            health_http_code={project.health_http_code}
                            health_checked_at={project.health_checked_at}
                            health_reachable={project.health_reachable}
                            isFavorite={project.is_favorite}
                            node_modules_missing={project.node_modules_missing}
                            onToggleFavorite={() => handleToggleFavorite(project.id)}
                            thumbnailUrl={
                              project.thumbnail_url ?? undefined
                            }
                            hasBuilt={project.hasBuilt}
                            onStart={() => void handleToggleStatus(project.id)}
                            onStop={() => void handleToggleStatus(project.id)}
                            onInstallAndStart={() => void handleInstallAndStart(project.id)}
                            onBuild={() => void handleRunBuild(project.id)}
                            onLogs={() => handleLogs(project.id)}
                            onViewErrorConsole={() => handleLogs(project.id)}
                            onRepair={() => handleRepair(project.name)}
                            onNuke={() => handleNuke(project.name)}
                            onSettings={() => handleSettings(project.name)}
                            onUnregister={() => handleUnregister(project.name)}
                            onContextMenu={(e) => handleContextMenu(e, project.id)}
                            onOpenInBrowser={() =>
                              void handleOpenProjectUrl(project.id)
                            }
                            devInstallInProgress={Boolean(
                              devInstallUiByProject[project.id],
                            )}
                            shieldProjectType={
                              project.shield_project_type ?? 'unknown'
                            }
                            hasDocumentationReferences={
                              (project.notes?.trim().length ?? 0) > 0 ||
                              Boolean(project.vault_has_files)
                            }
                          />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      /* List View */
                      <ProjectListView
                        projects={filteredProjects}
                        selectedIds={selectedIds}
                        onSelectProject={(id, selected) => {
                          setSelectedIds(prev => selected ? [...prev, id] : prev.filter(x => x !== id))
                        }}
                        onSelectAll={(selected) => {
                          setSelectedIds(selected ? filteredProjects.map(p => p.id) : [])
                        }}
                        onToggleStatus={handleToggleStatus}
                        onBuild={(id) => void handleRunBuild(id)}
                        onLogs={handleLogs}
                        onRepair={(id) => {
                          const project = projects.find(p => p.id === id)
                          if (project) handleRepair(project.name)
                        }}
                        onNuke={(id) => {
                          const project = projects.find(p => p.id === id)
                          if (project) handleNuke(project.name)
                        }}
                        onSettings={(id) => {
                          const project = projects.find(p => p.id === id)
                          if (project) handleSettings(project.name)
                        }}
                        onUnregister={(id) => {
                          const project = projects.find(p => p.id === id)
                          if (project) handleUnregister(project.name)
                        }}
                        onOpenInBrowser={(id) => void handleOpenProjectUrl(id)}
                        compact={compactMode}
                        onToggleCompact={() => setCompactMode(!compactMode)}
                        devInstallByProjectId={devInstallUiByProject}
                        tacticalMotionKey={tacticalProjectFilter}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Log Drawer */}
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
                  const remaining = logProjects.filter(p => p.id !== projectId)
                  if (remaining.length > 0) {
                    setActiveLogProject(remaining[0].id)
                  }
                }
              }}
            />
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
          onOpenVSCode={() => addToast('Opening VS Code...', 'info')}
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
          onRecaptureThumbnail={() => addToast('Recapturing thumbnail...', 'info')}
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
            addToast(
              'Settings saved',
              'success',
              'Detection refreshed from package.json',
            )
    } catch {
      addToast('Save failed', 'error', 'Save failed')
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
        onSave={() => addToast('Settings saved', 'success')}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  )
}
