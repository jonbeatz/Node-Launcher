'use client'

import { useState, useEffect } from 'react'
import { X, FolderOpen, Download, Upload, Trash2 } from 'lucide-react'
import { useToast } from '@/components/vader-toast'
import { getVpeApi, type VpeAppSettings } from '@/lib/vpe-bridge'
import {
  VPE_TERM_FONT_KEY,
  VPE_TERM_SCROLL_KEY,
  msc_emitTerminalPrefsChanged,
} from '@/lib/terminal-prefs'

interface AppSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
  projects?: { id: string; name: string }[]
}

export function AppSettingsModal({
  isOpen,
  onClose,
  onSave,
  projects = [],
}: AppSettingsModalProps) {
  const { addToast } = useToast()
  const [exportProjectId, setExportProjectId] = useState('')
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [dbBusy, setDbBusy] = useState(false)

  const [launchOnStartup, setLaunchOnStartup] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [defaultView, setDefaultView] = useState<'card' | 'list'>('card')
  const [defaultPkgManager, setDefaultPkgManager] = useState('auto')
  const [portRangeStart, setPortRangeStart] = useState(3000)
  const [portRangeEnd, setPortRangeEnd] = useState(3020)
  const [autoStart, setAutoStart] = useState(false)
  const [buildOnAdd, setBuildOnAdd] = useState(false)
  const [autoRepairSuspense, setAutoRepairSuspense] = useState(true)
  const [preBuildChecks, setPreBuildChecks] = useState(true)
  const [logRetention, setLogRetention] = useState('30')
  const [diagnosticPath, setDiagnosticPath] = useState('')
  const [defaultShell, setDefaultShell] = useState('powershell')
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 13
    const n = parseInt(window.localStorage.getItem(VPE_TERM_FONT_KEY) || '13', 10)
    return Number.isFinite(n) ? Math.min(24, Math.max(10, n)) : 13
  })
  const [scrollbackLines, setScrollbackLines] = useState(() => {
    if (typeof window === 'undefined') return 1000
    const n = parseInt(window.localStorage.getItem(VPE_TERM_SCROLL_KEY) || '1000', 10)
    return Number.isFinite(n) ? Math.min(50_000, Math.max(100, n)) : 1000
  })

  const handleTakeSnapshot = async () => {
    const api = getVpeApi()
    if (!api?.takeStateSnapshot) return
    setDbBusy(true)
    try {
      const res = await api.takeStateSnapshot()
      if (res.ok && res.path) {
        addToast('Snapshot saved', 'success', res.path)
      } else if (res.error) {
        addToast('Snapshot failed', 'error', res.error)
      }
    } finally {
      setDbBusy(false)
    }
  }

  const handleRestoreSnapshot = async () => {
    const api = getVpeApi()
    if (!api?.restoreStateSnapshot) return
    setDbBusy(true)
    try {
      const res = await api.restoreStateSnapshot()
      if (res.ok) {
        addToast('Restoring snapshot...', 'info', 'System will relaunch.')
      } else if (res.error) {
        addToast('Restore failed', 'error', res.error)
      }
    } finally {
      setDbBusy(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setClearAllOpen(false)
      return
    }
    if (projects.length > 0) {
      setExportProjectId((prev) =>
        prev && projects.some((p) => p.id === prev) ? prev : projects[0].id,
      )
    }
  }, [isOpen, projects])

  useEffect(() => {
    if (!isOpen) return
    const api = getVpeApi()
    if (!api?.getAppSettings) return
    void api.getAppSettings().then((s: VpeAppSettings) => {
      setLaunchOnStartup(!!s.launch_at_login)
      setMinimizeToTray(!!s.minimize_to_tray)
      setAutoStart(!!s.auto_start_projects)
      setDefaultView(s.default_view === 'list' ? 'list' : 'card')
    })
  }, [isOpen])

  const persistAppSettingsPatch = async (
    patch: Partial<{
      launch_at_login: boolean
      minimize_to_tray: boolean
      auto_start_projects: boolean
      default_view: 'card' | 'list'
    }>,
  ) => {
    const api = getVpeApi()
    if (!api?.updateAppSettings) {
      addToast('Settings unavailable', 'error', 'Run inside Electron with VPE preload.')
      return false
    }
    setDbBusy(true)
    try {
      await api.updateAppSettings(patch)
      addToast('Settings saved', 'success')
      onSave?.()
      return true
    } catch (e) {
      addToast('Save failed', 'error', e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setDbBusy(false)
    }
  }

  const handleLaunchStartupToggle = async (next: boolean) => {
    const prev = launchOnStartup
    setLaunchOnStartup(next)
    const api = getVpeApi()
    if (!api?.updateAppSettings && !api?.updateSettingLaunchStartup) {
      setLaunchOnStartup(prev)
      addToast('Settings unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setDbBusy(true)
    try {
      if (api.updateSettingLaunchStartup) {
        await api.updateSettingLaunchStartup(next)
      } else if (api.updateAppSettings) {
        await api.updateAppSettings({ launch_at_login: next })
      }
      addToast('Settings saved', 'success')
      onSave?.()
    } catch (e) {
      setLaunchOnStartup(prev)
      addToast('Save failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

  const handleMinimizeTrayToggle = async (next: boolean) => {
    const prev = minimizeToTray
    setMinimizeToTray(next)
    const ok = await persistAppSettingsPatch({ minimize_to_tray: next })
    if (!ok) setMinimizeToTray(prev)
  }

  const handleAutoStartToggle = async (next: boolean) => {
    const prev = autoStart
    setAutoStart(next)
    const ok = await persistAppSettingsPatch({ auto_start_projects: next })
    if (!ok) setAutoStart(prev)
  }

  const handleDefaultViewChange = async (next: 'card' | 'list') => {
    const prev = defaultView
    setDefaultView(next)
    const ok = await persistAppSettingsPatch({ default_view: next })
    if (!ok) setDefaultView(prev)
  }

  const handleClose = () => {
    setClearAllOpen(false)
    onClose()
  }

  const handleExportCatalog = async (scope: 'full' | 'single') => {
    const api = getVpeApi()
    if (!api?.catalogExport) {
      addToast('Export unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    if (scope === 'single' && !exportProjectId) {
      addToast('Select a project', 'warning')
      return
    }
    setDbBusy(true)
    try {
      const r = await api.catalogExport({
        scope,
        ...(scope === 'single' ? { projectId: exportProjectId } : {}),
      })
      if (r.canceled) return
      if (r.ok && r.path) addToast('Catalog exported', 'success', r.path)
    } catch (e) {
      addToast('Export failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

  const handleImportCatalog = async (mode: 'merge' | 'replace') => {
    const api = getVpeApi()
    if (!api?.catalogImport) {
      addToast('Import unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setDbBusy(true)
    try {
      const r = await api.catalogImport({ mode })
      if (r.canceled) return
      const skipNote =
        r.errors && r.errors.length > 0
          ? ` ${r.errors.length} row(s) skipped.`
          : ''
      addToast(
        mode === 'replace' ? 'Registry replaced' : 'Catalog merged',
        'success',
        `${r.imported ?? 0} project(s) imported.${skipNote}`,
      )
      if (r.errors?.length) {
        const first = r.errors[0]?.message ?? 'See main log for details'
        addToast('Import skipped some rows', 'warning', first)
      }
    } catch (e) {
      addToast('Import failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

  const handleClearAllConfirmed = async () => {
    const api = getVpeApi()
    if (!api?.clearAllProjects) {
      addToast('Clear all unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setDbBusy(true)
    try {
      await api.clearAllProjects()
      setClearAllOpen(false)
      addToast('All projects removed', 'success')
    } catch (e) {
      addToast('Clear failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

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
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={() => {
          if (!dbBusy) handleClose()
        }}
      />
      
      {/* Modal - 4px radius */}
      <div className="relative w-[90vw] max-w-[700px] max-h-[85vh] overflow-y-auto bg-[#1c1c1c] border border-[#333333] rounded">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between sticky top-0 bg-[#1c1c1c] z-10">
          <h2 className="font-sans font-bold text-white text-lg">VPE SETTINGS</h2>
          <button
            onClick={() => {
              if (!dbBusy) handleClose()
            }}
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
                <Toggle
                  checked={launchOnStartup}
                  onChange={(v) => void handleLaunchStartupToggle(v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Minimize to Tray</span>
                  <p className="font-sans text-[11px] text-[#555555]">Minimize to system tray instead of closing</p>
                </div>
                <Toggle
                  checked={minimizeToTray}
                  onChange={(v) => void handleMinimizeTrayToggle(v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-sm text-white">Default View</span>
                </div>
                <select
                  value={defaultView}
                  onChange={(e) =>
                    void handleDefaultViewChange(e.target.value as 'card' | 'list')
                  }
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
                <Toggle
                  checked={autoStart}
                  onChange={(v) => void handleAutoStartToggle(v)}
                />
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
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10)
                    const v = Number.isFinite(raw) ? Math.min(24, Math.max(10, raw)) : 13
                    setFontSize(v)
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(VPE_TERM_FONT_KEY, String(v))
                      msc_emitTerminalPrefsChanged()
                    }
                  }}
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
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10)
                    const v = Number.isFinite(raw) ? Math.min(50_000, Math.max(100, raw)) : 1000
                    setScrollbackLines(v)
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(VPE_TERM_SCROLL_KEY, String(v))
                      msc_emitTerminalPrefsChanged()
                    }
                  }}
                  min={100}
                  max={20000}
                  className="w-24 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
                />
              </div>
            </div>
          </section>

          {/* Database Actions */}
          <section className="border-t border-[#333333] pt-6">
            <h3 className="font-sans text-[10px] text-[#4fde82] uppercase tracking-[0.1em] mb-2">
              DATABASE & STATE ACTIONS
            </h3>
          <p className="font-sans text-[11px] text-[#555555] mb-4">
            Snapshot management for database and environment state. Powered by the MSC Media Engine v1.4.0
          </p>
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={handleTakeSnapshot}
                  className="h-9 rounded bg-[#252525] border border-[#333333] font-sans text-xs text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  TAKE STATE SNAPSHOT
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={handleRestoreSnapshot}
                  className="h-9 rounded bg-[#252525] border border-[#333333] font-sans text-xs text-white hover:border-[#e02b20] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  RESTORE STATE SNAPSHOT
                </button>
              </div>
            </div>

            <h3 className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
              CATALOG PORTABILITY
            </h3>
            <p className="font-sans text-[11px] text-[#555555] mb-4">
              Backup or restore the project registry (SQLite). Import merge keeps existing IDs; replace wipes the catalog first.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleExportCatalog('full')}
                  className="h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  EXPORT FULL CATALOG
                </button>
                <button
                  type="button"
                  disabled={dbBusy || projects.length === 0}
                  onClick={() => void handleExportCatalog('single')}
                  className="h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  EXPORT ONE PROJECT
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="font-sans text-xs text-white shrink-0">Export target</span>
                <select
                  value={exportProjectId}
                  onChange={(e) => setExportProjectId(e.target.value)}
                  disabled={projects.length === 0 || dbBusy}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82] disabled:opacity-50"
                >
                  {projects.length === 0 ? (
                    <option value="">No projects</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleImportCatalog('merge')}
                  className="h-9 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  IMPORT (MERGE)
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleImportCatalog('replace')}
                  className="h-9 rounded border border-[#e02b20]/45 font-sans text-xs text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  IMPORT (REPLACE ALL)
                </button>
              </div>
              <button
                type="button"
                disabled={dbBusy}
                onClick={() => setClearAllOpen(true)}
                className="w-full h-9 rounded border border-[#e02b20]/50 font-sans text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus disabled:opacity-50"
              >
                CLEAR ALL PROJECTS
              </button>
            </div>
          </section>

          {/* Advanced / Danger Zone */}
          <section className="border-t border-[#333333] pt-6">
            <h3 className="font-sans text-[10px] text-[#e02b20] uppercase tracking-[0.1em] mb-4">ADVANCED / DANGER ZONE</h3>
            <div className="space-y-4">
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
              type="button"
              onClick={() => {
                if (!dbBusy) handleClose()
              }}
              className="h-9 px-6 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => {
                if (dbBusy) return
                void (async () => {
                  const ok = await persistAppSettingsPatch({
                    launch_at_login: launchOnStartup,
                    minimize_to_tray: minimizeToTray,
                    auto_start_projects: autoStart,
                    default_view: defaultView,
                  })
                  if (ok) handleClose()
                })()
              }}
              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus"
            >
              SAVE SETTINGS
            </button>
          </div>
          <span className="font-sans text-[10px] text-[#555555]">
            Powered by the MSC Media Engine v1.4.0
          </span>
        </div>
      </div>
    </div>

    {clearAllOpen ? (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div
          role="presentation"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!dbBusy) setClearAllOpen(false)
          }}
        />
        <div className="relative w-full max-w-md rounded border border-[#333333] bg-[#1c1c1c] shadow-2xl p-6">
          <p className="font-sans text-sm text-white leading-relaxed text-center mb-6">
            Are you absolutely sure you want to delete all projects? This cannot be undone.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              disabled={dbBusy}
              onClick={() => setClearAllOpen(false)}
              className="h-10 px-5 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={dbBusy}
              onClick={() => void handleClearAllConfirmed()}
              className="h-10 px-5 rounded bg-[#e02b20] hover:bg-[#c72418] font-sans text-sm font-medium text-white transition-colors vader-focus disabled:opacity-50"
            >
              Delete all projects
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
