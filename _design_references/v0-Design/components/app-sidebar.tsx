'use client'

import { useState } from 'react'
import { 
  LayoutDashboard, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Square
} from 'lucide-react'

interface AppSidebarProps {
  activeItem?: string
  onNavigate?: (id: string) => void
  onAddProject?: () => void
  onStopAll?: () => void
}

export function AppSidebar({ activeItem = 'dashboard', onNavigate, onAddProject, onStopAll }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const sidebarWidth = collapsed ? 'w-12' : 'w-[220px]'

  return (
    <aside className={`${sidebarWidth} h-full flex flex-col bg-[#1c1c1c] border-r border-[#333333] transition-all duration-200 shrink-0`}>
      {/* Collapse Toggle */}
      <div className="p-2 border-b border-[#333333]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-4">
          {/* Dashboard */}
          <div>
            <button
              onClick={() => onNavigate?.('dashboard')}
              onMouseEnter={() => setHoveredItem('dashboard')}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                ${activeItem === 'dashboard' 
                  ? 'bg-[#252525] text-white' 
                  : hoveredItem === 'dashboard'
                    ? 'bg-[#252525] text-white' 
                    : 'text-[#A0A0A0]'
                }
              `}
              title={collapsed ? 'Dashboard' : undefined}
            >
              <LayoutDashboard size={18} />
              {!collapsed && <span className="font-sans text-sm font-medium">Dashboard</span>}
            </button>
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-[#333333]" />

          {/* Registry Section */}
          <div>
            {!collapsed && (
              <div className="px-2 mb-2">
                <span className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                  Registry
                </span>
              </div>
            )}
            {/* Add New Project - VPE Green */}
            <button
              onClick={onAddProject}
              onMouseEnter={() => setHoveredItem('add-project')}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                bg-[#4fde82] hover:bg-[#3fcf72] text-black
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? 'Add New Project' : undefined}
            >
              <Plus size={18} />
              {!collapsed && <span className="font-sans text-sm font-medium">Add New Project</span>}
            </button>
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-[#333333]" />

          {/* Repair Logs */}
          <div>
            <button
              onClick={() => onNavigate?.('repair-logs')}
              onMouseEnter={() => setHoveredItem('repair-logs')}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                ${activeItem === 'repair-logs' 
                  ? 'bg-[#252525] text-white' 
                  : hoveredItem === 'repair-logs'
                    ? 'bg-[#252525] text-white' 
                    : 'text-[#A0A0A0]'
                }
              `}
              title={collapsed ? 'Repair Logs' : undefined}
            >
              <FileText size={18} />
              {!collapsed && <span className="font-sans text-sm font-medium">Repair Logs</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* Divider */}
      <div className="mx-2 border-t border-[#333333]" />

      {/* STOP ALL - Red on hover */}
      <div className="p-2">
        <button
          onClick={onStopAll}
          onMouseEnter={() => setHoveredItem('stop-all')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`
            w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
            bg-[#2a2a2a] border border-[#555555] text-[#A0A0A0] hover:border-[#e02b20] hover:text-[#e02b20] hover:bg-[#e02b20]/10
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Stop All Projects' : undefined}
        >
          <Square size={18} />
          {!collapsed && <span className="font-sans text-sm font-medium">STOP ALL</span>}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-2 border-t border-[#333333]" />

      {/* Settings - Bottom */}
      <div className="p-2">
        <button
          onClick={() => onNavigate?.('settings')}
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`
            w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
            ${activeItem === 'settings' 
              ? 'bg-[#252525] text-white' 
              : hoveredItem === 'settings'
                ? 'bg-[#252525] text-white' 
                : 'text-[#A0A0A0]'
            }
          `}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={18} />
          {!collapsed && <span className="font-sans text-sm font-medium">Settings</span>}
        </button>
      </div>
    </aside>
  )
}
