'use client'

import { useState } from 'react'
import { X, FolderOpen, Download, Upload, Trash2 } from 'lucide-react'

interface AppSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export function AppSettingsModal({ isOpen, onClose, onSave }: AppSettingsModalProps) {
  const [launchOnStartup, setLaunchOnStartup] = useState(true)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [defaultView, setDefaultView] = useState<'card' | 'list'>('card')
  const [defaultPkgManager, setDefaultPkgManager] = useState('auto')
  const [portRangeStart, setPortRangeStart] = useState(3000)
  const [portRangeEnd, setPortRangeEnd] = useState(3020)
  const [autoStart, setAutoStart] = useState(true)
  const [buildOnAdd, setBuildOnAdd] = useState(false)
  const [autoRepairSuspense, setAutoRepairSuspense] = useState(true)
  const [preBuildChecks, setPreBuildChecks] = useState(true)
  const [logRetention, setLogRetention] = useState('30')
  const [diagnosticPath, setDiagnosticPath] = useState('')
  const [defaultShell, setDefaultShell] = useState('powershell')
  const [fontSize, setFontSize] = useState(13)
  const [scrollbackLines, setScrollbackLines] = useState(1000)

  if (!isOpen) return null

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-5 rounded-full transition-colors
        ${checked ? 'bg-[#4fde82]' : 'bg-[#333333]'}
      `}
    >
      <div className={`
        absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
        ${checked ? 'translate-x-5' : 'translate-x-0.5'}
      `} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal - 4px radius */}
      <div className="relative w-[90vw] max-w-[700px] max-h-[85vh] overflow-y-auto bg-[#1c1c1c] border border-[#333333] rounded">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between sticky top-0 bg-[#1c1c1c] z-10">
          <h2 className="font-sans font-bold text-white text-lg">VPE SETTINGS</h2>
          <button
            onClick={onClose}
            className="p-2 rounded text-[#A0A0A0] hover:text-white transition-colors vader-focus"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* General */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">GENERAL</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Launch on Startup</span>
                  <p className="font-sans text-[11px] text-[#555555]">Start VPE when Windows starts</p>
                </div>
                <Toggle checked={launchOnStartup} onChange={setLaunchOnStartup} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Minimize to Tray</span>
                  <p className="font-sans text-[11px] text-[#555555]">Minimize to system tray instead of closing</p>
                </div>
                <Toggle checked={minimizeToTray} onChange={setMinimizeToTray} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Default View</span>
                </div>
                <select
                  value={defaultView}
                  onChange={(e) => setDefaultView(e.target.value as 'card' | 'list')}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="card">Card View</option>
                  <option value="list">List View</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Theme</span>
                </div>
                <span className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-[#A0A0A0]">
                  Vader Protocol — Active
                </span>
              </div>
            </div>
          </section>

          {/* Build Defaults - Dark grey background */}
          <section className="bg-[#181818] -mx-6 px-6 py-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">BUILD DEFAULTS</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Default Package Manager</span>
                <select
                  value={defaultPkgManager}
                  onChange={(e) => setDefaultPkgManager(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="npm">npm</option>
                  <option value="yarn">yarn</option>
                  <option value="pnpm">pnpm</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Default Port Range</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={portRangeStart}
                    onChange={(e) => setPortRangeStart(parseInt(e.target.value))}
                    className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                  />
                  <span className="text-[#555555]">to</span>
                  <input
                    type="number"
                    value={portRangeEnd}
                    onChange={(e) => setPortRangeEnd(parseInt(e.target.value))}
                    className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Auto-Start Projects</span>
                  <p className="font-sans text-[11px] text-[#555555]">Automatically start previously running projects on launch</p>
                </div>
                <Toggle checked={autoStart} onChange={setAutoStart} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Build on Add</span>
                  <p className="font-sans text-[11px] text-[#555555]">Run install automatically when adding a new project</p>
                </div>
                <Toggle checked={buildOnAdd} onChange={setBuildOnAdd} />
              </div>
            </div>
          </section>

          {/* Repair & Diagnostics */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">REPAIR & DIAGNOSTICS</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Auto-Repair Suspense</span>
                  <p className="font-sans text-[11px] text-[#555555]">Automatically detect and suggest Suspense boundary fixes</p>
                </div>
                <Toggle checked={autoRepairSuspense} onChange={setAutoRepairSuspense} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Pre-Build Checks</span>
                  <p className="font-sans text-[11px] text-[#555555]">Run diagnostics before every build</p>
                </div>
                <Toggle checked={preBuildChecks} onChange={setPreBuildChecks} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Log Retention</span>
                <select
                  value={logRetention}
                  onChange={(e) => setLogRetention(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              <div>
                <span className="font-sans text-sm text-white block mb-2">Diagnostic Script Path</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={diagnosticPath}
                    onChange={(e) => setDiagnosticPath(e.target.value)}
                    placeholder="C:/scripts/custom-diagnostic.ps1"
                    className="flex-1 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82]"
                  />
                  <button className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all">
                    <FolderOpen size={16} />
                  </button>
                  <button className="px-4 py-1.5 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-xs text-black font-medium transition-colors">
                    RUN NOW
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Terminal - Dark grey background */}
          <section className="bg-[#181818] -mx-6 px-6 py-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">TERMINAL</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Default Shell</span>
                <select
                  value={defaultShell}
                  onChange={(e) => setDefaultShell(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="powershell">PowerShell</option>
                  <option value="cmd">Command Prompt</option>
                  <option value="wt">Windows Terminal</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Font Size</span>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  min={10}
                  max={18}
                  className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-white">Scrollback Lines</span>
                <input
                  type="number"
                  value={scrollbackLines}
                  onChange={(e) => setScrollbackLines(parseInt(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                />
              </div>
            </div>
          </section>

          {/* Advanced / Danger Zone */}
          <section className="border-t border-[#333333] pt-6">
            <h3 className="font-sans text-[10px] text-[#e02b20] uppercase tracking-[0.1em] mb-4">ADVANCED / DANGER ZONE</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Registry Location</span>
                  <p className="font-sans text-[11px] text-[#555555]">C:/Users/Vader/.vpe/projects.json</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                  <Download size={14} />
                  EXPORT REGISTRY
                </button>
                <button className="h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                  <Upload size={14} />
                  IMPORT REGISTRY
                </button>
              </div>
              <button className="w-full h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                <Trash2 size={14} />
                CLEAR THUMBNAIL CACHE
              </button>
              <button className="w-full h-9 rounded border border-[#e02b20]/50 font-sans text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus">
                RESET ALL SETTINGS
              </button>
              <p className="font-sans text-[10px] text-[#555555] text-center">
                These actions affect the entire VPE installation.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#333333] flex flex-col items-center gap-3 sticky bottom-0 bg-[#1c1c1c]">
          <div className="w-full flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-9 px-6 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
            >
              CANCEL
            </button>
            <button
              onClick={() => { onSave?.(); onClose(); }}
              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus"
            >
              SAVE SETTINGS
            </button>
          </div>
          <span className="font-sans text-[10px] text-[#555555]">
            VPE v2.0 — Powered by the MSC Media Engine
          </span>
        </div>
      </div>
    </div>
  )
}
