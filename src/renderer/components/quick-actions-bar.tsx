'use client'

import { Play, Square, RefreshCw, FolderOpen } from 'lucide-react'

interface QuickActionsBarProps {
  onStartAll: () => void
  onStopAll: () => void
  onRefreshAll: () => void
  onOpenExplorer: () => void
}

export function QuickActionsBar({ onStartAll, onStopAll, onRefreshAll, onOpenExplorer }: QuickActionsBarProps) {
  return (
    <div className="flex items-center gap-1 px-6 pb-2">
      <button
        onClick={onStartAll}
        className="w-7 h-7 rounded flex items-center justify-center text-[#A0A0A0] hover:text-[#4fde82] hover:bg-[#252525] transition-all vader-focus"
        title="Start All Projects"
      >
        <Play size={14} />
      </button>
      <button
        onClick={onStopAll}
        className="w-7 h-7 rounded flex items-center justify-center text-[#A0A0A0] hover:text-[#e02b20] hover:bg-[#252525] transition-all vader-focus"
        title="Stop All Projects"
      >
        <Square size={14} />
      </button>
      <button
        onClick={onRefreshAll}
        className="w-7 h-7 rounded flex items-center justify-center text-[#A0A0A0] hover:text-[#4fde82] hover:bg-[#252525] transition-all vader-focus"
        title="Refresh All Statuses"
      >
        <RefreshCw size={14} />
      </button>
      <button
        onClick={onOpenExplorer}
        className="w-7 h-7 rounded flex items-center justify-center text-[#A0A0A0] hover:text-[#4fde82] hover:bg-[#252525] transition-all vader-focus"
        title="Open VPE Directory"
      >
        <FolderOpen size={14} />
      </button>
    </div>
  )
}
