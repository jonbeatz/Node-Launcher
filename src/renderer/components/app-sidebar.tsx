'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Square,
  Star,
  ChevronDown,
  FlaskConical,
  BookOpen,
  ScrollText,
} from 'lucide-react'

import {
  VPE_TACTICAL_NAV_META,
  type VpeTacticalCounts,
  type VpeTacticalProjectFilter,
} from '@/lib/project-tactical-filter'
import { msc_shieldColorHex } from '@/lib/shield-colors'
import { useSidebarAccordionState } from '@/state/useSidebar'
import type { MaintenanceTab } from '@/components/maintenance-section'

interface AppSidebarProps {
  activeItem?: string
  /** When on Maintenance, which sub-tab is active (for sidebar highlight). */
  maintenanceTab?: MaintenanceTab
  onNavigate?: (id: string) => void
  onStopAll?: () => void
  favorites?: { id: string; name: string }[]
  /** v1.2.5 tactical filter (mirrors dashboard pills). */
  tacticalActive?: VpeTacticalProjectFilter
  tacticalCounts?: VpeTacticalCounts
}

export function AppSidebar({
  activeItem = 'dashboard',
  maintenanceTab = 'vault',
  onNavigate,
  onStopAll,
  favorites = [],
  tacticalActive = 'all',
  tacticalCounts,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const { engineeringOpen, setEngineeringOpen, vaultOpen, setVaultOpen, favoritesOpen, setFavoritesOpen } =
    useSidebarAccordionState()

  const tc: VpeTacticalCounts = tacticalCounts ?? {
    all: 0,
    v0: 0,
    electron: 0,
    web: 0,
    node: 0,
    unknown: 0,
  }

  const sidebarWidth = collapsed ? 'w-12' : 'w-[220px]'

  const dashboardActive = activeItem === 'dashboard'
  const maintenanceActive = activeItem === 'maintenance'
  const sandboxActive = activeItem === 'sandbox'
  const vaultTabActive = (tab: MaintenanceTab) =>
    maintenanceActive && maintenanceTab === tab

  const msc_sidebarShieldTint = (
    tacticalId: VpeTacticalProjectFilter,
  ): string =>
    tacticalId === 'all' ? '#737373' : msc_shieldColorHex(tacticalId)

  return (
    <aside
      className={`vpe-sidebar ${sidebarWidth} h-full flex flex-col bg-[#1c1c1c] border-r border-[#333333] transition-all duration-200 shrink-0`}
    >
      <div className="p-2 border-b border-[#333333]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a] transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {/* Dashboard — flat (v1.3.5): full-width Dashboard button; Add lives in TopBar */}
          <div>
            {!collapsed && (
              <div className="px-2 mb-2">
                <span className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                  Dashboard
                </span>
              </div>
            )}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate?.('dashboard')}
                onMouseEnter={() => setHoveredItem('dashboard')}
                onMouseLeave={() => setHoveredItem(null)}
                className={`
                w-full flex items-center gap-3 p-2.5 rounded transition-all duration-200 vader-focus
                border border-[#444444] bg-[#1c1c1c] text-[#eaeaea] hover:bg-[#2a2a2a] hover:text-white
                ${
                  dashboardActive
                    ? 'bg-[#2a2a2a] text-white border-[#555555]'
                    : hoveredItem === 'dashboard'
                      ? 'bg-[#2a2a2a] text-white'
                      : ''
                }
                ${collapsed ? 'justify-center' : ''}
              `}
                title={collapsed ? 'Dashboard' : undefined}
              >
                <LayoutDashboard size={18} />
                {!collapsed && <span className="font-sans text-sm font-semibold">Dashboard</span>}
              </button>
            </div>
          </div>

          {!collapsed && (
            <div>
              <button
                type="button"
                onClick={() => setEngineeringOpen(!engineeringOpen)}
                className="w-full px-2 mb-2 flex items-center justify-between group"
              >
                <span className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] group-hover:text-white transition-colors text-left">
                  Engineering
                </span>
                <ChevronDown
                  size={10}
                  className={`text-[#A0A0A0] transition-transform shrink-0 ${engineeringOpen ? '' : '-rotate-90'}`}
                />
              </button>
              {engineeringOpen && (
                <div className="space-y-0.5 pl-1">
                  {VPE_TACTICAL_NAV_META.map((item) => {
                    const n = tc[item.countKey]
                    const isOn = tacticalActive === item.id
                    const tint = msc_sidebarShieldTint(item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate?.(`tactical:${item.id}`)}
                        onMouseEnter={() => setHoveredItem(`tactical-${item.id}`)}
                        onMouseLeave={() => setHoveredItem(null)}
                        title={`${item.label} (${n})`}
                        className={`
                        flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-all duration-200 vader-focus font-sans
                        ${
                          isOn
                            ? 'bg-[#2a2a2a] text-white'
                            : hoveredItem === `tactical-${item.id}`
                              ? 'bg-[#2a2a2a] text-white'
                              : 'text-[#E8E8E8] hover:bg-[#2a2a2a] hover:text-white'
                        }
                      `}
                      >
                        <span
                          className="shrink-0 rounded-full"
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: tint,
                          }}
                          aria-hidden
                        />
                        <span className="truncate flex-1 text-left font-medium">
                          {item.label}
                        </span>
                        <span
                          className="shrink-0 tabular-nums text-[var(--text-muted,#A0A0A0)]"
                          style={{ fontSize: '0.7rem' }}
                        >
                          ({n})
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setVaultOpen(!vaultOpen)}
                className="w-full px-2 mb-2 flex items-center justify-between group"
              >
                <span className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] group-hover:text-white transition-colors text-left">
                  Vault
                </span>
                <ChevronDown
                  size={10}
                  className={`text-[#A0A0A0] transition-transform ${vaultOpen ? '' : '-rotate-90'}`}
                />
              </button>
            )}
            {(vaultOpen || collapsed) && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onNavigate?.('maintenance:vault')}
                  onMouseEnter={() => setHoveredItem('vault-prompt')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`
                    w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                    ${
                      vaultTabActive('vault')
                        ? 'bg-[#2a2a2a] text-white'
                        : hoveredItem === 'vault-prompt'
                          ? 'bg-[#2a2a2a] text-white'
                          : 'text-[#A0A0A0]'
                    }
                  `}
                  title={collapsed ? 'Prompt Vault' : undefined}
                >
                  <BookOpen size={18} />
                  {!collapsed && <span className="font-sans text-sm font-medium">Prompt Vault</span>}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('maintenance:logs')}
                  onMouseEnter={() => setHoveredItem('vault-logs')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`
                    w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                    ${
                      vaultTabActive('logs')
                        ? 'bg-[#2a2a2a] text-white'
                        : hoveredItem === 'vault-logs'
                          ? 'bg-[#2a2a2a] text-white'
                          : 'text-[#A0A0A0]'
                    }
                  `}
                  title={collapsed ? 'Repair Logs' : undefined}
                >
                  <ScrollText size={18} />
                  {!collapsed && <span className="font-sans text-sm font-medium">Repair Logs</span>}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('sandbox')}
                  onMouseEnter={() => setHoveredItem('vault-sandbox')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`
                    w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
                    ${
                      sandboxActive
                        ? 'bg-[#2a2a2a] text-white'
                        : hoveredItem === 'vault-sandbox'
                          ? 'bg-[#2a2a2a] text-white'
                          : 'text-[#A0A0A0]'
                    }
                  `}
                  title={collapsed ? 'VPE Sandbox' : undefined}
                >
                  <FlaskConical size={18} />
                  {!collapsed && <span className="font-sans text-sm font-medium">VPE Sandbox</span>}
                </button>
              </div>
            )}
          </div>

          <div>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setFavoritesOpen(!favoritesOpen)}
                className="w-full px-2 mb-2 flex items-center justify-between group"
              >
                <span className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] group-hover:text-white transition-colors text-left flex items-center gap-2">
                  <Star size={10} className="text-[#ffcc00] fill-[#ffcc00] shrink-0" />
                  Favorites
                </span>
                <ChevronDown
                  size={10}
                  className={`text-[#A0A0A0] transition-transform ${favoritesOpen ? '' : '-rotate-90'}`}
                />
              </button>
            )}
            {(favoritesOpen || collapsed) && (
              <div className="space-y-1">
                {favorites.length > 0 ? (
                  favorites.map((fav) => (
                    <button
                      key={fav.id}
                      onClick={() => onNavigate?.(`favorite:${fav.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a] transition-all vader-focus group"
                      title={collapsed ? fav.name : undefined}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#333333] group-hover:bg-[#ffcc00] shrink-0" />
                      {!collapsed && (
                        <span className="font-sans text-xs truncate text-left">{fav.name}</span>
                      )}
                      {collapsed && <Star size={14} className="text-[#ffcc00] fill-[#ffcc00] mx-auto" />}
                    </button>
                  ))
                ) : (
                  !collapsed && (
                    <div className="px-2 py-1 text-[10px] text-[#555555] italic">No favorites yet</div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-2 border-t border-[#333333]" />

      <div className="p-2">
        <button
          onClick={onStopAll}
          onMouseEnter={() => setHoveredItem('stop-all')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`
            w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
            bg-[#1c1c1c] border border-[#444444] text-[#eaeaea]
            hover:bg-[#2a2a2a] hover:text-white hover:border-[#555555]
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Stop All Projects' : undefined}
        >
          <Square size={18} />
          {!collapsed && <span className="font-sans text-sm font-medium">STOP ALL</span>}
        </button>
      </div>

      <div className="mx-2 border-t border-[#333333]" />

      <div className="p-2">
        <button
          onClick={() => onNavigate?.('settings')}
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`
            w-full flex items-center gap-3 p-2 rounded transition-all duration-200 vader-focus
            ${
              activeItem === 'settings'
                ? 'bg-[#2a2a2a] text-white'
                : hoveredItem === 'settings'
                  ? 'bg-[#2a2a2a] text-white'
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
