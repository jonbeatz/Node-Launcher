'use client'

import { useState } from 'react'
import { Play, Square, Wrench, Trash2, Terminal, X, Settings, AlertTriangle, Hammer } from 'lucide-react'

interface ProjectCardProps {
  name: string
  port: number
  uptime: string
  status: 'running' | 'stopped' | 'error' | 'building'
  cpu?: number
  ram?: string
  errorMessage?: string
  thumbnailUrl?: string
  hasBuilt?: boolean
  onStart?: () => void
  onStop?: () => void
  onBuild?: () => void
  onLogs?: () => void
  onRepair?: () => void
  onNuke?: () => void
  onSettings?: () => void
  onUnregister?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export function ProjectCard({
  name,
  port,
  uptime,
  status,
  cpu = 0,
  ram = '0MB',
  errorMessage,
  thumbnailUrl,
  hasBuilt = true,
  onStart,
  onStop,
  onBuild,
  onLogs,
  onRepair,
  onNuke,
  onSettings,
  onUnregister,
  onContextMenu,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isRunning = status === 'running'
  const isError = status === 'error'
  const isStopped = status === 'stopped'
  const isBuilding = status === 'building'

  // Determine what the primary button should show
  const getPrimaryButton = () => {
    if (isBuilding) return { label: 'BUILDING...', icon: Hammer, disabled: true }
    if (!hasBuilt) return { label: 'BUILD', icon: Hammer, action: onBuild }
    if (isRunning) return { label: 'STOP', icon: Square, action: onStop, active: true }
    if (isError) return { label: 'REBUILD', icon: Hammer, action: onBuild }
    return { label: 'START', icon: Play, action: onStart }
  }

  const primaryBtn = getPrimaryButton()

  // LED color logic - Running = green, Stopped = grey (blinking if recently stopped), Error = red
  const getLedColor = () => {
    if (isRunning) return 'bg-[#4fde82] shadow-[0_0_6px_#4fde82]'
    if (isError) return 'bg-[#e02b20] animate-pulse-led shadow-[0_0_6px_#e02b20]'
    if (isBuilding) return 'bg-[#ffcc00] animate-pulse-led'
    return 'bg-[#555555]' // Stopped = grey
  }

  const getStatusLabel = () => {
    if (isRunning) return 'RUNNING'
    if (isError) return 'ERROR'
    if (isBuilding) return 'BUILDING'
    return 'STOPPED'
  }

  return (
    <div
      className={`vader-card overflow-hidden relative ${isError ? 'border-[#e02b20]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
    >
      {/* Thumbnail / Visual Area - 4:3 aspect ratio */}
      <div className="relative aspect-[4/3] bg-[#0a0a0a] overflow-hidden border-b border-[#333333]" style={{ borderRadius: '4px 4px 0 0' }}>
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={name}
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full vader-grid-pattern flex items-center justify-center">
            <span className="font-sans text-xs text-[#333333] uppercase tracking-wider">THUMBNAIL</span>
          </div>
        )}
        
        {/* Top-right overlay icons: Gear + X */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onSettings?.() }}
            className="w-7 h-7 rounded bg-[#0a0a0a]/70 backdrop-blur-sm flex items-center justify-center text-[#A0A0A0] hover:text-[#4fde82] transition-colors"
            title="Project Settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onUnregister?.() }}
            className="w-7 h-7 rounded bg-[#0a0a0a]/70 backdrop-blur-sm flex items-center justify-center text-[#A0A0A0] hover:text-[#e02b20] transition-colors"
            title="Remove from Registry"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Project Info Section */}
      <div className="p-4">
        {/* Project Name + Error Icon */}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-sans font-bold text-white text-base">{name}</h3>
          {isError && <AlertTriangle size={14} className="text-[#ff4444]" />}
        </div>
        
        {/* Status Row */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${getLedColor()}`} />
          <span className={`font-sans text-[11px] uppercase tracking-[0.05em] ${isError ? 'text-[#e02b20]' : isRunning ? 'text-[#4fde82]' : 'text-[#A0A0A0]'}`}>
            {getStatusLabel()}
          </span>
        </div>
        
        {/* Metadata Grid - 2 columns (CPU/RAM removed per Aqua Protocol) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] uppercase">
          <div>
            <span className="text-[#555555]">PORT</span>
            <span className="ml-2 text-[#A0A0A0] text-[13px] normal-case">{port}</span>
          </div>
          <div>
            <span className="text-[#555555]">UPTIME</span>
            <span className="ml-2 text-[#A0A0A0] text-[13px] normal-case">{uptime}</span>
          </div>
        </div>

        {/* Error Message */}
        {isError && errorMessage && (
          <div className="mt-3 p-2 rounded bg-[#ff4444]/10 border border-[#ff4444]/30">
            <span className="font-sans text-[11px] text-[#ff4444]">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Action Button Row - 4px radius, proper colors */}
      <div className="p-3 flex items-center gap-2">
        {/* Primary: BUILD/START/STOP */}
        <button
          onClick={primaryBtn.action}
          disabled={primaryBtn.disabled}
          className={`
            flex-1 flex items-center justify-center gap-1.5 h-7 rounded font-sans text-xs transition-all vader-focus
            ${primaryBtn.active 
              ? 'bg-[#4fde82] text-black' 
              : primaryBtn.disabled
                ? 'bg-transparent border border-[#333333] text-[#555555] cursor-not-allowed'
                : 'bg-transparent border border-[#555555] text-white hover:border-[#4fde82] hover:text-[#4fde82]'
            }
          `}
        >
          <primaryBtn.icon size={12} />
          <span>{primaryBtn.label}</span>
        </button>

        {/* LOGS - Dark grey background */}
        <button
          onClick={onLogs}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all vader-focus"
        >
          <Terminal size={12} />
          <span>LOGS</span>
        </button>

        {/* REPAIR - Dark grey background */}
        <button
          onClick={onRepair}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:border-[#4fde82] hover:text-white transition-all vader-focus"
        >
          <Wrench size={12} />
          <span>REPAIR</span>
        </button>

        {/* NUKE - Dark grey with light grey stroke, red hover */}
        <button
          onClick={onNuke}
          className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-[#2a2a2a] border border-[#555555] font-sans text-xs text-[#A0A0A0] hover:border-[#e02b20] hover:text-[#e02b20] transition-all vader-focus"
        >
          <Trash2 size={12} />
          <span>NUKE</span>
        </button>
      </div>
    </div>
  )
}
