'use client'

import { AlertTriangle } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => void
}

export function DeleteConfirmModal({ isOpen, projectName, onClose, onConfirm }: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-[400px] bg-[#1c1c1c] border border-[#333333] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-4 px-6">
          <div className="w-12 h-12 rounded-full bg-[#e02b20]/15 flex items-center justify-center mb-3">
            <AlertTriangle size={24} className="text-[#e02b20]" />
          </div>
          <h2 className="font-sans font-bold text-white text-base text-center">REMOVE FROM REGISTRY</h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-5">
          <p className="font-sans text-[13px] text-[#A0A0A0] text-center leading-relaxed">
            Remove <span className="text-white font-medium">{projectName}</span> from VPE? 
            This will not delete any project files from your disk. 
            You can re-add this project later by scanning the directory again.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-[#333333]">
          <button
            onClick={onClose}
            className="h-9 px-6 rounded-full border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-6 rounded-full bg-[#e02b20] hover:bg-[#c4241b] font-sans text-sm font-medium text-white transition-colors vader-focus"
          >
            REMOVE
          </button>
        </div>
      </div>
    </div>
  )
}
