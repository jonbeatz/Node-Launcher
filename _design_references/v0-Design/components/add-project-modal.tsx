'use client'

import { useState } from 'react'
import { X, FolderSearch, Package, Check, Loader2, FolderOpen } from 'lucide-react'

interface AddProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: ProjectData) => void
}

interface ProjectData {
  name: string
  path: string
  packageManager: 'npm' | 'pnpm' | 'yarn' | null
  startScript: string
  port: string
  portLock: boolean
}

export function AddProjectModal({ isOpen, onClose, onSubmit }: AddProjectModalProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    path: '',
    packageManager: null,
    startScript: 'dev',
    port: '3000',
    portLock: false,
  })

  if (!isOpen) return null

  const handleScanDirectory = async () => {
    setIsScanning(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setProjectData({
      name: 'NEW_PROJECT_NODE',
      path: 'C:/Users/Vader/Projects/new-project',
      packageManager: 'pnpm',
      startScript: 'dev',
      port: '3000',
      portLock: false,
    })
    setScanned(true)
    setIsScanning(false)
  }

  const handleSubmit = () => {
    onSubmit?.(projectData)
    onClose()
    setScanned(false)
    setProjectData({
      name: '',
      path: '',
      packageManager: null,
      startScript: 'dev',
      port: '3000',
      portLock: false,
    })
  }

  const packageManagers = [
    { id: 'npm', label: 'npm' },
    { id: 'pnpm', label: 'pnpm' },
    { id: 'yarn', label: 'yarn' },
  ] as const

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal - 4px radius */}
      <div className="relative w-[90vw] max-w-[600px] max-h-[85vh] overflow-y-auto bg-[#1c1c1c] border border-[#333333] rounded">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#333333]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans font-bold text-white text-lg">ADD NEW PROJECT</h2>
              <p className="font-sans text-[13px] text-[#A0A0A0] mt-1">
                Point VPE to a Node.js or Next.js project directory.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded text-[#A0A0A0] hover:text-white transition-colors vader-focus"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Scan Directory Button - VPE Green with 4px radius */}
          <button
            onClick={handleScanDirectory}
            disabled={isScanning}
            className="w-full h-10 rounded bg-[#4fde82] hover:bg-[#3fcf72] disabled:opacity-50 font-sans text-sm font-medium text-black transition-all vader-focus flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <FolderSearch size={16} />
                <span>SCAN DIRECTORY</span>
              </>
            )}
          </button>

          {/* Auto-Detected Fields */}
          {scanned && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Detection Status */}
              <div className="flex items-center gap-2 text-[11px]">
                <Check size={14} className="text-[#00cc66]" />
                <span className="font-sans text-[#00cc66]">
                  package.json detected, Next.js project identified
                </span>
              </div>

              {/* Project Name */}
              <div>
                <label className="block font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                />
              </div>

              {/* Project Path */}
              <div>
                <label className="block font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
                  Project Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={projectData.path}
                    onChange={(e) => setProjectData({ ...projectData, path: e.target.value })}
                    className="flex-1 px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                  <button className="px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus">
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              {/* Package Manager */}
              <div>
                <label className="block font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
                  Package Manager
                </label>
                <div className="flex gap-2">
                  {packageManagers.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setProjectData({ ...projectData, packageManager: pm.id })}
                      className={`
                        flex-1 py-2 px-3 rounded font-sans text-[13px] transition-all duration-200 vader-focus flex items-center justify-center gap-2
                        ${projectData.packageManager === pm.id
                          ? 'bg-[#4fde82] text-black'
                          : 'bg-[#0a0a0a] text-[#A0A0A0] border border-[#333333] hover:border-[#4fde82] hover:text-white'
                        }
                      `}
                    >
                      <Package size={14} />
                      <span>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Script */}
              <div>
                <label className="block font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
                  Start Script
                </label>
                <input
                  type="text"
                  value={projectData.startScript}
                  onChange={(e) => setProjectData({ ...projectData, startScript: e.target.value })}
                  placeholder="dev"
                  className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                />
              </div>

              {/* Port */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
                    Default Port
                  </label>
                  <input
                    type="number"
                    value={projectData.port}
                    onChange={(e) => setProjectData({ ...projectData, port: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projectData.portLock}
                      onChange={(e) => setProjectData({ ...projectData, portLock: e.target.checked })}
                      className="w-4 h-4 rounded border-[#333333] bg-[#0a0a0a] checked:bg-[#4fde82] checked:border-[#4fde82]"
                    />
                    <span className="font-sans text-[13px] text-[#A0A0A0]">Lock to this port</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#333333] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="h-9 px-6 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!projectData.name || !projectData.path || !projectData.packageManager}
            className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm font-medium text-black transition-colors vader-focus"
          >
            ADD PROJECT
          </button>
        </div>
      </div>
    </div>
  )
}
