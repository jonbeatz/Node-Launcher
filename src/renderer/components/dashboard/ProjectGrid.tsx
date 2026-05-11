'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List, FolderPlus, Grid2x2 } from 'lucide-react'
import { Msc_ProjectCard } from '@/components/Msc_ProjectCard'
import { Msc_ProjectFilterNav } from '@/components/Msc_ProjectFilterNav'
import { ProjectListView } from '@/components/project-list-view'
import { QuickActionsBar } from '@/components/quick-actions-bar'
import { msc_rowHasDocumentationEnabled } from '@/lib/vpe-bridge'
import type { Project } from '@/types/vpe-ipc'
import type {
  VpeTacticalCounts,
  VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'
import type { DashboardActiveFilter } from '@/state/useSettings'

const FILTERS: { id: DashboardActiveFilter; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: 'RUNNING', label: 'RUNNING' },
  { id: 'STOPPED', label: 'STOPPED' },
  { id: 'ERRORS', label: 'ERRORS' },
  { id: 'ARCHIVE', label: 'ARCHIVE' },
]

export type ProjectGridProps = {
  favoriteFilterActive: boolean
  onClearFavoriteFilter: () => void
  activeFilter: DashboardActiveFilter
  onActiveFilterChange: (id: DashboardActiveFilter) => void
  commandSearchActive: boolean
  commandSearchTerm: string
  searchTerm: string
  onClearJumpSearch: () => void
  onClearVaultSearch: () => void
  effectiveViewMode: 'cinema' | 'compact' | 'list'
  onViewModeChange: (mode: 'cinema' | 'compact' | 'list') => void
  isCompactGrid: boolean
  isGridLayout: boolean
  tacticalProjectFilter: VpeTacticalProjectFilter
  onTacticalFilterChange: (f: VpeTacticalProjectFilter) => void
  tacticalCounts: VpeTacticalCounts
  onStartAll: () => void
  onStopAll: () => void
  onRefreshAll: () => void
  onOpenExplorer: () => void
  explorerActionTitle: string
  filteredProjects: Project[]
  projects: Project[]
  selectedProjectId: string
  selectedIds: string[]
  onListSelectProject: (id: string, selected: boolean) => void
  onListSelectAll: (selected: boolean) => void
  sidebarNarrow: boolean
  compactMode: boolean
  onToggleCompact: () => void
  devInstallUiByProject: Record<string, boolean>
  watchdogRestartByProject: Record<string, boolean>
  onAddProject: () => void
  onToggleFavorite: (projectId: string) => void
  onToggleStatus: (projectId: string) => void
  onInstallAndStart: (projectId: string) => void
  onRunBuild: (projectId: string) => void
  onLogs: (projectId: string) => void
  onPickProjectMeta: (projectName: string) => void
  onSettings: (projectName: string) => void
  onUnregister: (projectName: string) => void
  onContextMenu: (e: React.MouseEvent, projectId: string) => void
  onOpenProjectUrl: (projectId: string) => void
}

/** v2.0.0 — dashboard project display: filters, view mode, tactical nav, quick actions, grid/list. */
export function ProjectGrid({
  favoriteFilterActive,
  onClearFavoriteFilter,
  activeFilter,
  onActiveFilterChange,
  commandSearchActive,
  commandSearchTerm,
  searchTerm,
  onClearJumpSearch,
  onClearVaultSearch,
  effectiveViewMode,
  onViewModeChange,
  isCompactGrid,
  isGridLayout,
  tacticalProjectFilter,
  onTacticalFilterChange,
  tacticalCounts,
  onStartAll,
  onStopAll,
  onRefreshAll,
  onOpenExplorer,
  explorerActionTitle,
  filteredProjects,
  projects,
  selectedProjectId,
  selectedIds,
  onListSelectProject,
  onListSelectAll,
  sidebarNarrow,
  compactMode,
  onToggleCompact,
  devInstallUiByProject,
  watchdogRestartByProject,
  onAddProject,
  onToggleFavorite,
  onToggleStatus,
  onInstallAndStart,
  onRunBuild,
  onLogs,
  onPickProjectMeta,
  onSettings,
  onUnregister,
  onContextMenu,
  onOpenProjectUrl,
}: ProjectGridProps) {
  return (
    <div
      data-testid="vpe-project-grid"
      className="flex flex-col min-h-0 flex-1 w-full"
    >
      <div className="shrink-0">
        {/* Filter Pills Bar */}
        {/* pl-6 + pr-14: same left gutter as grid; right = px-6 + w-8 log rail (overlay no longer shrinks layout). */}
        <div className="flex items-center justify-between gap-4 py-3 pl-6 pr-14">
          {/* Left: status filter pills — catalog total lives on TopBar breadcrumb only (v1.3.5). */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {favoriteFilterActive ? (
              <>
                <span className="inline-flex h-7 items-center rounded border border-[#ffcc00]/35 bg-[#1a1508] px-3 font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-[#facc15]">
                  Viewing Favorites
                </span>
                <button
                  type="button"
                  onClick={onClearFavoriteFilter}
                  className="h-7 rounded border border-[#444444] bg-[#1c1c1c] px-3 font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-[#eaeaea] transition-colors hover:border-[#555555] hover:bg-[#252525] vader-focus"
                >
                  Show All
                </button>
              </>
            ) : null}
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => onActiveFilterChange(filter.id)}
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
            {commandSearchActive && commandSearchTerm.trim() ? (
              <span className="font-sans text-[10px] text-[#888888] uppercase tracking-wide">
                Jump mode
              </span>
            ) : null}
            {searchTerm.trim() &&
            !(commandSearchActive && commandSearchTerm.trim()) ? (
              <span className="font-sans text-[10px] text-[#888888] uppercase tracking-wide">
                Vault search
              </span>
            ) : null}
          </div>

          {/* Right: unified view mode (v1.6.9) */}
          <div
            className="flex flex-wrap items-center justify-end gap-1 shrink-0"
            role="group"
            aria-label="Dashboard view mode"
          >
            {(
              [
                { mode: 'cinema' as const, label: 'CINEMA', Icon: LayoutGrid },
                { mode: 'compact' as const, label: 'COMPACT', Icon: Grid2x2 },
                { mode: 'list' as const, label: 'LIST', Icon: List },
              ] as const
            ).map(({ mode, label, Icon }) => {
              const active = effectiveViewMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`
                                flex h-7 items-center gap-1.5 rounded border border-transparent px-2.5 font-sans text-[10px] font-medium uppercase tracking-wide transition-all duration-200 vader-focus
                                ${active
                                  ? 'bg-[#2a2a2a] text-white border-[#444444]'
                                  : 'bg-transparent text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a]/50'
                                }
                              `}
                  title={`${label} view`}
                >
                  <Icon size={14} className="shrink-0 opacity-90" />
                  <span className="hidden min-[420px]:inline">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-b border-[#2a2a2a] pb-3 pl-6 pr-14">
          <Msc_ProjectFilterNav
            activeFilter={tacticalProjectFilter}
            onFilterChange={onTacticalFilterChange}
            counts={tacticalCounts}
          />
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActionsBar
        onStartAll={onStartAll}
        onStopAll={onStopAll}
        onRefreshAll={onRefreshAll}
        onOpenExplorer={onOpenExplorer}
        explorerActionTitle={explorerActionTitle}
      />

      {/* Project Content */}
      <div className="flex-1 overflow-y-auto pb-6 pl-6 pr-14">
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
                  onClick={onClearJumpSearch}
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
                  onClick={onClearVaultSearch}
                  className="font-sans text-sm text-[#eaeaea] hover:underline"
                  type="button"
                >
                  Clear vault search
                </button>
              </>
            ) : (
              <>
                <p className="font-sans text-[#A0A0A0] mb-1">No projects registered</p>
                <p className="font-sans text-sm text-[#555555] mb-4">Add your first project to get started</p>
                <button
                  onClick={onAddProject}
                  className="h-9 px-6 rounded bg-[#2a2a2a] hover:bg-[#333333] border border-[#555555] font-sans text-sm font-medium text-white transition-colors vader-focus"
                >
                  ADD PROJECT
                </button>
              </>
            )}
          </div>
        ) : isGridLayout ? (
          /* Cinema / compact grid */
          <motion.div
            key={`${tacticalProjectFilter}-${effectiveViewMode}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22 }}
            className={`items-start transition-[gap] duration-200 ease-out ${isCompactGrid ? 'vpe-grid-compact' : 'vpe-grid-cinema'}`}
          >
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <Msc_ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  isCompact={isCompactGrid}
                  projectPath={project.path}
                  project_folder_created_at={
                    project.project_folder_created_at
                  }
                  project_folder_modified_at={
                    project.project_folder_modified_at
                  }
                  port={project.port}
                  status={project.status}
                  devSessionStartedAt={project.dev_session_started_at ?? null}
                  health_http_code={project.health_http_code}
                  health_checked_at={project.health_checked_at}
                  health_reachable={project.health_reachable}
                  isFavorite={project.is_favorite}
                  node_modules_missing={project.node_modules_missing}
                  onToggleFavorite={() => onToggleFavorite(project.id)}
                  thumbnailUrl={
                    project.thumbnail_url ?? undefined
                  }
                  hasBuilt={project.hasBuilt}
                  onStart={() => void onToggleStatus(project.id)}
                  onStop={() => void onToggleStatus(project.id)}
                  onInstallAndStart={() => void onInstallAndStart(project.id)}
                  onBuild={() => void onRunBuild(project.id)}
                  onLogs={() => onLogs(project.id)}
                  onViewErrorConsole={() => onLogs(project.id)}
                  onCardInteraction={() => onPickProjectMeta(project.name)}
                  onSettings={() => onSettings(project.name)}
                  onUnregister={() => onUnregister(project.name)}
                  onContextMenu={(e) => onContextMenu(e, project.id)}
                  onOpenInBrowser={() =>
                    void onOpenProjectUrl(project.id)
                  }
                  devInstallInProgress={Boolean(
                    devInstallUiByProject[project.id],
                  )}
                  watchdogRestartInProgress={Boolean(
                    watchdogRestartByProject[project.id],
                  )}
                  shieldProjectType={
                    project.shield_project_type ?? 'unknown'
                  }
                  vaultHasReferenceFiles={
                    Boolean(project.vault_has_files) &&
                    msc_rowHasDocumentationEnabled(project.has_documentation)
                  }
                  isSelected={selectedProjectId === project.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* List View */
          <ProjectListView
            projects={filteredProjects}
            explorerTargetId={selectedProjectId}
            listVariant={sidebarNarrow ? 'slim' : 'default'}
            selectedIds={selectedIds}
            onSelectProject={onListSelectProject}
            onSelectAll={onListSelectAll}
            onToggleStatus={onToggleStatus}
            onBuild={(id) => void onRunBuild(id)}
            onLogs={onLogs}
            onProjectRowFocus={(_id, name) => {
              onPickProjectMeta(name)
            }}
            onSettings={(id) => {
              const project = projects.find(p => p.id === id)
              if (project) onSettings(project.name)
            }}
            onUnregister={(id) => {
              const project = projects.find(p => p.id === id)
              if (project) onUnregister(project.name)
            }}
            onOpenInBrowser={(id) => void onOpenProjectUrl(id)}
            compact={compactMode}
            onToggleCompact={onToggleCompact}
            devInstallByProjectId={devInstallUiByProject}
            watchdogRestartByProjectId={watchdogRestartByProject}
            tacticalMotionKey={tacticalProjectFilter}
          />
        )}
      </div>
    </div>
  )
}
