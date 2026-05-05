'use client'

import { useState } from 'react'
import { 
  Play, Square, Wrench, Trash2, Terminal, Settings, X, 
  ChevronUp, ChevronDown, Hammer
} from 'lucide-react'

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
  hasBuilt?: boolean
}

interface ProjectListViewProps {
  projects: Project[]
  selectedIds: string[]
  onSelectProject: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onToggleStatus: (id: string) => void
  onBuild?: (id: string) => void
  onLogs: (id: string) => void
  onRepair: (id: string) => void
  onNuke: (id: string) => void
  onSettings: (id: string) => void
  onUnregister: (id: string) => void
  compact?: boolean
  onToggleCompact?: () => void
}

type SortField = 'name' | 'port' | 'path'
type SortDirection = 'asc' | 'desc'

export function ProjectListView({
  projects,
  selectedIds,
  onSelectProject,
  onSelectAll,
  onToggleStatus,
  onBuild,
  onLogs,
  onRepair,
  onNuke,
  onSettings,
  onUnregister,
}: ProjectListViewProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase()
    if (typeof bVal === 'string') bVal = bVal.toLowerCase()
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <ChevronUp size={12} className="text-[#4fde82]" /> : 
      <ChevronDown size={12} className="text-[#4fde82]" />
  }

  const getLedColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#00cc66]'
      case 'error': return 'bg-[#ff4444]'
      case 'building': return 'bg-[#ffcc00] animate-pulse-led'
      default: return 'bg-[#555555]'
    }
  }

  const allSelected = projects.length > 0 && selectedIds.length === projects.length

  return (
    <div className="w-full bg-[#1c1c1c] border border-[#333333] rounded overflow-hidden">
      {/* Bulk Actions Bar - Dark grey with lighter grey buttons */}
      {selectedIds.length > 0 && (
        <div className="bg-[#2a2a2a] h-10 flex items-center justify-between px-4 rounded-t border-b border-[#333333]">
          <span className="font-sans text-xs text-white font-medium uppercase tracking-wider">
            {selectedIds.length} PROJECT{selectedIds.length > 1 ? 'S' : ''} SELECTED
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded border border-[#555555] text-white font-sans text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              STOP SELECTED
            </button>
            <button className="px-3 py-1 rounded border border-[#555555] text-white font-sans text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              START SELECTED
            </button>
            <button className="px-3 py-1 rounded border border-[#555555] text-white font-sans text-[10px] uppercase hover:border-[#4fde82] hover:text-[#4fde82] transition-all">
              REMOVE SELECTED
            </button>
            <button 
              onClick={() => onSelectAll(false)}
              className="ml-2 font-sans text-xs text-[#A0A0A0] hover:text-white"
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
            <tr className="h-9">
              <th className="w-8 px-3">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-[#555555] bg-[#2a2a2a] checked:bg-[#4fde82] checked:border-[#4fde82] accent-[#4fde82]"
                />
              </th>
              <th className="w-12 px-3 text-center font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Status
              </th>
              <th 
                onClick={() => handleSort('name')}
                className="min-w-[280px] px-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">Project Name <SortIcon field="name" /></span>
              </th>
              <th 
                onClick={() => handleSort('port')}
                className="w-20 px-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">Port <SortIcon field="port" /></span>
              </th>
              <th className="w-16 px-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                PKG
              </th>
              <th 
                onClick={() => handleSort('path')}
                className="min-w-[300px] px-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">Path <SortIcon field="path" /></span>
              </th>
              <th className="w-[180px] px-3 text-center font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Actions
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedProjects.map((project, index) => {
              const isSelected = selectedIds.includes(project.id)
              const isRunning = project.status === 'running'
              const isError = project.status === 'error'
              const isStopped = project.status === 'stopped'
              const isBuilding = project.status === 'building'
              const hasBuilt = project.hasBuilt !== false
              const rowBg = index % 2 === 0 ? 'bg-[#121212]' : 'bg-[#1a1a1a]'
              const isHovered = hoveredProject === project.id

              return (
                <tr 
                  key={project.id}
                  onMouseEnter={() => setHoveredProject(project.id)}
                  onMouseLeave={() => setHoveredProject(null)}
                  className={`
                    ${rowBg} hover:bg-[#1c1c1c] transition-colors h-12
                    ${isError ? 'border-l-2 border-l-[#e02b20]' : 'border-l-2 border-l-transparent hover:border-l-[#4fde82]'}
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
                  <td className="px-3 text-center">
                    <div className={`w-2 h-2 rounded-full mx-auto ${getLedColor(project.status)}`} />
                  </td>
                  <td className="px-3">
                    <div className="relative">
                      <button 
                        onClick={() => onSettings(project.id)}
                        className={`font-sans text-[13px] font-bold hover:text-[#4fde82] transition-colors ${isError ? 'text-[#e02b20]' : 'text-white'}`}
                      >
                        {project.name}
                      </button>
                      
                      {/* Hover Tooltip with Uptime and RAM */}
                      {isHovered && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-[#1c1c1c] border border-[#333333] rounded px-3 py-2 shadow-lg">
                          <div className="flex items-center gap-4 whitespace-nowrap">
                            <span className="font-sans text-[10px] text-[#A0A0A0]">
                              Uptime: <span className="text-white">{project.uptime}</span>
                            </span>
                            <span className="font-sans text-[10px] text-[#A0A0A0]">
                              RAM: <span className="text-white">{project.ram}</span>
                            </span>
                            <span className="font-sans text-[10px] text-[#A0A0A0]">
                              CPU: <span className="text-white">{project.cpu}%</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 font-sans text-[13px] text-[#A0A0A0]">
                    {project.status === 'building' ? '...' : project.port}
                  </td>
                  <td className="px-3">
                    <span className="px-2 py-0.5 rounded bg-[#0a0a0a] font-sans text-[10px] text-[#A0A0A0] border border-[#333333]">
                      {project.pkgManager}
                    </span>
                  </td>
                  <td className="px-3 font-sans text-[11px] text-[#555555] truncate max-w-[300px]">
                    {project.path}
                  </td>
                  <td className="px-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* Build/Start/Stop Button - SQUARED 4px radius */}
                      {isBuilding ? (
                        <button
                          disabled
                          title="Building..."
                          className="w-7 h-7 rounded flex items-center justify-center border border-[#ffcc00] text-[#ffcc00] cursor-not-allowed"
                        >
                          <Hammer size={14} className="animate-pulse" />
                        </button>
                      ) : !hasBuilt ? (
                        <button
                          onClick={() => onBuild?.(project.id)}
                          title="Build Project"
                          className="w-7 h-7 rounded flex items-center justify-center border border-[#4fde82] text-[#4fde82] hover:bg-[#4fde82] hover:text-black transition-all"
                        >
                          <Hammer size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onToggleStatus(project.id)}
                          title={isRunning ? 'Stop Server' : 'Start Server'}
                          className={`
                            w-7 h-7 rounded flex items-center justify-center transition-all
                            ${isRunning 
                              ? 'bg-[#e02b20] text-white border border-[#e02b20]' 
                              : 'border border-[#555555] text-white hover:border-[#4fde82]'
                            }
                          `}
                        >
                          {isRunning ? <Square size={14} /> : <Play size={14} />}
                        </button>
                      )}
                      
                      {/* Logs Button - SQUARED */}
                      <button
                        onClick={() => onLogs(project.id)}
                        title="View Logs"
                        className="w-7 h-7 rounded flex items-center justify-center border border-[#555555] text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all"
                      >
                        <Terminal size={14} />
                      </button>
                      
                      {/* Repair Button - SQUARED */}
                      <button
                        onClick={() => onRepair(project.id)}
                        title="Repair Code"
                        className="w-7 h-7 rounded flex items-center justify-center border border-[#555555] text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all"
                      >
                        <Wrench size={14} />
                      </button>
                      
                      {/* Nuke Button - SQUARED with red border */}
                      <button
                        onClick={() => onNuke(project.id)}
                        title="Nuke Project"
                        className="w-7 h-7 rounded flex items-center justify-center border border-[#e02b20] text-[#e02b20] hover:bg-[#e02b20] hover:text-white transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      {/* Settings Button - SQUARED */}
                      <button
                        onClick={() => onSettings(project.id)}
                        title="Project Settings"
                        className="w-7 h-7 rounded flex items-center justify-center border border-[#555555] text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all"
                      >
                        <Settings size={14} />
                      </button>
                      
                      {/* Unregister Button - SQUARED */}
                      <button
                        onClick={() => onUnregister(project.id)}
                        title="Remove from Registry"
                        className="w-7 h-7 rounded flex items-center justify-center border border-[#555555] text-[#A0A0A0] hover:border-[#e02b20] hover:text-white transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
