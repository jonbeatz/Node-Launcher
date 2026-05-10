'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Search, X, Plus } from 'lucide-react'
import { VpeHealthEqualizerIcon } from '@/components/vpe-health-equalizer-icon'

interface TopBarProps {
  /** Catalog project count — shown after breadcrumb (v1.3.4+); duplicate count removed from filter row (v1.3.5). */
  projectCount?: number
  /** v1.3.5 — global add project (also available from keyboard / flows). */
  onAddProject?: () => void
  onOpenSettings?: () => void
  onOpenDiagnostics?: () => void
  /** v1.3.2 — orphan `node.exe` on catalog port while VPE shows no running project. */
  ghostWarning?: boolean
  ghostHint?: string
  /** v1.6.0 Vault Search — substring match on name / tag / port (respects status + tactical filters on dashboard). */
  filterSearchTerm?: string
  onFilterSearchChange?: (term: string) => void
  /** Ctrl+K palette — finds any project ignoring dashboard filters. */
  commandSearchTerm?: string
  onCommandSearchChange?: (term: string) => void
  commandSearchActive?: boolean
  onCommandSearchActiveChange?: (active: boolean) => void
}

export function TopBar({
  projectCount,
  onAddProject,
  onOpenSettings,
  onOpenDiagnostics,
  ghostWarning = false,
  ghostHint,
  filterSearchTerm = '',
  onFilterSearchChange,
  commandSearchTerm = '',
  onCommandSearchChange,
  commandSearchActive = false,
  onCommandSearchActiveChange,
}: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen, commandSearchActive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K'
      if (!(e.ctrlKey || e.metaKey) || !isK) return
      e.preventDefault()
      onCommandSearchActiveChange?.(true)
      setSearchOpen(true)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCommandSearchActiveChange])

  const displayValue = commandSearchActive ? commandSearchTerm : filterSearchTerm
  const placeholder = commandSearchActive
    ? 'Jump — name, tag, port, path…'
    : 'Vault search — name, tag, port…'

  const handleChange = (v: string) => {
    if (commandSearchActive) {
      onCommandSearchChange?.(v)
    } else {
      onFilterSearchChange?.(v)
    }
  }

  const handleClearSearch = () => {
    if (commandSearchActive) {
      onCommandSearchChange?.('')
      onCommandSearchActiveChange?.(false)
    } else {
      onFilterSearchChange?.('')
    }
    setSearchOpen(false)
  }

  return (
    <header className="h-12 w-full bg-[#1c1c1c] border-b border-[#333333] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="font-sans font-bold text-white text-sm uppercase tracking-[0.05em] shrink-0">
          VPE
        </span>
        <div className="w-px h-5 bg-[#333333] shrink-0" />
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-sans text-xs text-[#A0A0A0] truncate">
            Projects {'>'} MSC Media Pro
          </span>
          {typeof projectCount === 'number' && projectCount >= 0 && (
            <span
              className="shrink-0 ml-1.5 rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#c8c8c8] bg-[#2a2a2a] border border-[#333333]"
              title="Registered catalog projects"
            >
              {projectCount} {projectCount === 1 ? 'PROJECT' : 'PROJECTS'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 mr-[13px]">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded text-[#9ca3af] hover:text-[#d1d5db] transition-colors vader-focus"
          title="Global settings"
        >
          <Settings size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenDiagnostics}
          className={`p-2 rounded transition-colors vader-focus ${
            ghostWarning
              ? 'text-[#e8a838] hover:text-[#f0b850] animate-pulse drop-shadow-[0_0_6px_rgba(232,168,56,0.55)]'
              : 'text-[#9ca3af] hover:text-[#c4c9d1]'
          }`}
          title={
            ghostHint ??
            (ghostWarning
              ? 'Ghost listener detected — open System Health for Scorched Earth / port purge'
              : 'System health')
          }
        >
          <VpeHealthEqualizerIcon size={18} title="System health" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (searchOpen && !displayValue) {
              setSearchOpen(false)
            } else {
              onCommandSearchActiveChange?.(false)
              setSearchOpen(true)
              requestAnimationFrame(() => searchInputRef.current?.focus())
            }
          }}
          className={`p-2 rounded transition-colors vader-focus ${searchOpen ? 'text-[#9ca3af]' : 'text-[#9ca3af] hover:text-[#d1d5db]'}`}
          title="Vault search (dashboard) — Ctrl+K / Cmd+K: jump palette also matches path"
        >
          <Search size={18} />
        </button>

        <div
          className={`flex items-center overflow-hidden transition-all duration-300 ${searchOpen ? 'w-64' : 'w-0'}`}
        >
          <div className="relative w-full">
            <input
              ref={searchInputRef}
              type="text"
              value={displayValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-3 pr-8 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4b5563] focus-visible:ring-1 focus-visible:ring-[#4b5563] focus-visible:border-[#4b5563]"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleClearSearch()
              }}
            />
            {displayValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {onAddProject ? (
          <>
            <button
              type="button"
              onClick={onAddProject}
              className="hidden sm:inline-flex h-8 items-center gap-2 rounded border border-[#444444] bg-[#1c1c1c] px-3 font-sans text-[11px] font-medium uppercase tracking-wide text-[#eaeaea] hover:bg-[#2a2a2a] hover:text-white hover:border-[#555555] transition-colors vader-focus"
              title="Register a new catalog project"
            >
              <Plus size={14} className="shrink-0" />
              Add New Project
            </button>
            <button
              type="button"
              onClick={onAddProject}
              className="sm:hidden p-2 rounded border border-[#444444] text-[#eaeaea] hover:bg-[#2a2a2a] vader-focus"
              title="Add New Project"
              aria-label="Add New Project"
            >
              <Plus size={18} />
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}
