'use client'

import { useState, useEffect, useRef } from 'react'
import { X, FolderOpen, Download, Upload, Trash2, LifeBuoy, Save, Link2 } from 'lucide-react'
import { useToast } from '@/components/vader-toast'
import { getVpeApi, type VpeAppSettings } from '@/lib/vpe-bridge'
import { useVpeUiLayout } from '@/context/vpe-ui-layout-context'
import {
  VPE_TERM_FONT_KEY,
  VPE_TERM_SCROLL_KEY,
  msc_emitTerminalPrefsChanged,
} from '@/lib/terminal-prefs'
import {
  msc_applyVpeFontFamily,
  msc_normalizeFontStyle,
  type VpeFontStyleKey,
} from '@/lib/vpe-font-engine'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { VpeSettingsVaultHeading } from '@/components/vpe-settings-vault-heading'

const msc_settingsAccordionTriggerClass =
  'px-10 py-6 items-center gap-3 hover:no-underline [&[data-state=open]>svg]:text-[#888888]'

function msc_normalizeDefaultViewFromApi(
  v: string | undefined | null,
): VpeAppSettings['default_view'] {
  if (v === 'list' || v === 'compact' || v === 'cinema') return v
  if (v === 'card') return 'cinema'
  return 'cinema'
}

interface AppSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  projects?: { id: string; name: string }[]
}

export function AppSettingsModal({
  isOpen,
  onClose,
  projects = [],
}: AppSettingsModalProps) {
  const { addToast } = useToast()
  const { setViewMode } = useVpeUiLayout()
  const [exportProjectId, setExportProjectId] = useState('')
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [dbBusy, setDbBusy] = useState(false)

  const [launchOnStartup, setLaunchOnStartup] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [defaultView, setDefaultView] =
    useState<VpeAppSettings['default_view']>('cinema')
  const [defaultPkgManager, setDefaultPkgManager] = useState('auto')
  const [portRangeStart, setPortRangeStart] = useState(3000)
  const [portRangeEnd, setPortRangeEnd] = useState(3020)
  const portRangeSavedRef = useRef({ start: 3000, end: 3020 })
  const [fontStyle, setFontStyle] = useState<VpeFontStyleKey>('mulish_studio')
  const [autoStart, setAutoStart] = useState(false)
  const [autoSyncDbOnClose, setAutoSyncDbOnClose] = useState(false)
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

  const handleGenerateSupportBundle = async () => {
    const api = getVpeApi()
    if (!api?.generateSupportBundle) return
    setDbBusy(true)
    try {
      const res = await api.generateSupportBundle()
      if (res.ok && res.path) {
        addToast('Support bundle saved', 'success', res.path)
      } else if (res.error) {
        addToast('Support bundle failed', 'error', res.error)
      }
    } finally {
      setDbBusy(false)
    }
  }

  const handleRepairVaultLinks = async () => {
    const api = getVpeApi()
    if (!api?.repairVaultLinks) return
    setDbBusy(true)
    try {
      const res = await api.repairVaultLinks()
      if (res.ok) {
        const errN = Array.isArray(res.errors) ? res.errors.length : 0
        addToast(
          'Vault links scan complete',
          errN > 0 ? 'error' : 'success',
          `Repaired ${res.repaired}, skipped ${res.skipped}${errN ? `, ${errN} error(s)` : ''}`,
        )
      }
    } catch (e) {
      addToast('Repair vault links failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

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
      setAutoSyncDbOnClose(!!s.auto_sync_db_on_close)
      setDefaultView(msc_normalizeDefaultViewFromApi(s.default_view))
      const fs = msc_normalizeFontStyle(s.font_style)
      setFontStyle(fs)
      msc_applyVpeFontFamily(fs)
      const ps =
        typeof s.port_range_start === 'number' && Number.isFinite(s.port_range_start)
          ? Math.floor(s.port_range_start)
          : 3000
      const pe =
        typeof s.port_range_end === 'number' && Number.isFinite(s.port_range_end)
          ? Math.floor(s.port_range_end)
          : 3020
      setPortRangeStart(ps)
      setPortRangeEnd(pe)
      portRangeSavedRef.current = { start: ps, end: pe }
    })
  }, [isOpen])

  const persistAppSettingsPatch = async (
    patch: Partial<
      Pick<
        VpeAppSettings,
        | 'launch_at_login'
        | 'minimize_to_tray'
        | 'auto_start_projects'
        | 'default_view'
        | 'font_style'
        | 'port_range_start'
        | 'port_range_end'
        | 'auto_sync_db_on_close'
      >
    >,
  ) => {
    const api = getVpeApi()
    if (!api?.updateAppSettings) {
      addToast('Settings unavailable', 'error', 'Run inside Electron with VPE preload.')
      return false
    }
    setDbBusy(true)
    try {
      const res = await api.updateAppSettings(patch)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('vpe:settings-saved'))
      }
      const summary =
        res && typeof res === 'object' && 'changeSummary' in res && res.changeSummary != null
          ? String((res as { changeSummary?: string }).changeSummary)
          : 'Preferences updated'
      addToast('Settings saved', 'success', summary)
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
      let summary = 'Launch preference updated'
      if (api.updateSettingLaunchStartup) {
        const r = await api.updateSettingLaunchStartup(next)
        if (r && typeof r === 'object' && 'changeSummary' in r && r.changeSummary != null) {
          summary = String((r as { changeSummary?: string }).changeSummary)
        }
      } else if (api.updateAppSettings) {
        const r = await api.updateAppSettings({ launch_at_login: next })
        if (r && typeof r === 'object' && 'changeSummary' in r && r.changeSummary != null) {
          summary = String((r as { changeSummary?: string }).changeSummary)
        }
      }
      addToast('Settings saved', 'success', summary)
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

  const handlePortableBackup = async () => {
    const api = getVpeApi()
    if (!api?.backupLocalDb) {
      addToast('Backup unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    setDbBusy(true)
    try {
      const res = await api.backupLocalDb()
      if (res?.ok && res.path) {
        addToast('Database snapshot saved', 'success', res.path)
      } else {
        addToast('Snapshot failed', 'error', res?.error ?? 'Unknown error')
      }
    } catch (e) {
      addToast('Snapshot failed', 'error', e instanceof Error ? e.message : String(e))
    } finally {
      setDbBusy(false)
    }
  }

  const handleAutoSyncDbOnCloseToggle = async (next: boolean) => {
    const prev = autoSyncDbOnClose
    setAutoSyncDbOnClose(next)
    const ok = await persistAppSettingsPatch({ auto_sync_db_on_close: next })
    if (!ok) setAutoSyncDbOnClose(prev)
  }

  const handleAutoStartToggle = async (next: boolean) => {
    const prev = autoStart
    setAutoStart(next)
    const ok = await persistAppSettingsPatch({ auto_start_projects: next })
    if (!ok) setAutoStart(prev)
  }

  const handleDefaultViewChange = async (next: VpeAppSettings['default_view']) => {
    const prev = defaultView
    setDefaultView(next)
    const ok = await persistAppSettingsPatch({ default_view: next })
    if (!ok) setDefaultView(prev)
    else setViewMode(next)
  }

  const persistFontStyleWithToast = async (next: VpeFontStyleKey) => {
    const api = getVpeApi()
    if (!api?.updateAppSettings) return false
    try {
      const res = await api.updateAppSettings({ font_style: next })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('vpe:settings-saved'))
      }
      const summary =
        res && typeof res === 'object' && res.changeSummary != null
          ? String(res.changeSummary)
          : 'Preferences updated'
      addToast('Settings saved', 'success', summary)
      return true
    } catch {
      return false
    }
  }

  const commitPortRangeIfChanged = async () => {
    let s = Math.floor(Number(portRangeStart))
    let e = Math.floor(Number(portRangeEnd))
    if (!Number.isFinite(s)) s = portRangeSavedRef.current.start
    if (!Number.isFinite(e)) e = portRangeSavedRef.current.end
    s = Math.min(65535, Math.max(1024, s))
    e = Math.min(65535, Math.max(1024, e))
    if (e < s) e = s
    if (s === portRangeSavedRef.current.start && e === portRangeSavedRef.current.end) return
    const ok = await persistAppSettingsPatch({ port_range_start: s, port_range_end: e })
    if (ok) portRangeSavedRef.current = { start: s, end: e }
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
        ${checked ? 'bg-[#4f8f68]' : 'bg-[#2a2a2a]'}
      `}
    >
      <div className={`
        absolute top-0.5 w-4 h-4 rounded-full bg-[#e8e8e8] transition-transform
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
      <div
        data-vpe-modal-surface
        className="vpe-theme-font vpe-modal-surface relative w-[90vw] max-w-[700px] max-h-[85vh] overflow-y-auto bg-[#141414] border border-[rgba(156,163,175,0.18)] rounded"
      >
        {/* Header */}
        <div className="px-10 py-4 border-b border-[rgba(156,163,175,0.14)] flex items-center justify-between sticky top-0 bg-[#141414] z-10">
          <h2 className="font-bold text-white text-lg">VPE SETTINGS</h2>
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
        <div className="py-8 px-0 bg-[#0f0f0f]">
          <Accordion
            type="single"
            collapsible
            defaultValue="general"
            className="w-full vpe-settings-depth rounded-md overflow-hidden border border-[rgba(156,163,175,0.12)]"
          >
            <AccordionItem value="general" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_settingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="General"
                  subtitle="Configure startup behavior, tray visibility, and default dashboard view."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-white">Launch on Startup</span>
                      <p className="text-[11px] text-[#555555]">Start VPE when Windows starts</p>
                    </div>
                    <Toggle
                      checked={launchOnStartup}
                      onChange={(v) => void handleLaunchStartupToggle(v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-white">Minimize to Tray</span>
                      <p className="text-[11px] text-[#555555]">Minimize to system tray instead of closing</p>
                    </div>
                    <Toggle
                      checked={minimizeToTray}
                      onChange={(v) => void handleMinimizeTrayToggle(v)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-white">Default View</span>
                    <p className="text-[11px] text-[#555555]">
                      First dashboard layout after launch (Cinema, Compact, or List).
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          { id: 'cinema' as const, label: 'CINEMA' },
                          { id: 'compact' as const, label: 'COMPACT' },
                          { id: 'list' as const, label: 'LIST' },
                        ] as const
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => void handleDefaultViewChange(id)}
                          className={`
                        h-8 min-w-[5.5rem] flex-1 rounded border px-2 text-[11px] font-medium uppercase tracking-wide transition-all vader-focus sm:flex-none
                        ${defaultView === id
                          ? 'border-[#4fde82] bg-[#1a2e22] text-[#4fde82]'
                          : 'border-[#333333] bg-[#0a0a0a] text-[#A0A0A0] hover:border-[#555555] hover:text-white'
                        }
                      `}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ui-theme" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_settingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="UI & Theme"
                  subtitle="Studio theming and font family applied across the shell via CSS variables."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-white">Theme</span>
                    <p className="mt-1 text-[11px] text-[#555555]">
                      Font Style swaps the UI typography instantly via{' '}
                      <span className="text-[#888888]">--vpe-font-family</span>.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <span className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-xs text-[#A0A0A0] text-center sm:text-right">
                      Vader Protocol — Active
                    </span>
                    <label className="flex flex-col gap-1 sm:items-end">
                      <span className="text-[10px] uppercase tracking-wider text-[#555555]">
                        Font Style
                      </span>
                      <select
                        value={fontStyle}
                        onChange={(e) => {
                          const next = msc_normalizeFontStyle(e.target.value) as VpeFontStyleKey
                          const prev = fontStyle
                          setFontStyle(next)
                          msc_applyVpeFontFamily(next)
                          void (async () => {
                            const ok = await persistFontStyleWithToast(next)
                            if (!ok) {
                              setFontStyle(prev)
                              msc_applyVpeFontFamily(prev)
                              addToast('Font', 'error', 'Could not save font preference.')
                            }
                          })()
                        }}
                        className="min-w-[14rem] px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                      >
                        <option value="vpe_classic">VPE Classic (JetBrains / Current)</option>
                        <option value="mulish_studio">Mulish Studio (New Default)</option>
                        <option value="google_sans_modern">Google Sans (Modern)</option>
                        <option value="noto_sans">Noto Sans</option>
                        <option value="poppins">Poppins</option>
                      </select>
                    </label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="system-ports" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_settingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="System & Ports"
                  subtitle="Package defaults, port range, build automations, terminal font, and integrated shell."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
          <section className="bg-[#121212] -mx-10 px-10 py-4 border-y border-[rgba(156,163,175,0.08)]">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">BUILD DEFAULTS</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Default Package Manager</span>
                <select
                  value={defaultPkgManager}
                  onChange={(e) => setDefaultPkgManager(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="npm">npm</option>
                  <option value="yarn">yarn</option>
                  <option value="pnpm">pnpm</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Default Port Range</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={portRangeStart}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      setPortRangeStart(Number.isFinite(n) ? n : 0)
                    }}
                    onBlur={() => void commitPortRangeIfChanged()}
                    className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#9ca3af]"
                  />
                  <span className="text-[#555555]">to</span>
                  <input
                    type="number"
                    value={portRangeEnd}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      setPortRangeEnd(Number.isFinite(n) ? n : 0)
                    }}
                    onBlur={() => void commitPortRangeIfChanged()}
                    className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#9ca3af]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Auto-Start Projects</span>
                  <p className="text-[11px] text-[#555555]">Automatically start previously running projects on launch</p>
                </div>
                <Toggle
                  checked={autoStart}
                  onChange={(v) => void handleAutoStartToggle(v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Build on Add</span>
                  <p className="text-[11px] text-[#555555]">Run install automatically when adding a new project</p>
                </div>
                <Toggle checked={buildOnAdd} onChange={setBuildOnAdd} />
              </div>
            </div>
          </section>

          {/* Repair & Diagnostics */}
          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">REPAIR & DIAGNOSTICS</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Auto-Repair Suspense</span>
                  <p className="text-[11px] text-[#555555]">Automatically detect and suggest Suspense boundary fixes</p>
                </div>
                <Toggle checked={autoRepairSuspense} onChange={setAutoRepairSuspense} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Pre-Build Checks</span>
                  <p className="text-[11px] text-[#555555]">Run diagnostics before every build</p>
                </div>
                <Toggle checked={preBuildChecks} onChange={setPreBuildChecks} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Log Retention</span>
                <select
                  value={logRetention}
                  onChange={(e) => setLogRetention(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              <div>
                <span className="text-sm text-white block mb-2">Diagnostic Script Path</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={diagnosticPath}
                    onChange={(e) => setDiagnosticPath(e.target.value)}
                    placeholder="C:/scripts/custom-diagnostic.ps1"
                    className="flex-1 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82]"
                  />
                  <button className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all">
                    <FolderOpen size={16} />
                  </button>
                  <button className="px-4 py-1.5 rounded bg-[#4fde82] hover:bg-[#3fcf72] text-xs text-black font-medium transition-colors">
                    RUN NOW
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Terminal - Dark grey background */}
          <section className="bg-[#121212] -mx-10 px-10 py-4 border-y border-[rgba(156,163,175,0.08)]">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-4">TERMINAL</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Default Shell</span>
                <select
                  value={defaultShell}
                  onChange={(e) => setDefaultShell(e.target.value)}
                  className="px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                >
                  <option value="powershell">PowerShell</option>
                  <option value="cmd">Command Prompt</option>
                  <option value="wt">Windows Terminal</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Font Size</span>
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
                  className="w-20 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Scrollback Lines</span>
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
                  className="w-24 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82]"
                />
              </div>
            </div>
          </section>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="database-state" className="border-b-0">
              <AccordionTrigger type="button" className={msc_settingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="Database & State Actions"
                  subtitle="Snapshots, catalog export/import, and destructive catalog reset tools."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
          <section className="border-b border-[#333333] pb-6">
            <h3 className="text-[10px] text-[#4fde82] uppercase tracking-[0.1em] mb-2">
              Portable Engine Management
            </h3>
            <p className="text-[11px] text-[#555555] mb-4">
              Lock the live catalog into this folder&apos;s <span className="text-[#888888]">vpe-backups</span> so a
              copied tree carries registry state alongside vault assets.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={dbBusy}
                onClick={() => void handlePortableBackup()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#333333] bg-[#121212] px-4 text-xs font-medium text-white transition-all hover:border-[#4fde82] vader-focus disabled:opacity-50"
              >
                <Save size={16} className="shrink-0 text-[#A0A0A0]" />
                Create Manual DB Snapshot
              </button>
              <div className="flex items-center justify-between gap-4 sm:justify-end sm:min-w-[220px]">
                <div>
                  <span className="text-sm text-white">Auto-Sync on Close</span>
                  <p className="text-[11px] text-[#555555]">Final backup to this folder when VPE exits</p>
                </div>
                <Toggle
                  checked={autoSyncDbOnClose}
                  onChange={(v) => void handleAutoSyncDbOnCloseToggle(v)}
                />
              </div>
            </div>
          </section>

          <section className="border-t border-[#333333] pt-6 sm:border-t-0 sm:pt-0">
            <h3 className="text-[10px] text-[#4fde82] uppercase tracking-[0.1em] mb-2">
              DATABASE & STATE ACTIONS
            </h3>
          <p className="text-[11px] text-[#555555] mb-4">
            Snapshot management for database and environment state.
          </p>
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={handleTakeSnapshot}
                  className="h-9 rounded bg-[#252525] border border-[#333333] text-xs text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  TAKE STATE SNAPSHOT
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={handleRestoreSnapshot}
                  className="h-9 rounded bg-[#252525] border border-[#333333] text-xs text-white hover:border-[#e02b20] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  RESTORE STATE SNAPSHOT
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleGenerateSupportBundle()}
                  title="Save redacted diagnostics (system, last 100 log lines, PM2) to Desktop"
                  className="h-9 rounded bg-[#252525] border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#e02b20] active:border-[#e02b20] active:text-[#e02b20] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2"
                >
                  <LifeBuoy size={14} className="shrink-0" />
                  GENERATE SUPPORT BUNDLE
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleRepairVaultLinks()}
                  title="Rebuild _vpe_thumb.png and fix broken thumbnail rows from images left in each vault folder"
                  className="h-9 rounded bg-[#252525] border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] active:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2"
                >
                  <Link2 size={14} className="shrink-0" />
                  REPAIR VAULT THUMBNAIL LINKS
                </button>
              </div>
            </div>

            <h3 className="text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em] mb-2">
              CATALOG PORTABILITY
            </h3>
            <p className="text-[11px] text-[#555555] mb-4">
              Backup or restore the project registry (SQLite). Import merge keeps existing IDs; replace wipes the catalog first.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleExportCatalog('full')}
                  className="h-9 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  EXPORT FULL CATALOG
                </button>
                <button
                  type="button"
                  disabled={dbBusy || projects.length === 0}
                  onClick={() => void handleExportCatalog('single')}
                  className="h-9 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={14} />
                  EXPORT ONE PROJECT
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs text-white shrink-0">Export target</span>
                <select
                  value={exportProjectId}
                  onChange={(e) => setExportProjectId(e.target.value)}
                  disabled={projects.length === 0 || dbBusy}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded bg-[#0a0a0a] border border-[#333333] text-sm text-white focus:outline-none focus:border-[#4fde82] disabled:opacity-50"
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
                  className="h-9 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  IMPORT (MERGE)
                </button>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={() => void handleImportCatalog('replace')}
                  className="h-9 rounded border border-[#e02b20]/45 text-xs text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload size={14} />
                  IMPORT (REPLACE ALL)
                </button>
              </div>
              <button
                type="button"
                disabled={dbBusy}
                onClick={() => setClearAllOpen(true)}
                className="w-full h-9 rounded border border-[#e02b20]/50 text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus disabled:opacity-50"
              >
                CLEAR ALL PROJECTS
              </button>
            </div>
          </section>

          {/* Advanced / Danger Zone */}
          <section className="border-t border-[#333333] pt-6">
            <h3 className="text-[10px] text-[#e02b20] uppercase tracking-[0.1em] mb-4">ADVANCED / DANGER ZONE</h3>
            <div className="space-y-4">
              <button className="w-full h-9 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2">
                <Trash2 size={14} />
                CLEAR THUMBNAIL CACHE
              </button>
              <button className="w-full h-9 rounded border border-[#e02b20]/50 text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus">
                RESET ALL SETTINGS
              </button>
              <p className="text-[10px] text-[#555555] text-center">
                These actions affect the entire VPE installation.
              </p>
            </div>
          </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-[#333333] flex flex-col items-center gap-3 sticky bottom-0 bg-[#1c1c1c]">
          <div className="w-full flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (!dbBusy) handleClose()
              }}
              className="h-9 px-6 rounded border border-[#333333] text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
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
                    font_style: fontStyle,
                  })
                  if (ok) {
                    setViewMode(defaultView)
                    handleClose()
                  }
                })()
              }}
              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] text-sm font-medium text-black transition-colors vader-focus"
            >
              SAVE SETTINGS
            </button>
          </div>
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
          <p className="text-sm text-white leading-relaxed text-center mb-6">
            Are you absolutely sure you want to delete all projects? This cannot be undone.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              disabled={dbBusy}
              onClick={() => setClearAllOpen(false)}
              className="h-10 px-5 rounded border border-[#333333] text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={dbBusy}
              onClick={() => void handleClearAllConfirmed()}
              className="h-10 px-5 rounded bg-[#e02b20] hover:bg-[#c72418] text-sm font-medium text-white transition-colors vader-focus disabled:opacity-50"
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
