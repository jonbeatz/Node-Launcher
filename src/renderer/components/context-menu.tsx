'use client'

import { useEffect, useRef } from 'react'
import { 
  FolderOpen, 
  Code2, 
  Terminal, 
  Camera, 
  Hammer, 
  Copy, 
  Clipboard, 
  Trash2 
} from 'lucide-react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  action?: () => void
  danger?: boolean
  divider?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  isOpen: boolean
  onClose: () => void
  items?: ContextMenuItem[]
  projectName?: string
  projectPath?: string
  projectPort?: number
  onOpenExplorer?: () => void
  onOpenVSCode?: () => void
  onOpenTerminal?: () => void
  onRecaptureThumbnail?: () => void
  onRunBuild?: () => void
  onCopyPath?: () => void
  onCopyPort?: () => void
  onRemove?: () => void
}

export function ContextMenu({
  x,
  y,
  isOpen,
  onClose,
  projectName,
  projectPath = 'C:/Users/Vader/Projects/msc-media-pro',
  projectPort = 3000,
  onOpenExplorer,
  onOpenVSCode,
  onOpenTerminal,
  onRecaptureThumbnail,
  onRunBuild,
  onCopyPath,
  onCopyPort,
  onRemove,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 350)

  const menuItems: ContextMenuItem[] = [
    { label: 'Open in Explorer', icon: <FolderOpen size={14} />, action: onOpenExplorer },
    { label: 'Open in VS Code', icon: <Code2 size={14} />, action: onOpenVSCode },
    { label: 'Open in Terminal', icon: <Terminal size={14} />, action: onOpenTerminal },
    { divider: true, label: '' },
    { label: 'Recapture Thumbnail', icon: <Camera size={14} />, action: onRecaptureThumbnail },
    { label: 'Run Build', icon: <Hammer size={14} />, action: onRunBuild },
    { divider: true, label: '' },
    { label: 'Copy Path', icon: <Clipboard size={14} />, action: onCopyPath },
    { label: 'Copy Port', icon: <Copy size={14} />, action: onCopyPort },
    { divider: true, label: '' },
    { label: 'Remove from Registry', icon: <Trash2 size={14} />, action: onRemove, danger: true },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[180px] bg-[#1c1c1c] border border-[#333333] rounded-lg p-1 shadow-lg"
      style={{
        left: adjustedX,
        top: adjustedY,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="h-px bg-[#333333] my-1" />
        }

        return (
          <button
            key={index}
            onClick={() => {
              item.action?.()
              onClose()
            }}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded font-sans text-xs transition-all text-left
              ${item.danger 
                ? 'text-[#e02b20] hover:bg-[#e02b20] hover:text-white' 
                : 'text-[#A0A0A0] hover:bg-[#e02b20] hover:text-white'
              }
            `}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
