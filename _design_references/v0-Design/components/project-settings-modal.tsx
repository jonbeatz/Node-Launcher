'use client'

import { useState } from 'react'
import { X, Camera, Upload, FolderOpen, Play, Trash, Terminal, AlertTriangle, Check, Loader2, Stethoscope } from 'lucide-react'

interface ProjectSettingsModalProps {
  isOpen: boolean
  projectName: string
  projectPath?: string
  packageManager?: string
  startScript?: string
  onClose: () => void
  onSave?: () => void
  onDelete?: () => void
  onRebuild?: () => void
  onCleanModules?: () => void
}

interface DiagnosticResult {
  label: string
  status: 'ok' | 'warning' | 'error'
  value: string
  action?: string
}

export function ProjectSettingsModal({
  isOpen,
  projectName,
  projectPath = 'C:/Users/Vader/Projects/msc-media-pro',
  packageManager = 'pnpm',
  startScript = 'dev',
  onClose,
  onSave,
  onDelete,
  onRebuild,
  onCleanModules,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(projectName)
  const [path, setPath] = useState(projectPath)
  const [script, setScript] = useState(startScript)
  const [customScript, setCustomScript] = useState('')
  const [runningDiagnostics, setRunningDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[] | null>(null)

  if (!isOpen) return null

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setDiagnostics([
      { label: 'Node.js', status: 'ok', value: 'v20.11.0 detected' },
      { label: 'npm', status: 'ok', value: 'v10.2.4 available' },
      { label: 'Port 3000', status: 'error', value: 'Occupied by PID 48291', action: 'KILL PROCESS' },
      { label: '.next folder', status: 'ok', value: 'Exists (344 files)' },
      { label: 'package.json scripts', status: 'ok', value: 'dev, build, start' },
      { label: 'node_modules', status: 'error', value: 'Missing 3 packages', action: 'RUN INSTALL' },
      { label: '.env file', status: 'ok', value: 'Present' },
      { label: 'Build cache', status: 'warning', value: '14 days old', action: 'CLEAR CACHE' },
    ])
    setRunningDiagnostics(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal - 4px radius */}
      <div className="relative w-[90vw] max-w-[650px] max-h-[85vh] overflow-y-auto bg-[#1c1c1c] border border-[#333333] rounded">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between sticky top-0 bg-[#1c1c1c] z-10">
          <h2 className="font-sans font-bold text-white text-lg">
            PROJECT SETTINGS: <span className="text-[#A0A0A0] font-normal">{name}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded text-[#A0A0A0] hover:text-white transition-colors vader-focus"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Project Name Section */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">PROJECT NAME</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
              placeholder="Enter project name..."
            />
          </section>

          {/* Thumbnail Section */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">THUMBNAIL</h3>
            <div className="flex items-center gap-4">
              <div className="w-[200px] aspect-[4/3] rounded bg-[#0a0a0a] border border-[#333333] flex items-center justify-center">
                <Camera size={24} className="text-[#333333]" />
              </div>
              <div className="flex flex-col gap-2">
                <button className="h-7 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2">
                  <Camera size={12} />
                  RECAPTURE
                </button>
                <button className="h-7 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2">
                  <Upload size={12} />
                  UPLOAD CUSTOM
                </button>
              </div>
            </div>
          </section>

          {/* Path & Detection */}
          <section className="bg-[#181818] -mx-6 px-6 py-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">PATH & DETECTION</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                />
                <button className="px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus">
                  <FolderOpen size={16} />
                </button>
              </div>
              <div className="font-sans text-xs text-[#555555]">
                Detected Package Manager: <span className="text-[#A0A0A0]">{packageManager} (detected from package-lock.json)</span>
              </div>
              <div>
                <label className="block font-sans text-xs text-[#555555] mb-2">Detected Start Script</label>
                <input
                  type="text"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                />
              </div>
              <div className="font-sans text-xs text-[#555555]">
                Last Detected: <span className="text-[#A0A0A0]">2026-05-04 14:22:31</span>
              </div>
            </div>
          </section>

          {/* Build Actions */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">BUILD ACTIONS</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRebuild}
                className="h-8 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-xs text-black font-medium transition-colors vader-focus flex items-center justify-center gap-2"
              >
                <Play size={12} />
                RUN BUILD
              </button>
              <button
                onClick={onRebuild}
                className="h-8 rounded border border-[#4fde82] font-sans text-xs text-[#4fde82] hover:bg-[#4fde82] hover:text-black transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Play size={12} />
                RUN REBUILD
              </button>
              <button
                onClick={onCleanModules}
                className="h-8 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Trash size={12} />
                CLEAN NODE_MODULES
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder="e.g., lint, test, migrate"
                  className="flex-1 px-3 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                />
                <button className="h-8 px-3 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus">
                  EXECUTE
                </button>
              </div>
            </div>
          </section>

          {/* System Diagnostics */}
          <section className="bg-[#181818] -mx-6 px-6 py-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">SYSTEM DIAGNOSTICS</h3>
            <button
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="w-full h-9 rounded bg-[#2a2a2a] border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] disabled:opacity-50 transition-all vader-focus flex items-center justify-center gap-2"
            >
              {runningDiagnostics ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
              RUN DIAGNOSTICS
            </button>
            
            {diagnostics && (
              <div className="mt-3 p-3 rounded bg-[#0a0a0a] border border-[#333333] space-y-2">
                {diagnostics.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 font-sans text-xs">
                    {d.status === 'ok' && <Check size={12} className="text-[#4fde82]" />}
                    {d.status === 'error' && <X size={12} className="text-[#e02b20]" />}
                    {d.status === 'warning' && <AlertTriangle size={12} className="text-[#ffcc00]" />}
                    <span className={
                      d.status === 'ok' ? 'text-[#4fde82]' :
                      d.status === 'error' ? 'text-[#e02b20]' :
                      'text-[#ffcc00]'
                    }>
                      {d.label}: {d.value}
                    </span>
                    {d.action && (
                      <button className="ml-auto px-2 py-0.5 rounded text-[10px] bg-[#1c1c1c] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all">
                        {d.action}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Advanced */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">ADVANCED</h3>
            <div className="flex flex-col gap-2">
              <button className="h-9 rounded border border-[#333333] font-sans text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                <Terminal size={14} />
                OPEN POWERSHELL HERE
              </button>
              <button className="h-9 rounded border border-[#333333] font-sans text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                <Terminal size={14} />
                OPEN COMMAND PROMPT HERE
              </button>
            </div>
            <p className="font-sans text-[10px] text-[#555555] mt-3 text-center">
              Opens a system terminal in this project&apos;s directory for manual commands.
            </p>
          </section>

          {/* Danger Zone */}
          <section className="border-t border-[#333333] pt-6">
            <h3 className="font-sans text-[10px] text-[#e02b20] uppercase tracking-[0.1em] mb-3">DANGER ZONE</h3>
            <button
              onClick={onDelete}
              className="w-full h-9 rounded border border-[#e02b20]/50 font-sans text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus"
            >
              DELETE FROM REGISTRY
            </button>
            <p className="font-sans text-[10px] text-[#555555] mt-2 text-center">
              Removes project from VPE. Does not delete any files from your disk.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#333333] flex items-center justify-end gap-3 sticky bottom-0 bg-[#1c1c1c]">
          <button
            onClick={onClose}
            className="h-9 px-6 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
          >
            CANCEL
          </button>
          <button
            onClick={onSave}
            className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus"
          >
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  )
}
