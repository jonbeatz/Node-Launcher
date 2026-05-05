'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, List, FolderPlus } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar';
import { TopBar } from '@/components/top-bar';
import { Footer } from '@/components/footer';
import { Msc_ProjectCard } from '@/components/Msc_ProjectCard'
import { ProjectListView } from '@/components/project-list-view'
import { LogDrawer } from '@/components/log-drawer'
import { RepairModal } from '@/components/repair-modal'
import { NukeModal } from '@/components/nuke-modal'
import { AddProjectModal } from '@/components/add-project-modal'
import { ProjectSettingsModal } from '@/components/project-settings-modal'
import { DeleteConfirmModal } from '@/components/delete-confirm-modal'
import { ContextMenu } from '@/components/context-menu'
import { AppSettingsModal } from '@/components/app-settings-modal'
import { SystemHealthPanel } from '@/components/system-health-panel'
import { RepairHistoryView } from '@/components/repair-history-view'
import { QuickActionsBar } from '@/components/quick-actions-bar'
import { ToastProvider, useToast } from '@/components/vader-toast'
import { getVpeApi, msc_rowToDashboardProject } from '@/lib/vpe-bridge'

type FilterType = 'ALL' | 'RUNNING' | 'STOPPED' | 'ERRORS'
type ViewMode = 'grid' | 'list'
type NavItem = 'dashboard' | 'repair-logs' | 'settings'

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
  },
  { 
    id: '4', 
    name: 'MSC_CONTENT_API', 
    port: 3001, 
    uptime: '--', 
    status: 'stopped',
    cpu: 0,
    ram: '0MB',
    pkgManager: 'pnpm',
    path: 'C:/Users/Vader/Projects/msc-content-api',
    hasBuilt: false, // No .next folder - shows BUILD button
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
  },
]

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: 'RUNNING', label: 'RUNNING' },
  { id: 'STOPPED', label: 'STOPPED' },
  { id: 'ERRORS', label: 'ERRORS' },
]

function DashboardContent() {
  const { addToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [clientReady, setClientReady] = useState(false)
  const [projectsReady, setProjectsReady] = useState(false)
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('grid') // Card View as default per revision spec
  const [repairModalOpen, setRepairModalOpen] = useState(false)
  const [nukeModalOpen, setNukeModalOpen] = useState(false)
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [appSettingsModalOpen, setAppSettingsModalOpen] = useState(false)
  const [systemHealthOpen, setSystemHealthOpen] = useState(true) // Show System Health Panel with warnings on load
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [activeLogProject, setActiveLogProject] = useState('2')
  const [logDrawerVisible, setLogDrawerVisible] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compactMode, setCompactMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

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

    // Ctrl+F - Focus Search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      // Search is handled in TopBar
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
      setLogDrawerVisible(prev => !prev)
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
      else if (logDrawerVisible) setLogDrawerVisible(false)
      else if (searchTerm) setSearchTerm('')
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
    logDrawerVisible,
    searchTerm,
    addToast,
    refreshProjects,
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const msc_pickProjectMeta = useCallback((projectName: string) => {
    const row = projects.find((p) => p.name === projectName)
    setSelectedProject(projectName)
    setSelectedProjectId(row?.id ?? '')
  }, [projects])

  const handleRepair = (projectName: string) => {
    msc_pickProjectMeta(projectName)
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
    setLogDrawerVisible(true)
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
    try {
      if (api?.nukeProject && selectedProjectId) {
        await api.nukeProject(selectedProjectId)
        await refreshProjects()
      } else {
        setProjects(prev => prev.map(p => p.name === selectedProject ? { ...p, status: 'stopped' as const } : p))
      }
      setNukeModalOpen(false)
      addToast('Nuke completed', 'success', `${selectedProject} environment destroyed`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Nuke failed'
      addToast('Nuke failed', 'error', msg)
    }
  }

  const handleToggleStatus = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return

    const api = getVpeApi()
    if (api?.toggleStatus) {
      try {
        const r = await api.toggleStatus(projectId)
        await refreshProjects()
        const running = r?.status === 'running'
        const projectUrl = `http://localhost:${project.port}`
        addToast(
          running ? 'Server Started' : 'Server Stopped',
          running ? 'success' : 'info',
          `${project.name} ${running ? `running on ${projectUrl}` : 'stopped'}`,
        )
        if (running && api?.openProjectUrl) {
          await api.openProjectUrl(projectUrl)
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Toggle failed'
        addToast('Process control failed', 'error', msg)
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
      newStatus === 'running' ? 'Server Started' : 'Server Stopped',
      newStatus === 'running' ? 'success' : 'info',
      `${project.name} ${newStatus === 'running' ? `running on port ${project.port}` : 'gracefully stopped'}`,
    )
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
  const handleStartAll = () => {
    setProjects(prev => prev.map(p => p.status === 'stopped' ? { ...p, status: 'running' as const } : p))
    addToast('Starting all projects...', 'info')
  }

  const handleStopAll = () => {
    setProjects(prev => prev.map(p => p.status === 'running' ? { ...p, status: 'stopped' as const } : p))
    addToast('Stopping all projects...', 'info')
  }

  const handleRefreshAll = () => {
    addToast('Refreshing statuses...', 'info', 'Syncing with PM2 daemon')
  }

  const handleOpenExplorer = () => {
    addToast('Opening Explorer...', 'info')
  }

  const handleNavigation = (nav: string) => {
    if (nav === 'settings') {
      setAppSettingsModalOpen(true)
    } else {
      setActiveNav(nav as NavItem)
    }
  }

  // Filter and search projects
  const filteredProjects = projects.filter(project => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      if (!project.name.toLowerCase().includes(term) && 
          !project.port.toString().includes(term) &&
          !project.path.toLowerCase().includes(term)) {
        return false
      }
    }
    
    // Status filter
    if (activeFilter === 'ALL') return true
    if (activeFilter === 'RUNNING') return project.status === 'running'
    if (activeFilter === 'STOPPED') return project.status === 'stopped'
    if (activeFilter === 'ERRORS') return project.status === 'error'
    return true
  })

  const projectCount = filteredProjects.length

  // Projects for log drawer (only show projects with logs open)
  const logProjects = projects.filter(p => p.status === 'running' || p.status === 'building' || p.id === activeLogProject)

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
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar - 48px */}
          <TopBar 
            onOpenSettings={() => setAppSettingsModalOpen(true)}
            onOpenDiagnostics={() => setSystemHealthOpen(!systemHealthOpen)}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {/* System Health Panel */}
          <SystemHealthPanel 
            isOpen={systemHealthOpen} 
            onClose={() => setSystemHealthOpen(false)} 
          />

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeNav === 'repair-logs' ? (
                /* Repair History View */
                <RepairHistoryView
                  onViewDiff={(id) => {
                    setRepairModalOpen(true)
                  }}
                  onUndo={(id) => {
                    addToast('Undo successful', 'success', 'Previous state restored from .vader-backup')
                  }}
                />
              ) : (
                <>
                  {/* Filter Pills Bar */}
                  <div className="px-6 py-3 flex items-center justify-between shrink-0">
                    {/* Left: Filter Pills - VPE Green primary */}
                    <div className="flex items-center gap-2">
                      {FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => setActiveFilter(filter.id)}
                          className={`
                            h-7 px-4 rounded font-sans text-[11px] font-medium uppercase tracking-[0.05em] transition-all vader-focus
                            ${activeFilter === filter.id
                              ? 'bg-[#4fde82] text-black'
                              : 'bg-transparent text-[#A0A0A0] border border-[#333333] hover:border-[#4fde82]'
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
                      {searchTerm && <span className="ml-2 text-[#4fde82]">(filtered)</span>}
                    </span>

                    {/* Right: View Toggle - VPE Green */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`
                          w-7 h-7 rounded flex items-center justify-center transition-all
                          ${viewMode === 'grid' 
                            ? 'bg-[#4fde82] text-black' 
                            : 'bg-transparent text-[#A0A0A0] hover:text-white'
                          }
                        `}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`
                          w-7 h-7 rounded flex items-center justify-center transition-all
                          ${viewMode === 'list' 
                            ? 'bg-[#4fde82] text-black' 
                            : 'bg-transparent text-[#A0A0A0] hover:text-white'
                          }
                        `}
                      >
                        <List size={16} />
                      </button>
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
                        {searchTerm ? (
                          <>
                            <p className="font-sans text-[#A0A0A0] mb-1">No projects match &apos;{searchTerm}&apos;</p>
                            <button
                              onClick={() => setSearchTerm('')}
                              className="font-sans text-sm text-[#4fde82] hover:underline"
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
                              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus"
                            >
                              ADD PROJECT
                            </button>
                          </>
                        )}
                      </div>
                    ) : viewMode === 'grid' ? (
                      /* Grid View */
                      <div 
                        className="grid gap-5"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}
                      >
                        {filteredProjects.map((project) => (
                          <Msc_ProjectCard
                            key={project.id}
                            name={project.name}
                            port={project.port}
                            uptime={project.uptime}
                            status={project.status}
                            cpu={project.cpu}
                            ram={project.ram}
                            thumbnailUrl={
                              project.thumbnail_url ?? undefined
                            }
                            hasBuilt={project.hasBuilt}
                            onStart={() => void handleToggleStatus(project.id)}
                            onStop={() => void handleToggleStatus(project.id)}
                            onBuild={() => void handleRunBuild(project.id)}
                            onLogs={() => handleLogs(project.id)}
                            onRepair={() => handleRepair(project.name)}
                            onNuke={() => handleNuke(project.name)}
                            onSettings={() => handleSettings(project.name)}
                            onUnregister={() => handleUnregister(project.name)}
                            onContextMenu={(e) => handleContextMenu(e, project.id)}
                          />
                        ))}
                      </div>
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
                        compact={compactMode}
                        onToggleCompact={() => setCompactMode(!compactMode)}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Log Drawer */}
            <LogDrawer 
              projects={logProjects.map(p => ({ id: p.id, name: p.name, status: p.status }))}
              activeProject={activeLogProject}
              onProjectSelect={setActiveLogProject}
              onClose={() => setLogDrawerVisible(false)}
              isVisible={logDrawerVisible}
              onCloseTab={(projectId) => {
                if (logProjects.length > 1) {
                  // Switch to another project
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
          projectName={projects.find(p => p.id === contextMenu.projectId)?.name}
          projectPath={projects.find(p => p.id === contextMenu.projectId)?.path}
          projectPort={projects.find(p => p.id === contextMenu.projectId)?.port}
          onOpenExplorer={() => addToast('Opening Explorer...', 'info')}
          onOpenVSCode={() => addToast('Opening VS Code...', 'info')}
          onOpenTerminal={() => addToast('Opening Terminal...', 'info')}
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
        onClose={() => setRepairModalOpen(false)}
        onApply={() => {
          setRepairModalOpen(false)
          addToast('Fix applied successfully', 'success', '3 files patched')
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

      <AddProjectModal
        isOpen={addProjectModalOpen}
        onClose={() => setAddProjectModalOpen(false)}
        onSubmit={async (data) => {
          const api = getVpeApi()
          const portNum = parseInt(data.port, 10) || 3000
          try {
            if (api?.addProject) {
              await api.addProject({
                name: data.name,
                path: data.path,
                port: portNum,
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
        onClose={() => setSettingsModalOpen(false)}
        onSave={async (payload) => {
          try {
            await refreshProjects()
            setSettingsModalOpen(false)
            addToast(
              'Settings saved',
              'success',
              'Detection refreshed from package.json',
            )
          } catch (err: unknown) {
            const msg =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: string }).message)
                : 'Save failed'
            addToast('Save failed', 'error', msg)
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
