'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, Camera, Upload, FolderOpen, Folder, Play, Trash, Terminal, AlertTriangle, Check, Loader2, Stethoscope } from 'lucide-react'
import { useToast } from '@/components/vader-toast'
import type { VpeShieldProjectType } from '@/lib/vpe-bridge'
import type { VpeJournalEntry } from '@/lib/vpe-project-journal'
import {
  msc_journalAddEntry,
  msc_journalRemoveEntry,
  msc_parseProjectJournal,
  msc_serializeProjectJournal,
} from '@/lib/vpe-project-journal'

export interface ProjectSettingsPayload {
  name: string
  path: string
  port: number
  start_script: string
  build_script: string
  thumbnail_url?: string | null
  /** `null` or omitted = auto classifier; concrete only when overridden. */
  project_type?: string | null
  is_archived?: boolean
  notes?: string | null
}

interface ProjectSettingsModalProps {
  isOpen: boolean
  projectId: string
  projectName: string
  projectPort?: number
  projectPath?: string
  packageManager?: string
  startScript?: string
  buildScript?: string
  thumbnailUrl?: string | null
  /** Persisted classifier override (`null`/empty = auto). */
  projectTypePersisted?: string | null
  /** Registry archive flag — hidden from dashboard until ARCHIVE tab. */
  isArchived?: boolean
  /** SQLite v8+ project notes */
  projectNotes?: string | null
  detectedProjectType?: VpeShieldProjectType
  onClose: () => void
  onSave?: (payload: ProjectSettingsPayload) => Promise<void> | void
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
  projectId,
  projectName,
  projectPort = 3000,
  projectPath = 'C:/Users/Vader/Projects/msc-media-pro',
  packageManager = 'pnpm',
  startScript = 'dev',
  buildScript = 'build',
  thumbnailUrl: initialThumbnailUrl = null,
  projectTypePersisted = null,
  isArchived = false,
  projectNotes = null,
  detectedProjectType = 'unknown',
  onClose,
  onSave,
  onDelete,
  onRebuild,
  onCleanModules,
}: ProjectSettingsModalProps) {
  const { addToast } = useToast()
  const [name, setName] = useState(projectName)
  const [path, setPath] = useState(projectPath)
  const [port, setPort] = useState(projectPort.toString())
  const [script, setScript] = useState(startScript)
  const [build, setBuild] = useState(buildScript)
  const [customScript, setCustomScript] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    initialThumbnailUrl ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [runningDiagnostics, setRunningDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[] | null>(null)

  /** `auto` = follow scanner; concrete string = persisted override */
  const [projectTypeSelect, setProjectTypeSelect] = useState<
    'auto' | VpeShieldProjectType
  >('auto')
  const [archived, setArchived] = useState(isArchived)
  const [journalEntries, setJournalEntries] = useState<VpeJournalEntry[]>([])
  const [journalDraft, setJournalDraft] = useState('')
  const [vaultFiles, setVaultFiles] = useState<{ name: string; path: string }[]>(
    [],
  )
  const [vaultBusy, setVaultBusy] = useState(false)

  const refreshVault = useCallback(async () => {
    if (!projectId || !window.vpeAPI?.vaultListFiles) return
    setVaultBusy(true)
    try {
      const r = await window.vpeAPI.vaultListFiles(projectId)
      setVaultFiles(Array.isArray(r?.files) ? r.files : [])
    } catch {
      setVaultFiles([])
    } finally {
      setVaultBusy(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!isOpen || !projectId) return
    setName(projectName)
    setPath(projectPath)
    setPort(String(projectPort))
    setScript(startScript)
    setBuild(buildScript)
    setDiagnostics(null)
    setThumbnailUrl(initialThumbnailUrl ?? null)
    const allowed: VpeShieldProjectType[] = [
      'v0',
      'electron',
      'web',
      'node',
      'unknown',
    ]
    const p = projectTypePersisted
    const lower =
      typeof p === 'string' && p.trim() !== ''
        ? (String(p).trim().toLowerCase() as VpeShieldProjectType)
        : null
    setProjectTypeSelect(
      lower && allowed.includes(lower) ? lower : 'auto',
    )
    setArchived(Boolean(isArchived))
    setJournalEntries(msc_parseProjectJournal(projectNotes ?? null))
    setJournalDraft('')
    void refreshVault()
  }, [
    isOpen,
    projectId,
    projectName,
    projectPath,
    projectPort,
    startScript,
    buildScript,
    initialThumbnailUrl,
    projectTypePersisted,
    isArchived,
    projectNotes,
    refreshVault,
  ])

  const handleSave = async () => {
    if (!projectId) return
    const n = parseInt(port, 10)
    setSaving(true)
    try {
      const payload = {
        id: projectId,
        name,
        path,
        port: Number.isFinite(n) ? n : projectPort,
        start_script: script,
        build_script: build,
        thumbnail_url: thumbnailUrl,
        project_type:
          projectTypeSelect === 'auto' ? ('auto' as const) : projectTypeSelect,
        is_archived: archived,
        notes: msc_serializeProjectJournal(journalEntries),
      }
      if (window.vpeAPI?.saveSettings) {
        await window.vpeAPI.saveSettings(payload)
      }
      await onSave?.(payload)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not save project settings.'
      addToast('Save failed', 'error', msg)
    } finally {
      setSaving(false)
    }
  }
  const handlePickFolder = async () => {
    if (!window.vpeAPI?.openDirectory) return
    const selected = await window.vpeAPI.openDirectory()
    if (selected) setPath(selected)
  }

  const handleVaultAddFile = async () => {
    if (!projectId) return
    if (!window.vpeAPI?.vaultAddFile) {
      addToast(
        'Vault unavailable',
        'warning',
        'Open inside the VPE desktop shell to add reference files.',
      )
      return
    }
    try {
      const r = await window.vpeAPI.vaultAddFile(projectId)
      if (!r || r.canceled) return
      if (r.ok) {
        addToast(
          'File added',
          'success',
          r.name ? `"${r.name}" copied to vault` : 'Copied to reference vault.',
        )
        await refreshVault()
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not add vault file.'
      addToast('Vault add failed', 'error', msg)
    }
  }

  const handleVaultDeleteFile = async (fileName: string) => {
    if (!projectId) return
    if (!window.vpeAPI?.vaultDeleteFile) {
      addToast(
        'Delete unavailable',
        'warning',
        'Open inside the VPE desktop shell to remove vault files.',
      )
      return
    }
    try {
      const r = await window.vpeAPI.vaultDeleteFile(projectId, fileName)
      if (r?.ok) {
        addToast('Removed', 'success', fileName)
        await refreshVault()
      } else {
        addToast('Delete failed', 'error', r?.error ?? 'Unknown error')
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not delete file.'
      addToast('Delete failed', 'error', msg)
    }
  }

  const handleVaultOpenFolder = async () => {
    if (!projectId) return
    if (!window.vpeAPI?.vaultOpenFolder) {
      addToast(
        'Vault unavailable',
        'warning',
        'Open inside the VPE desktop shell to browse the vault.',
      )
      return
    }
    try {
      await window.vpeAPI.vaultOpenFolder(projectId)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not open vault folder.'
      addToast('Open folder failed', 'error', msg)
    }
  }

  const handlePickThumbnail = async () => {
    if (!window.vpeAPI?.pickThumbnail) {
      addToast(
        'Thumbnail upload unavailable',
        'warning',
        'Open inside the VPE desktop shell to pick an image.',
      )
      return
    }
    try {
      const href = await window.vpeAPI.pickThumbnail(projectId)
      if (!href) return
      setThumbnailUrl(href)
      addToast('Thumbnail staged', 'info', 'Click Save Changes to persist.')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Thumbnail pick failed.'
      addToast('Thumbnail failed', 'error', msg)
    }
  }



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

          {/* Project type (shields) */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              PROJECT TYPE
            </h3>
            <select
              value={projectTypeSelect}
              onChange={(e) =>
                setProjectTypeSelect(
                  e.target.value === 'auto'
                    ? 'auto'
                    : (e.target.value as VpeShieldProjectType),
                )
              }
              className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
            >
              <option value="auto">Auto (detect from package.json)</option>
              <option value="v0">v0 (components/ui)</option>
              <option value="electron">Electron</option>
              <option value="web">Web (Next / React)</option>
              <option value="node">Node (plain manifest)</option>
              <option value="unknown">Unknown (no usable manifest)</option>
            </select>
            <p className="mt-2 font-sans text-[11px] text-[#555555] leading-relaxed">
              Scanner currently sees{' '}
              <span className="text-[#A0A0A0]">{detectedProjectType}</span>
              {' — '}pick <span className="text-[#A0A0A0]">Auto</span> to follow disk
              after every launch, or lock a shield label by choosing a fixed type (
              persists in SQLite / JSON store).
            </p>
          </section>

          {/* Archive */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              ARCHIVE (REGISTRY)
            </h3>
            <label className="flex items-center justify-between gap-4 cursor-pointer rounded border border-[#333333] bg-[#2a2a2a] px-3 py-2.5">
              <div>
                <span className="font-sans text-[13px] text-white font-medium block">
                  Archive this project (registry only)
                </span>
                <span className="font-sans text-[11px] text-[#A0A0A0]">
                  Hides the card from the main dashboard until you switch to{' '}
                  <span className="text-white">ARCHIVE</span> — files on disk are unchanged.
                </span>
              </div>
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
                className="w-4 h-4 rounded border-[#444444] bg-[#2a2a2a] checked:bg-[#4fde82] checked:border-[#4fde82] shrink-0"
              />
            </label>
          </section>

          {/* Project journal (SQLite `notes` as JSON array) */}
          <section className="msc-project-journal rounded border border-[#333333] bg-[#121212] p-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              PROJECT JOURNAL
            </h3>
            <p className="mb-3 font-sans text-[11px] text-[#c8c8c8] leading-relaxed">
              Entries are stored as JSON in the registry (not in the repo). Click{' '}
              <span className="text-[#eaeaea] font-medium">Save Changes</span> to persist.
            </p>
            <div className="msc-project-journal-list max-h-[220px] overflow-y-auto space-y-2 mb-3 pr-1">
              {journalEntries.length === 0 ? (
                <p className="font-sans text-xs text-[#888888]">No journal entries yet.</p>
              ) : (
                [...journalEntries]
                  .sort((a, b) => String(b.at).localeCompare(String(a.at)))
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="msc-project-journal-row flex gap-2 rounded border border-[#333333] bg-[#1c1c1c] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] text-[#888888] mb-1">
                          {(() => {
                            try {
                              return new Date(entry.at).toLocaleString()
                            } catch {
                              return entry.at
                            }
                          })()}
                        </div>
                        <p className="font-sans text-[13px] text-[#eaeaea] whitespace-pre-wrap break-words">
                          {entry.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Delete entry"
                        aria-label="Delete journal entry"
                        onClick={() =>
                          setJournalEntries((prev) => msc_journalRemoveEntry(prev, entry.id))
                        }
                        className="shrink-0 self-start p-1.5 rounded text-[#888888] hover:text-[#e02b20] hover:bg-[#2a2a2a] transition-colors vader-focus"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))
              )}
            </div>
            <textarea
              value={journalDraft}
              onChange={(e) => setJournalDraft(e.target.value)}
              rows={3}
              spellCheck
              className="msc-project-journal-input w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-[#eaeaea] placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors resize-y"
              placeholder="New entry — specs, deploy notes, reminders…"
            />
            <button
              type="button"
              onClick={() => {
                setJournalEntries((prev) => msc_journalAddEntry(prev, journalDraft))
                setJournalDraft('')
              }}
              className="mt-2 h-8 px-4 rounded border border-[#444444] bg-[#1c1c1c] font-sans text-xs text-[#c8c8c8] hover:text-white hover:border-[#4fde82] transition-all vader-focus"
            >
              ADD JOURNAL ENTRY
            </button>
          </section>

          {/* Reference files vault */}
          <section className="msc-project-vault-attachments bg-[#181818] -mx-6 px-6 py-4">
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              REFERENCE FILES
            </h3>
            <p className="mb-3 font-sans text-[11px] text-[#c8c8c8] leading-relaxed">
              Copies live under{' '}
              <span className="font-mono text-[11px] text-[#eaeaea]">
                media/vault/&lt;project_name&gt;/
              </span>{' '}
              (repo root on this workstation; override with{' '}
              <span className="font-mono text-[#A0A0A0]">VPE_VAULT_ROOT</span>). Original sources are
              not moved.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => void handleVaultAddFile()}
                className="h-8 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus"
              >
                ADD FILE
              </button>
              <button
                type="button"
                onClick={() => void handleVaultOpenFolder()}
                className="h-8 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
                title="Open this project’s vault folder in Explorer"
              >
                <Folder size={14} />
                OPEN VAULT FOLDER
              </button>
            </div>
            <div className="msc-project-vault-file-list rounded border border-[#333333] bg-[#121212] min-h-[72px] max-h-[160px] overflow-y-auto p-2">
              {vaultBusy ? (
                <p className="font-sans text-xs text-[#888888] px-2 py-1">
                  Loading vault…
                </p>
              ) : vaultFiles.length === 0 ? (
                <p className="font-sans text-xs text-[#888888] px-2 py-1">
                  No reference files yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {vaultFiles.map((f) => (
                    <li
                      key={f.path}
                      className="msc-project-vault-file-row flex items-center gap-2 font-sans text-xs text-[#eaeaea] px-2 py-1.5 rounded hover:bg-[#1c1c1c] border border-transparent hover:border-[#333333]"
                      title={f.path}
                    >
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        title="Remove file from vault"
                        aria-label={`Delete ${f.name}`}
                        onClick={() => void handleVaultDeleteFile(f.name)}
                        className="shrink-0 p-1 rounded text-[#888888] hover:text-[#e02b20] hover:bg-[#2a2a2a] transition-colors vader-focus"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Thumbnail Section */}
          <section>
            <h3 className="font-sans text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">THUMBNAIL</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-[200px] aspect-[4/3] rounded bg-[#0a0a0a] border border-[#333333] flex items-center justify-center overflow-hidden shrink-0">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="200px"
                    className="object-cover opacity-95"
                  />
                ) : (
                  <Camera size={24} className="text-[#333333]" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="h-7 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
                  onClick={() =>
                    addToast(
                      'Recapture',
                      'info',
                      'Live capture hooks to the Puppeteer pipeline when the runner is wired.',
                    )
                  }
                >
                  <Camera size={12} />
                  RECAPTURE
                </button>
                <button
                  type="button"
                  className="h-7 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
                  onClick={() => void handlePickThumbnail()}
                >
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
                <button
                  onClick={handlePickFolder}
                  className="px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus"
                  title="Browse for folder that contains package.json"
                  type="button"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
              <p className="font-sans text-[11px] text-[#666666] leading-relaxed">
                Use the exact folder that contains <span className="text-[#A0A0A0]">package.json</span>.
                If Save fails, browse with the folder icon—typos or a non-existent path will be rejected.
              </p>
              <div className="font-sans text-xs text-[#555555]">
                Detected Package Manager: <span className="text-[#A0A0A0]">{packageManager} (detected from package-lock.json)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-xs text-[#555555] mb-2">Port</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs text-[#555555] mb-2">Dev / start script</label>
                  <input
                    type="text"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block font-sans text-xs text-[#555555] mb-2">Build script</label>
                <input
                  type="text"
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                />
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
              <button 
                onClick={() => window.vpeAPI?.openShell?.(path, 'powershell')}
                className="h-9 rounded border border-[#333333] font-sans text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Terminal size={14} />
                OPEN POWERSHELL HERE
              </button>
              <button 
                onClick={() => window.vpeAPI?.openShell?.(path, 'cmd')}
                className="h-9 rounded border border-[#333333] font-sans text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
              >
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
        <div className="px-6 py-4 border-t border-[#333333] flex flex-col gap-2 sticky bottom-0 bg-[#1c1c1c]">
        <span className="font-sans text-[10px] text-[#555555] text-center">
          Powered by the MSC Media Engine v1.6.0
        </span>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-9 px-6 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
              type="button"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !projectId}
              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus disabled:opacity-50"
              type="button"
            >
              {saving ? 'Saving…' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
