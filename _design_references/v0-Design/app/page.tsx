'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, List, FolderPlus } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { TopBar } from '@/components/top-bar'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
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
}

const INITIAL_PROJECTS: Project[] = [
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
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
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
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null)

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
      addToast('Refreshing statuses...', 'info', 'Syncing with PM2 daemon')
    }
  }, [repairModalOpen, nukeModalOpen, addProjectModalOpen, settingsModalOpen, deleteModalOpen, appSettingsModalOpen, systemHealthOpen, logDrawerVisible, searchTerm, addToast])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleRepair = (projectName: string) => {
    setSelectedProject(projectName)
    setRepairModalOpen(true)
  }

  const handleNuke = (projectName: string) => {
    setSelectedProject(projectName)
    setNukeModalOpen(true)
  }

  const handleSettings = (projectName: string) => {
    setSelectedProject(projectName)
    setSettingsModalOpen(true)
  }

  const handleUnregister = (projectName: string) => {
    setSelectedProject(projectName)
    setDeleteModalOpen(true)
  }

  const handleLogs = (projectId: string) => {
    setActiveLogProject(projectId)
    setLogDrawerVisible(true)
  }

  const handleConfirmDelete = () => {
    setProjects(prev => prev.filter(p => p.name !== selectedProject))
    setDeleteModalOpen(false)
    addToast('Project removed from registry', 'success', 'Files preserved on disk')
  }

  const handleConfirmNuke = () => {
    setProjects(prev => prev.map(p => p.name === selectedProject ? { ...p, status: 'stopped' as const } : p))
    setNukeModalOpen(false)
    addToast('Nuke completed', 'success', `${selectedProject} environment destroyed`)
  }

  const handleToggleStatus = (projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const newStatus = p.status === 'running' ? 'stopped' : 'running'
        addToast(
          newStatus === 'running' ? 'Server Started' : 'Server Stopped',
          newStatus === 'running' ? 'success' : 'info',
          `${p.name} ${newStatus === 'running' ? `running on port ${p.port}` : 'gracefully stopped'}`
        )
        return { ...p, status: newStatus as 'running' | 'stopped' }
      }
      return p
    }))
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
                          <ProjectCard
                            key={project.id}
                            name={project.name}
                            port={project.port}
                            uptime={project.uptime}
                            status={project.status}
                            cpu={project.cpu}
                            ram={project.ram}
                            onStart={() => handleToggleStatus(project.id)}
                            onStop={() => handleToggleStatus(project.id)}
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
                        onBuild={(id) => {
                          const project = projects.find(p => p.id === id)
                          if (project) {
                            addToast('Build started', 'info', `Building ${project.name}...`)
                            // Simulate build by setting hasBuilt to true after "building"
                            setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'building' as const } : p))
                            setTimeout(() => {
                              setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'stopped' as const, hasBuilt: true } : p))
                              addToast('Build completed', 'success', `${project.name} ready to start`)
                            }, 2000)
                          }
                        }}
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
          onRunBuild={() => addToast('Build started', 'info')}
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
        onSubmit={(data) => {
          const newProject: Project = {
            id: String(Date.now()),
            name: data.name,
            port: parseInt(data.port),
            uptime: '--',
            status: 'stopped',
            cpu: 0,
            ram: '0MB',
            pkgManager: data.packageManager || 'npm',
            path: data.path,
          }
          setProjects(prev => [...prev, newProject])
          setAddProjectModalOpen(false)
          addToast('Project registered', 'success', `${data.name} added to registry`)
        }}
      />

      <ProjectSettingsModal
        isOpen={settingsModalOpen}
        projectName={selectedProject}
        onClose={() => setSettingsModalOpen(false)}
        onSave={() => {
          setSettingsModalOpen(false)
          addToast('Settings saved', 'success')
        }}
        onDelete={() => {
          setSettingsModalOpen(false)
          setDeleteModalOpen(true)
        }}
        onRebuild={() => addToast('Rebuild started', 'info', 'This may take a few minutes')}
        onCleanModules={() => addToast('Cleaning node_modules...', 'info')}
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
