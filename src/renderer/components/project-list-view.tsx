'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { msc_shieldColorHex } from '@/lib/shield-colors'
import {
  Play,
  Square,
  Terminal,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  Hammer,
  ExternalLink,
  Loader2,
  Paperclip,
  AlertTriangle,
} from 'lucide-react'
import { VpeHealthEqualizerIcon } from '@/components/vpe-health-equalizer-icon'
import { msc_rowHasDocumentationEnabled } from '@/lib/vpe-bridge'
import type { Project } from '@/types/vpe-ipc'

/** JEDI_MOD_06 — list perf tooltip: gap from the right edge of the rendered project name. */
const MSC_LIST_PERF_TEXT_GAP_PX = 25

function msc_listDocPaperclip(project: Project): boolean {
  return (
    project.vault_has_files === true &&
    msc_rowHasDocumentationEnabled(project.has_documentation)
  )
}

function msc_listEqualizerTone(
  project: Project,
  isDevInstalling: boolean,
  isBuilding: boolean,
): string {
  if (isBuilding || isDevInstalling) return 'text-[#fbbf08]'
  const code = project.health_http_code
  if (typeof code === 'number' && code >= 200 && code < 300) return 'text-[#22c55e]'
  const booting =
    !project.health_checked_at && (code === undefined || code === null)
  if (booting && project.health_reachable !== false) return 'text-[#fbbf08]'
  return 'text-[#fbbf08]'
}

function msc_healthCell(project: Project): { text: string; className: string } {
  if (project.status !== 'running') {
    return { text: '—', className: 'text-[#555555]' }
  }
  if (project.vpe_repo_runnable_for_http === false) {
    const code = project.health_http_code
    if (typeof code === 'number' && code >= 200 && code < 300) {
      return { text: `${code}`, className: 'text-[#4fde82]' }
    }
    if (typeof code === 'number' && code >= 500) {
      return { text: `${code}`, className: 'text-[#e02b20]' }
    }
    if (typeof code === 'number') {
      return { text: `${code}`, className: 'text-[#ffcc00]' }
    }
    return { text: 'Idle', className: 'text-[#ffcc00]' }
  }
  if (
    !project.health_checked_at &&
    (project.health_http_code === undefined || project.health_http_code === null)
  ) {
    return { text: 'Boot', className: 'text-[#ffcc00]' }
  }
  if (
    project.health_reachable === false &&
    (project.health_http_code === undefined || project.health_http_code === null)
  ) {
    return { text: 'Off', className: 'text-[#e02b20]' }
  }
  if (
    typeof project.health_http_code === 'number' &&
    project.health_http_code >= 200 &&
    project.health_http_code < 300
  ) {
    return { text: `${project.health_http_code}`, className: 'text-[#4fde82]' }
  }
  if (typeof project.health_http_code === 'number' && project.health_http_code >= 500) {
    return { text: `${project.health_http_code}`, className: 'text-[#e02b20]' }
  }
  if (typeof project.health_http_code === 'number') {
    return { text: `${project.health_http_code}`, className: 'text-[#ffcc00]' }
  }
  return { text: 'fail', className: 'text-[#e02b20]' }
}

interface ProjectListViewProps {
  projects: Project[]
  selectedIds: string[]
  onSelectProject: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onToggleStatus: (id: string) => void
  onBuild?: (id: string) => void
  onLogs: (id: string) => void
  onSettings: (id: string) => void
  onUnregister: (id: string) => void
  /** Opens managed project URL in the system browser when running. */
  onOpenInBrowser?: (id: string) => void
  compact?: boolean
  onToggleCompact?: () => void
  /** Per-project installing state (npm install embedded in dev start). */
  devInstallByProjectId?: Record<string, boolean>
  /** JEDI_MOD_24 — project auto-restarting via watchdog. */
  watchdogRestartByProjectId?: Record<string, boolean>
  /** v1.2.5 — tactical shield filter; animates list on change. */
  tacticalMotionKey?: string
  /** v1.6.8 — narrow window: hide path / HTTP / PKG, tighter rows (sidebar snap). */
  listVariant?: 'default' | 'slim'
  /** v1.8.0 — clicking a row (outside controls) marks Explorer target */
  onProjectRowFocus?: (id: string, name: string) => void
  /** v1.8.1 — matches dashboard “focused” project for quick-actions + stroke */
  explorerTargetId?: string
}

/** `order` = persisted registry `sort_order` (matches grid / IPC reorder). */
type SortField = 'order' | 'name' | 'port' | 'path'
type SortDirection = 'asc' | 'desc'

/**
 * List view — status/search/tactical filters run in `app/page.tsx`; `tacticalMotionKey` triggers
 * Framer Motion opacity when the tactical shield filter changes (v1.2.5).
 */
export function ProjectListView({
  projects,
  selectedIds,
  onSelectProject,
  onSelectAll,
  onToggleStatus,
  onBuild,
  onLogs,
  onSettings,
  onUnregister,
  onOpenInBrowser,
  devInstallByProjectId = {},
  watchdogRestartByProjectId = {},
  tacticalMotionKey = 'all',
  listVariant = 'default',
  onProjectRowFocus,
  explorerTargetId,
}: ProjectListViewProps) {
  const slim = listVariant === 'slim'
  const [sortField, setSortField] = useState<SortField>('order')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  /** List perf bubble: portal + fixed; JEDI_MOD_06 — snap to project name text end (+25px), vertical center of text. */
  const [listPerfTip, setListPerfTip] = useState<{
    projectId: string
    top: number
    left: number
  } | null>(null)
  const projectNameLabelRefs = useRef(new Map<string, HTMLSpanElement>())

  const syncListPerfTip = useCallback((projectId: string | null) => {
    if (!projectId) {
      setListPerfTip(null)
      return
    }
    const label = projectNameLabelRefs.current.get(projectId)
    if (!label) {
      setListPerfTip(null)
      return
    }
    const r = label.getBoundingClientRect()
    setListPerfTip({
      projectId,
      top: r.top + r.height / 2,
      left: r.right + MSC_LIST_PERF_TEXT_GAP_PX,
    })
  }, [])

  useEffect(() => {
    if (!listPerfTip) return
    const onReposition = () => {
      setListPerfTip((prev) => {
        if (!prev) return prev
        const label = projectNameLabelRefs.current.get(prev.projectId)
        if (!label) return null
        const r = label.getBoundingClientRect()
        return {
          projectId: prev.projectId,
          top: r.top + r.height / 2,
          left: r.right + MSC_LIST_PERF_TEXT_GAP_PX,
        }
      })
    }
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [listPerfTip])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortField === 'order') {
      const oa = Number(a.sort_order)
      const ob = Number(b.sort_order)
      const na = Number.isFinite(oa) ? oa : 0
      const nb = Number.isFinite(ob) ? ob : 0
      if (na !== nb) return sortDirection === 'asc' ? na - nb : nb - na
      return sortDirection === 'asc'
        ? String(a.name).localeCompare(String(b.name))
        : String(b.name).localeCompare(String(a.name))
    }
    const key = sortField
    let aVal: string | number = a[key] as string | number
    let bVal: string | number = b[key] as string | number

    if (typeof aVal === 'string') aVal = aVal.toLowerCase()
    if (typeof bVal === 'string') bVal = bVal.toLowerCase()

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp size={12} className="text-[#4fde82]" />
    ) : (
      <ChevronDown size={12} className="text-[#4fde82]" />
    )
  }

  const allSelected = projects.length > 0 && selectedIds.length === projects.length

  return (
    <motion.div
      key={tacticalMotionKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="vpe-theme-font w-full bg-[#1c1c1c] border border-[#333333] rounded overflow-hidden transition-all duration-200 ease-out"
    >
      {/* Bulk Actions Bar - Dark grey with lighter grey buttons */}
      {selectedIds.length > 0 && (
        <div className="bg-[#2a2a2a] h-10 flex items-center justify-between px-4 rounded-t border-b border-[#333333]">
          <span className="text-xs text-white font-medium uppercase tracking-wider">
            {selectedIds.length} PROJECT{selectedIds.length > 1 ? 'S' : ''} SELECTED
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded border border-[#555555] text-white text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              STOP SELECTED
            </button>
            <button className="px-3 py-1 rounded border border-[#555555] text-white text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              START SELECTED
            </button>
            <button className="px-3 py-1 rounded border border-[#555555] text-white text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              REMOVE SELECTED
            </button>
            <button 
              onClick={() => onSelectAll(false)}
              className="ml-2 text-xs text-[#A0A0A0] hover:text-white"
            >
              CLEAR SELECTION
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-[#161616] border-b-2 border-[#333333] sticky top-0">
            <tr className={slim ? 'h-8' : 'h-9'}>
              <th className="w-8 px-3">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-[#555555] bg-[#2a2a2a] checked:bg-[#4fde82] checked:border-[#4fde82] accent-[#4fde82]"
                />
              </th>
              <th
                className="w-11 px-1 text-center text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]"
                title="Persisted catalog order (grid drag still reorders)"
              >
                <button
                  type="button"
                  onClick={() => handleSort('order')}
                  className="w-full cursor-pointer hover:text-white vader-focus rounded py-0.5"
                >
                  <span className="flex flex-col items-center gap-0.5 leading-none">
                    <span>Order</span>
                    <SortIcon field="order" />
                  </span>
                </button>
              </th>
              <th className="w-12 px-3 text-center text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Status
              </th>
              <th 
                onClick={() => handleSort('name')}
                className={`${slim ? 'min-w-0' : 'min-w-[280px]'} px-3 text-left text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white`}
              >
                <span className="flex items-center gap-1">Project Name <SortIcon field="name" /></span>
              </th>
              <th 
                onClick={() => handleSort('port')}
                className="w-16 px-2 text-left text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">Port <SortIcon field="port" /></span>
              </th>
              {!slim && (
                <th className="w-[88px] px-3 text-left text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]" title="GET / health after dev start">
                  HTTP
                </th>
              )}
              {!slim && (
                <th className="w-16 px-3 text-left text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                  PKG
                </th>
              )}
              {!slim && (
                <th 
                  onClick={() => handleSort('path')}
                  className="min-w-[300px] px-3 text-left text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white"
                >
                  <span className="flex items-center gap-1">Path <SortIcon field="path" /></span>
                </th>
              )}
              <th className={`${slim ? 'min-w-[180px]' : 'min-w-[260px]'} px-2 text-center text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]`}>
                Actions
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedProjects.map((project, index) => {
              const isSelected = selectedIds.includes(project.id)
              const isExplorerTarget = explorerTargetId === project.id
              const isRunning = project.status === 'running'
              const isError = project.status === 'error'
              const isStopped = project.status === 'stopped'
              const isBuilding = project.status === 'building'
              const hasBuilt = project.hasBuilt !== false
              const isDevInstalling = Boolean(devInstallByProjectId[project.id] && isRunning)
              const isWatchdogRestarting = Boolean(watchdogRestartByProjectId[project.id])
              const pathMissing = project.project_path_missing === true
              const zebra = index % 2 === 0 ? 'bg-[#121212]' : 'bg-[#1c1c1c]'
              const rowBg = isExplorerTarget ? 'bg-[#2a2a2a]' : zebra
              const httpCell = msc_healthCell(project)
              const statusTitle = isWatchdogRestarting
                ? 'RESTARTING'
                : isDevInstalling
                  ? 'INSTALLING'
                  : pathMissing && !isRunning && !isBuilding
                    ? 'PATH MISSING'
                    : project.status === 'running'
                      ? 'RUNNING'
                      : project.status === 'error'
                        ? 'ERROR'
                        : project.status === 'building'
                          ? 'BUILDING'
                          : 'STOPPED'

              return (
                <tr 
                  key={project.id}
                  onMouseEnter={() => syncListPerfTip(project.id)}
                  onMouseLeave={() => syncListPerfTip(null)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input,button,a,[role="button"]'))
                      return
                    onProjectRowFocus?.(project.id, project.name)
                  }}
                  className={`
                    ${rowBg} transition-colors ${slim ? 'h-9' : 'h-12'}
                    ${isExplorerTarget ? 'hover:bg-[#333333]' : 'hover:bg-[#252525]'}
                    ${
                      isError
                        ? 'border-l-2 border-l-[#e02b20]'
                        : pathMissing
                          ? 'border-l-2 border-l-[#b45309]'
                          : 'border-l-2 border-l-transparent hover:border-l-[#4fde82]'
                    }
                    ${isExplorerTarget && !isError ? 'outline outline-1 outline-slate-500/45 -outline-offset-1' : ''}
                    ${isStopped ? 'opacity-60' : ''}
                  `}
                >
                  <td className="px-3">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => onSelectProject(project.id, e.target.checked)}
                      className="w-4 h-4 rounded border-[#555555] bg-[#2a2a2a] checked:bg-[#4fde82] checked:border-[#4fde82] accent-[#4fde82]"
                    />
                  </td>
                  <td className="w-11 px-1 text-center align-middle tabular-nums text-[11px] text-[#888888]">
                    {typeof project.sort_order === 'number' &&
                    Number.isFinite(Number(project.sort_order))
                      ? Number(project.sort_order)
                      : '—'}
                  </td>
                  <td className="px-3 text-center">
                    {pathMissing && !isRunning && !isBuilding ? (
                      <span
                        className="inline-flex items-center justify-center text-[#f59e0b]"
                        title="Registry workspace path not found"
                      >
                        <AlertTriangle size={14} aria-hidden />
                      </span>
                    ) : isRunning || isWatchdogRestarting ? (
                      <div
                        className={`inline-flex items-center justify-center mx-auto opacity-90 ${
                          isWatchdogRestarting
                            ? 'text-[#ff7700]'
                            : msc_listEqualizerTone(
                                project,
                                isDevInstalling,
                                isBuilding,
                              )
                        }`}
                      >
                        <VpeHealthEqualizerIcon size={14} title={statusTitle} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#555555] tabular-nums">—</span>
                    )}
                  </td>
                  <td className="px-3">
                    <div className="relative flex min-w-0 items-center gap-2">
                      <span
                        className="rounded-full shrink-0"
                        title={project.shield_project_type ?? 'unknown'}
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: msc_shieldColorHex(
                            project.shield_project_type ?? undefined,
                          ),
                        }}
                      />
                      {!slim && msc_listDocPaperclip(project) && (
                          <span
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-[#00000066] text-[#eaeaea]"
                            title="Vault reference files"
                          >
                            <Paperclip size={11} strokeWidth={2} aria-hidden />
                          </span>
                        )}
                      <button
                        onClick={() => onSettings(project.id)}
                        className={`vpe-card-title min-w-0 text-left text-[13px] transition-colors hover:text-[#4fde82] ${
                          isError ? 'text-[#e02b20]' : pathMissing ? 'text-[#f59e0b]' : 'text-white'
                        }`}
                        type="button"
                      >
                        <span
                          ref={(el) => {
                            if (el) projectNameLabelRefs.current.set(project.id, el)
                            else projectNameLabelRefs.current.delete(project.id)
                          }}
                          className="inline-block max-w-full truncate align-middle"
                        >
                          {project.name}
                        </span>
                      </button>
                    </div>
                  </td>
                  <td className="px-2 text-[12px] text-[#A0A0A0]">
                    {project.status === 'building' ? '...' : project.port}
                  </td>
                  {!slim && (
                    <td className="px-3 tabular-nums text-[11px]">
                      <span className={httpCell.className}>{httpCell.text}</span>
                    </td>
                  )}
                  {!slim && (
                    <td className="px-3">
                      <span className="px-2 py-0.5 rounded bg-[#0a0a0a] text-[10px] text-[#A0A0A0] border border-[#333333]">
                        {project.pkgManager}
                      </span>
                    </td>
                  )}
                  {!slim && (
                    <td className="px-3 text-[11px] text-[#555555] truncate max-w-[300px]">
                      {project.path}
                    </td>
                  )}
                  <td className="px-1">
                    <div className={`flex items-center justify-center ${slim ? 'gap-0.5' : 'gap-1'}`}>
                      {isBuilding ? (
                        <button
                          disabled
                          title="Building..."
                          className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#ffcc00] cursor-not-allowed`}
                        >
                          <Hammer size={slim ? 12 : 14} className="animate-pulse" />
                        </button>
                      ) : isWatchdogRestarting ? (
                        <button
                          disabled
                          title="Watchdog auto-restart in progress..."
                          className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#ff7700] cursor-not-allowed`}
                        >
                          <Loader2 size={slim ? 12 : 14} className="animate-spin" />
                        </button>
                      ) : isDevInstalling ? (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(project.id)}
                          title="Installing dependencies… — click to stop"
                          className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#ffcc00] transition-colors hover:bg-[#333333] hover:text-[#e02b20]`}
                        >
                          <Loader2 size={slim ? 12 : 14} className="animate-spin" />
                        </button>
                      ) : pathMissing && !isRunning ? (
                        <button
                          type="button"
                          onClick={() => onSettings(project.id)}
                          title="Registry folder missing — open settings to relink path"
                          className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#3f1f12] text-[#fdba74] border border-[#78350f]/80 transition-colors hover:bg-[#5c2a15] hover:border-[#b45309]`}
                        >
                          <AlertTriangle size={slim ? 12 : 14} aria-hidden />
                        </button>
                      ) : !hasBuilt ? (
                        <button
                          onClick={() => onBuild?.(project.id)}
                          title="Build Project"
                          className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#22c55e] transition-colors hover:bg-[#22c55e] hover:text-white`}
                        >
                          <Hammer size={slim ? 12 : 14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onToggleStatus(project.id)}
                          title={isRunning ? 'Stop Server' : 'Start Server'}
                          className={`
                            ${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center transition-colors
                            ${isRunning
                              ? 'bg-[#e02b20] text-white hover:bg-[#c41e17]'
                              : 'bg-[#181818] text-white hover:bg-[#22c55e] hover:text-white'
                            }
                          `}
                        >
                          {isRunning ? (
                            <Square
                              size={slim ? 12 : 14}
                              className="shrink-0 text-white"
                              fill="currentColor"
                              strokeWidth={0}
                            />
                          ) : (
                            <Play
                              size={slim ? 12 : 14}
                              className="shrink-0 text-white"
                              fill="currentColor"
                              strokeWidth={0}
                            />
                          )}
                        </button>
                      )}

                      {onOpenInBrowser && (
                        <button
                          type="button"
                          disabled={!String(project.path || '').trim() || !onOpenInBrowser}
                          onClick={() => {
                            if (isRunning) onOpenInBrowser(project.id)
                          }}
                          title={
                            !String(project.path || '').trim()
                              ? 'Set a repo path in settings'
                              : isRunning
                                ? `Open http://localhost:${project.port} in browser`
                                : 'Start the project to open in browser'
                          }
                          className={`${slim ? 'h-6 px-1.5' : 'h-7 px-2'} rounded flex items-center justify-center gap-1 bg-[#181818] text-[9px] font-medium uppercase tracking-wide text-[#E8E8E8] transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#181818]`}
                        >
                          <ExternalLink size={slim ? 11 : 13} className="shrink-0" />
                          Open
                        </button>
                      )}

                      <button
                        onClick={() => onLogs(project.id)}
                        title="View Logs"
                        className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#E8E8E8] transition-colors hover:bg-[#333333] hover:text-white`}
                      >
                        <Terminal size={slim ? 12 : 14} />
                      </button>

                      <button
                        onClick={() => onSettings(project.id)}
                        title="Project Settings"
                        className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#A0A0A0] transition-colors hover:bg-[#333333] hover:text-white`}
                      >
                        <Settings size={slim ? 12 : 14} />
                      </button>

                      <button
                        onClick={() => onUnregister(project.id)}
                        title="Remove from Registry"
                        className={`${slim ? 'w-6 h-6' : 'w-7 h-7'} rounded flex items-center justify-center bg-[#181818] text-[#A0A0A0] transition-colors hover:bg-[#333333] hover:text-white`}
                      >
                        <Trash2 size={slim ? 12 : 14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {typeof document !== 'undefined' &&
        listPerfTip &&
        (() => {
          const tipProject = sortedProjects.find((p) => p.id === listPerfTip.projectId)
          if (!tipProject) return null
          return createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[10060] rounded border border-[#333333] bg-[#1c1c1c] px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.78)]"
              style={{
                top: listPerfTip.top,
                left: listPerfTip.left,
                transform: 'translate(0, -50%)',
              }}
            >
              <div className="flex items-center gap-4 whitespace-nowrap">
                <span className="text-[10px] text-[#A0A0A0]">
                  Uptime: <span className="text-white">{tipProject.uptime}</span>
                </span>
                <span className="text-[10px] text-[#A0A0A0]">
                  RAM: <span className="text-white">{tipProject.ram}</span>
                </span>
                <span className="text-[10px] text-[#A0A0A0]">
                  CPU: <span className="text-white">{tipProject.cpu}%</span>
                </span>
              </div>
            </div>,
            document.body,
          )
        })()}
    </motion.div>
  )
}
