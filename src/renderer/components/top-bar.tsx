'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Search, Activity, X } from 'lucide-react'

interface TopBarProps {
  onOpenSettings?: () => void
  onOpenDiagnostics?: () => void
  /** Narrow search (respects status / tactical filters in page). */
  filterSearchTerm?: string
  onFilterSearchChange?: (term: string) => void
  /** Ctrl+K palette — finds any project ignoring dashboard filters. */
  commandSearchTerm?: string
  onCommandSearchChange?: (term: string) => void
  commandSearchActive?: boolean
  onCommandSearchActiveChange?: (active: boolean) => void
}

export function TopBar({
  onOpenSettings,
  onOpenDiagnostics,
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
    ? 'Jump to any project…'
    : 'Search in current view…'

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
      <div className="flex items-center gap-3">
        <span className="font-sans font-bold text-white text-sm uppercase tracking-[0.05em]">VPE</span>
        <div className="w-px h-5 bg-[#333333]" />
        <span className="font-sans text-xs text-[#A0A0A0]">Projects {'>'} MSC Media Pro</span>
      </div>

      <div className="flex items-center gap-2">
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
              className="w-full pl-3 pr-8 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82]"
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
          className={`p-2 rounded transition-colors vader-focus ${searchOpen ? 'text-[#4fde82]' : 'text-[#A0A0A0] hover:text-[#4fde82]'}`}
          title="Search current view — Ctrl+K (Cmd+K) finds any project"
        >
          <Search size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenDiagnostics}
          className="p-2 rounded text-[#A0A0A0] hover:text-[#4fde82] transition-colors vader-focus"
          title="System health"
        >
          <Activity size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded text-[#A0A0A0] hover:text-[#4fde82] transition-colors vader-focus"
          title="Global settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  )
}
