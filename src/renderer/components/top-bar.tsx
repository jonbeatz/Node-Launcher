'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Search, Activity, X } from 'lucide-react'

interface TopBarProps {
  onOpenSettings?: () => void
  onOpenDiagnostics?: () => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
}

export function TopBar({ onOpenSettings, onOpenDiagnostics, searchTerm = '', onSearchChange }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const handleClearSearch = () => {
    onSearchChange?.('')
    setSearchOpen(false)
  }

  return (
    <header className="h-12 w-full bg-[#1c1c1c] border-b border-[#333333] flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center gap-3">
        <span className="font-sans font-bold text-white text-sm uppercase tracking-[0.05em]">VPE</span>
        <div className="w-px h-5 bg-[#333333]" />
        <span className="font-sans text-xs text-[#A0A0A0]">Projects {'>'} MSC Media Pro</span>
      </div>

      {/* Right: Icons + Search */}
      <div className="flex items-center gap-2">
        {/* Search Bar - Animated Slide-out */}
        <div className={`flex items-center overflow-hidden transition-all duration-300 ${searchOpen ? 'w-64' : 'w-0'}`}>
          <div className="relative w-full">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-3 pr-8 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82]"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleClearSearch()
              }}
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Search Icon */}
        <button 
          onClick={() => {
            if (searchOpen && !searchTerm) {
              setSearchOpen(false)
            } else {
              setSearchOpen(true)
            }
          }}
          className={`p-2 rounded transition-colors vader-focus ${searchOpen ? 'text-[#4fde82]' : 'text-[#A0A0A0] hover:text-[#4fde82]'}`}
          title="Search projects (Ctrl+F)"
        >
          <Search size={18} />
        </button>
        
        {/* System Health/Diagnostics Icon */}
        <button 
          onClick={onOpenDiagnostics}
          className="p-2 rounded text-[#A0A0A0] hover:text-[#4fde82] transition-colors vader-focus"
          title="System health"
        >
          <Activity size={18} />
        </button>
        
        {/* Global Settings Gear */}
        <button 
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
