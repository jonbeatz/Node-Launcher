'use client'

import { useState } from 'react'
import { X, AlertTriangle, Flame } from 'lucide-react'

interface NukeModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => void
}

export function NukeModal({ isOpen, projectName, onClose, onConfirm }: NukeModalProps) {
  const [understood, setUnderstood] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setUnderstood(false)
    onClose()
  }

  const handleConfirm = () => {
    setUnderstood(false)
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={handleClose}
      />
      
      {/* Modal - with pulsing red border */}
      <div className="relative w-[420px] bg-[#1c1c1c] border-2 border-[#e02b20] rounded-xl overflow-hidden animate-nuke-pulse">
        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-4 px-6">
          <div className="w-12 h-12 rounded-full bg-[#e02b20]/15 flex items-center justify-center mb-3">
            <Flame size={24} className="text-[#e02b20]" />
          </div>
          <h2 className="font-sans font-bold text-[#e02b20] text-lg text-center">CONFIRM NUKE</h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-5">
          <p className="font-sans text-[13px] text-[#A0A0A0] text-center leading-relaxed">
            This will stop all running processes for <span className="text-white font-medium">{projectName}</span>, 
            permanently delete the <span className="text-[#e02b20]">node_modules</span> and <span className="text-[#e02b20]">.next</span> directories, 
            and perform a full clean install. This action cannot be undone mid-process.
          </p>

          {/* Checkbox */}
          <label className="flex items-center justify-center gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="w-4 h-4 rounded border-[#333333] bg-[#0a0a0a] checked:bg-[#e02b20] checked:border-[#e02b20]"
            />
            <span className="font-sans text-[13px] text-[#A0A0A0]">I understand this is destructive</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-[#333333]">
          <button
            onClick={handleClose}
            className="h-9 px-6 rounded-full border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={!understood}
            className="h-9 px-6 rounded-full bg-[#e02b20] hover:bg-[#c4241b] disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm font-medium text-white transition-colors vader-focus"
          >
            NUKE
          </button>
        </div>
      </div>
    </div>
  )
}
