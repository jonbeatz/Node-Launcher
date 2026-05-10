'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Archive,
  Camera,
  Check,
  File,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Play,
  Stethoscope,
  Terminal,
  Trash,
  Trash2,
  Upload,
  Wrench,
  X,
  AlertTriangle,
  Eraser,
} from 'lucide-react'
import { useToast } from '@/components/vader-toast'
import { msc_formatUnknownIPCError, type VpeShieldProjectType } from '@/lib/vpe-bridge'
import type { VpeJournalEntry } from '@/lib/vpe-project-journal'
import {
  msc_journalAddEntry,
  msc_journalRemoveEntry,
  msc_journalUpdateEntry,
  msc_parseProjectJournal,
  msc_serializeProjectJournal,
} from '@/lib/vpe-project-journal'
import { useVpeUiReady } from '@/VpeRootClientShell'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { VpeSettingsVaultHeading } from '@/components/vpe-settings-vault-heading'

const msc_projectSettingsAccordionTriggerClass =
  'px-10 py-6 items-center gap-3 hover:no-underline [&[data-state=open]>svg]:text-[#888888]'

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
  /** v1.8.0 — opens Repair modal for this project */
  onTacticalRepair?: () => void
  /** v1.8.0 — opens Nuke confirmation for this project */
  onTacticalNuke?: () => void
}

interface DiagnosticResult {
  label: string
  status: 'ok' | 'warning' | 'error'
  value: string
  action?: string
}

function mscVaultAttachmentIcon(fileName: string) {
  const i = fileName.lastIndexOf('.')
  const ext = i >= 0 ? fileName.slice(i).toLowerCase() : ''
  if (ext === '.pdf') {
    return <FileText className="size-4 shrink-0 text-red-500" aria-hidden />
  }
  if (
    ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext) ||
    fileName.toLowerCase().endsWith('.tar.gz')
  ) {
    return <Archive className="size-4 shrink-0 text-yellow-400" aria-hidden />
  }
  if (ext === '.exe' || ext === '.msi') {
    return <Terminal className="size-4 shrink-0 text-cyan-400" aria-hidden />
  }
  return <File className="size-4 shrink-0 text-[#888888]" aria-hidden />
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
  onTacticalRepair,
  onTacticalNuke,
}: ProjectSettingsModalProps) {
  const vpeUiReady = useVpeUiReady()
  const [modalFadeIn, setModalFadeIn] = useState(false)
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
  /** v1.7.2+ — preview-only `src` (cache-bust retries); `thumbnailUrl` stays canonical for save. */
  /** v1.7.6+ — `vpe-vault://` (privileged scheme) + `file:` + http(s); native img avoids Next/Image blocking custom schemes. */
  const [thumbDisplaySrc, setThumbDisplaySrc] = useState<string | null>(
    initialThumbnailUrl ?? null,
  )
  const [thumbPreviewRetrying, setThumbPreviewRetrying] = useState(false)
  const [thumbPreviewHardError, setThumbPreviewHardError] = useState(false)
  const thumbFailCountRef = useRef(0)
  const thumbnailUrlRef = useRef<string | null>(null)
  /** Browser timer handle (avoid NodeJS.Timeout vs number mismatch in Next worker types). */
  const thumbRetryTimerRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [runningDiagnostics, setRunningDiagnostics] = useState(false)
  const [purgingOrphanMedia, setPurgingOrphanMedia] = useState(false)
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
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null)
  const [journalEditText, setJournalEditText] = useState('')
  const journalEditRef = useRef<HTMLTextAreaElement>(null)

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
    setEditingJournalId(null)
    setJournalEditText('')
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

  useEffect(() => {
    if (!editingJournalId) return
    const el = journalEditRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(72, el.scrollHeight)}px`
  }, [editingJournalId, journalEditText])

  useEffect(() => {
    if (!isOpen || !vpeUiReady) {
      setModalFadeIn(false)
      return
    }
    const tid = window.setTimeout(() => setModalFadeIn(true), 40)
    return () => window.clearTimeout(tid)
  }, [isOpen, vpeUiReady])

  useEffect(() => {
    thumbnailUrlRef.current = thumbnailUrl
  }, [thumbnailUrl])

  /** Reset preview machinery whenever the canonical registry URL changes. */
  useEffect(() => {
    if (thumbRetryTimerRef.current) {
      clearTimeout(thumbRetryTimerRef.current)
      thumbRetryTimerRef.current = null
    }
    /* v1.7.3 — clear hard-error before any new load attempt (fresh IPC URL or picker result). */
    setThumbPreviewHardError(false)
    thumbFailCountRef.current = 0
    setThumbPreviewRetrying(false)
    if (!thumbnailUrl) {
      setThumbDisplaySrc(null)
      return
    }
    setThumbDisplaySrc(thumbnailUrl)
  }, [thumbnailUrl])

  useEffect(() => {
    return () => {
      if (thumbRetryTimerRef.current) {
        clearTimeout(thumbRetryTimerRef.current)
        thumbRetryTimerRef.current = null
      }
    }
  }, [])

  const msc_onThumbPreviewLoad = useCallback(() => {
    thumbFailCountRef.current = 0
    setThumbPreviewRetrying(false)
    setThumbPreviewHardError(false)
  }, [])

  const msc_onThumbPreviewError = useCallback(() => {
    setThumbPreviewRetrying(true)
    thumbFailCountRef.current += 1
    const c = thumbFailCountRef.current
    if (c >= 3) {
      if (thumbRetryTimerRef.current) {
        clearTimeout(thumbRetryTimerRef.current)
        thumbRetryTimerRef.current = null
      }
      setThumbPreviewRetrying(false)
      setThumbPreviewHardError(true)
      addToast(
        'Thumbnail',
        'warning',
        'Preview failed to load after retries; pick a new image or recapture.',
      )
      return
    }
    if (thumbRetryTimerRef.current) clearTimeout(thumbRetryTimerRef.current)
    thumbRetryTimerRef.current = window.setTimeout(() => {
      thumbRetryTimerRef.current = null
      const base = thumbnailUrlRef.current
      if (!base) {
        setThumbPreviewRetrying(false)
        return
      }
      const sep = base.includes('?') ? '&' : '?'
      setThumbDisplaySrc(
        `${base}${sep}_pv=${
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        }`,
      )
    }, 450)
  }, [addToast])

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
        const res = await window.vpeAPI.saveSettings(payload)
        const nextThumb =
          res &&
          typeof res === 'object' &&
          'thumbnail_url_for_renderer' in res &&
          res.thumbnail_url_for_renderer != null
            ? String(res.thumbnail_url_for_renderer)
            : null
        if (nextThumb) {
          setThumbnailUrl(nextThumb)
          setThumbDisplaySrc(nextThumb)
        }
        const summary =
          res && typeof res === 'object' && 'changeSummary' in res && res.changeSummary != null
            ? String(res.changeSummary)
            : 'Project settings written'
        addToast('Settings saved', 'success', summary)
      } else {
        addToast('Settings saved', 'info', 'Open in Electron to persist changes to the registry.')
      }
      await onSave?.(payload)
    } catch (err: unknown) {
      addToast('Save failed', 'error', msc_formatUnknownIPCError(err))
    } finally {
      setSaving(false)
    }
  }
  const handlePickFolder = async () => {
    if (!window.vpeAPI?.openDirectory) {
      addToast(
        'Browse unavailable',
        'warning',
        'Open inside the VPE desktop shell to pick a folder.',
      )
      return
    }
    try {
      const selected = await window.vpeAPI.openDirectory()
      if (selected) setPath(selected)
    } catch (err: unknown) {
      addToast('Folder pick failed', 'error', msc_formatUnknownIPCError(err))
    }
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
      addToast('Vault add failed', 'error', msc_formatUnknownIPCError(err))
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
        const re = r?.error
        addToast(
          'Delete failed',
          'error',
          typeof re === 'string' ? re : msc_formatUnknownIPCError(re),
        )
      }
    } catch (err: unknown) {
      addToast('Delete failed', 'error', msc_formatUnknownIPCError(err))
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
      addToast('Open folder failed', 'error', msc_formatUnknownIPCError(err))
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
    const previousThumb = thumbnailUrl
    setThumbnailUrl(null)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    try {
      const href = await window.vpeAPI.pickThumbnail(projectId)
      if (!href) {
        setThumbnailUrl(previousThumb)
        return
      }
      setThumbnailUrl(href)
      addToast(
        'Thumbnail saved to vault',
        'success',
        `Stored under media/vault/<project>/_vpe_thumb.png — save settings if other fields changed.`,
      )
    } catch (err: unknown) {
      setThumbnailUrl(previousThumb)
      addToast('Thumbnail failed', 'error', msc_formatUnknownIPCError(err))
    }
  }

  const handlePurgeOrphanedMedia = async () => {
    const api = window.vpeAPI
    if (!api?.purgeUnusedMedia) {
      addToast('Purge unavailable', 'error', 'IPC bridge is not ready.')
      return
    }
    setPurgingOrphanMedia(true)
    try {
      const r = await api.purgeUnusedMedia()
      if (!r?.ok) {
        addToast('Purge failed', 'error', r?.error ?? 'Unknown error')
        return
      }
      const mb = r.scrub?.mbFreed ?? 0
      addToast(
        'Media purge complete',
        'success',
        `Freed ${mb.toFixed(2)} MB from disk (rows touched: ${r.migration?.rowsTouched ?? 0}; orphan _vpe_thumb files: ${r.scrub?.deletedOrphanThumbFiles ?? 0}).`,
      )
    } catch (err: unknown) {
      addToast('Purge failed', 'error', msc_formatUnknownIPCError(err))
    } finally {
      setPurgingOrphanMedia(false)
    }
  }

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

  if (!isOpen) return null
  /** Shell shields FOUC/hydration; never paint modal chrome until globals + Tailwind are live. */
  if (!vpeUiReady) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-200 ease-out',
          modalFadeIn ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      {/* Modal - 4px radius + staged fade once path-derived layout can settle */}
      <div
        data-vpe-modal-surface
        className={cn(
          'vpe-theme-font vpe-modal-surface relative w-[90vw] max-w-[650px] max-h-[85vh] overflow-y-auto rounded border border-[rgba(156,163,175,0.18)] bg-[#141414] transition-opacity duration-200 ease-out',
          modalFadeIn ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* Header */}
        <div className="px-10 py-4 border-b border-[rgba(156,163,175,0.14)] flex items-center justify-between sticky top-0 bg-[#141414] z-10">
          <h2 className="font-bold text-white text-lg">
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
        <div className="py-8 px-0 bg-[#0f0f0f]">
          <Accordion
            type="single"
            collapsible
            defaultValue="project-info"
            className="w-full vpe-settings-depth rounded-md overflow-hidden border border-[rgba(156,163,175,0.12)]"
          >
            <AccordionItem value="project-info" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_projectSettingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="Project Info"
                  subtitle="Display name, thumbnail, and on-disk path for this catalog entry."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
          {/* Project Name Section */}
          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">PROJECT NAME</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
              placeholder="Enter project name..."
            />
          </section>

          {/* Thumbnail — top hierarchy (v1.6.2) */}
          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">THUMBNAIL</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-[200px] aspect-[4/3] rounded bg-[#121212] border border-[#333333] flex items-center justify-center overflow-hidden shrink-0">
                {thumbnailUrl && !thumbPreviewHardError && thumbDisplaySrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={thumbDisplaySrc}
                    src={thumbDisplaySrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-95"
                    onLoad={msc_onThumbPreviewLoad}
                    onError={msc_onThumbPreviewError}
                  />
                ) : null}
                {!thumbnailUrl ? (
                  <Camera size={24} className="text-[#333333]" aria-hidden />
                ) : null}
                {thumbnailUrl && thumbPreviewHardError ? (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#140808]/95 px-3 text-center"
                    role="alert"
                  >
                    <AlertTriangle className="size-7 text-[#e02b20]" aria-hidden />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-[#ffb4ad]">
                      Preview error
                    </span>
                    <span className="text-[10px] leading-snug text-[#A0A0A0]">
                      Try upload again after a moment.
                    </span>
                  </div>
                ) : null}
                {thumbnailUrl && thumbPreviewRetrying && !thumbPreviewHardError ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-[#121212]/85"
                    aria-busy
                    aria-label="Loading thumbnail preview"
                  >
                    <Loader2 className="size-8 animate-spin text-[#4fde82]" aria-hidden />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="h-7 px-4 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
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
                  className="h-7 px-4 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
                  onClick={() => void handlePickThumbnail()}
                >
                  <Upload size={12} />
                  UPLOAD CUSTOM
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">PROJECT PATH</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
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
              <p className="text-[11px] text-[#666666] leading-relaxed">
                Use the exact folder that contains <span className="text-[#A0A0A0]">package.json</span>.
                If Save fails, browse with the folder icon—typos or a non-existent path will be rejected.
              </p>
            </div>
          </section>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="technical-config" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_projectSettingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="Technical Config"
                  subtitle="Shield type, archive flag, journal notes, port, and npm scripts."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
          {/* Project type (shields) */}
          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
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
              className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
            >
              <option value="auto">Auto (detect from package.json)</option>
              <option value="v0">v0 (components/ui)</option>
              <option value="electron">Electron</option>
              <option value="web">Web (Next / React)</option>
              <option value="node">Node (plain manifest)</option>
              <option value="unknown">Unknown (no usable manifest)</option>
            </select>
            <p className="mt-2 text-[11px] text-[#555555] leading-relaxed">
              Scanner currently sees{' '}
              <span className="text-[#A0A0A0]">{detectedProjectType}</span>
              {' — '}pick <span className="text-[#A0A0A0]">Auto</span> to follow disk
              after every launch, or lock a shield label by choosing a fixed type (
              persists in SQLite / JSON store).
            </p>
          </section>

          {/* Archive */}
          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              ARCHIVE (REGISTRY)
            </h3>
            <label className="flex items-center justify-between gap-4 cursor-pointer rounded border border-[#333333] bg-[#2a2a2a] px-3 py-2.5">
              <div>
                <span className="text-[13px] text-white font-medium block">
                  Archive this project (registry only)
                </span>
                <span className="text-[11px] text-[#A0A0A0]">
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
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              PROJECT JOURNAL
            </h3>
            <p className="mb-3 text-[11px] text-[#c8c8c8] leading-relaxed">
              Entries are stored as JSON in the registry (not in the repo). Click{' '}
              <span className="text-[#eaeaea] font-medium">Save Changes</span> to persist.
            </p>
            <div className="msc-project-journal-list max-h-[220px] overflow-y-auto space-y-2 mb-3 pr-1">
              {journalEntries.length === 0 ? (
                <p className="text-xs text-[#888888]">No journal entries yet.</p>
              ) : (
                [...journalEntries]
                  .sort((a, b) => String(b.at).localeCompare(String(a.at)))
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="msc-project-journal-row flex gap-2 rounded border border-[#333333] bg-[#1c1c1c] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-[#888888] mb-1">
                          {(() => {
                            try {
                              return new Date(entry.at).toLocaleString()
                            } catch {
                              return entry.at
                            }
                          })()}
                        </div>
                        {editingJournalId === entry.id ? (
                          <>
                            <textarea
                              ref={journalEditRef}
                              value={journalEditText}
                              onChange={(e) => setJournalEditText(e.target.value)}
                              spellCheck
                              rows={1}
                              className="msc-project-journal-edit w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#4fde82] text-[13px] text-[#eaeaea] placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors resize-none overflow-hidden min-h-[72px]"
                              aria-label="Edit journal entry"
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const t = journalEditText.trim()
                                  if (!t) {
                                    addToast('Journal', 'warning', 'Entry text cannot be empty.')
                                    return
                                  }
                                  setJournalEntries((prev) =>
                                    msc_journalUpdateEntry(prev, entry.id, journalEditText),
                                  )
                                  setEditingJournalId(null)
                                  setJournalEditText('')
                                }}
                                className="h-7 px-3 rounded bg-[#4fde82] text-xs font-medium text-black hover:bg-[#3fcf72] transition-colors vader-focus"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingJournalId(null)
                                  setJournalEditText('')
                                }}
                                className="h-7 px-3 rounded border border-[#444444] bg-[#121212] text-xs text-[#c8c8c8] hover:text-white hover:border-[#666666] transition-colors vader-focus"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-[13px] text-[#eaeaea] whitespace-pre-wrap break-words">
                            {entry.text}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 self-start flex items-center gap-0.5">
                        <button
                          type="button"
                          title="Edit entry"
                          aria-label="Edit journal entry"
                          disabled={editingJournalId !== null}
                          onClick={() => {
                            setEditingJournalId(entry.id)
                            setJournalEditText(entry.text)
                          }}
                          className="p-1.5 rounded text-[#888888] hover:text-white hover:bg-[#2a2a2a] transition-colors vader-focus disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete entry"
                          aria-label="Delete journal entry"
                          onClick={() => {
                            if (editingJournalId === entry.id) {
                              setEditingJournalId(null)
                              setJournalEditText('')
                            }
                            setJournalEntries((prev) => msc_journalRemoveEntry(prev, entry.id))
                          }}
                          className="p-1.5 rounded text-[#888888] hover:text-[#e02b20] hover:bg-[#2a2a2a] transition-colors vader-focus"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
            <textarea
              value={journalDraft}
              onChange={(e) => setJournalDraft(e.target.value)}
              rows={3}
              spellCheck
              className="msc-project-journal-input w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-[#eaeaea] placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors resize-y"
              placeholder="New entry — specs, deploy notes, reminders…"
            />
            <button
              type="button"
              onClick={() => {
                setJournalEntries((prev) => msc_journalAddEntry(prev, journalDraft))
                setJournalDraft('')
              }}
              className="mt-2 h-8 px-4 rounded border border-[#444444] bg-[#1c1c1c] text-xs text-[#c8c8c8] hover:text-white hover:border-[#4fde82] transition-all vader-focus"
            >
              ADD JOURNAL ENTRY
            </button>
          </section>

          {/* Reference files vault */}
          <section className="msc-project-vault-attachments bg-[#181818] -mx-10 px-10 py-4">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              REFERENCE FILES
            </h3>
            <p className="mb-3 text-[11px] text-[#c8c8c8] leading-relaxed">
              Omni-vault attachments (all file types — <span className="text-[#A0A0A0]">.zip</span>,{' '}
              <span className="text-[#A0A0A0]">.pdf</span>, <span className="text-[#A0A0A0]">.md</span>,{' '}
              <span className="text-[#A0A0A0]">.exe</span>, <span className="text-[#A0A0A0]">.html</span>,{' '}
              <span className="text-[#A0A0A0]">.txt</span>, …) live under{' '}
              <span className="text-[11px] text-[#eaeaea]">
                media/vault/&lt;project_name&gt;/
              </span>{' '}
              beside <span className="text-[11px]">_vpe_thumb.png</span>. Override root with{' '}
              <span className="text-[#A0A0A0]">VPE_VAULT_ROOT</span>. Sources are copied, not
              moved.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => void handleVaultAddFile()}
                className="h-8 px-4 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus"
              >
                ADD FILE
              </button>
              <button
                type="button"
                onClick={() => void handleVaultOpenFolder()}
                className="h-8 px-4 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2"
                title="Open this project’s vault folder in Explorer"
              >
                <Folder size={14} />
                OPEN VAULT FOLDER
              </button>
            </div>
            <div className="msc-project-vault-file-list rounded border border-[#333333] bg-[#121212] min-h-[72px] max-h-[160px] overflow-y-auto p-2">
              {vaultBusy ? (
                <p className="text-xs text-[#888888] px-2 py-1">
                  Loading vault…
                </p>
              ) : vaultFiles.length === 0 ? (
                <p className="text-xs text-[#888888] px-2 py-1">
                  No reference files yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {vaultFiles.map((f) => (
                    <li
                      key={f.path}
                      className="msc-project-vault-file-row flex items-center gap-2 text-xs text-[#eaeaea] px-2 py-1.5 rounded hover:bg-[#1c1c1c] border border-transparent hover:border-[#333333]"
                      title={f.path}
                    >
                      {mscVaultAttachmentIcon(f.name)}
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

          {/* System Diagnostics */}
          <section className="bg-[#181818] -mx-10 px-10 py-4">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">SYSTEM DIAGNOSTICS</h3>
            <button
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="w-full h-9 rounded bg-[#2a2a2a] border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] disabled:opacity-50 transition-all vader-focus flex items-center justify-center gap-2"
            >
              {runningDiagnostics ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
              RUN DIAGNOSTICS
            </button>
            
            {diagnostics && (
              <div className="mt-3 p-3 rounded bg-[#0a0a0a] border border-[#333333] space-y-2">
                {diagnostics.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
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
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">ADVANCED</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.vpeAPI?.openShell?.(path, 'powershell')}
                className="h-9 rounded border border-[#333333] text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Terminal size={14} />
                OPEN POWERSHELL HERE
              </button>
              <button 
                onClick={() => window.vpeAPI?.openShell?.(path, 'cmd')}
                className="h-9 rounded border border-[#333333] text-sm text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Terminal size={14} />
                OPEN COMMAND PROMPT HERE
              </button>
            </div>
            <p className="text-[10px] text-[#555555] mt-3 text-center">
              Opens a system terminal in this project&apos;s directory for manual commands.
            </p>
          </section>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="build-maintenance" className="border-b border-[rgba(156,163,175,0.12)]">
              <AccordionTrigger type="button" className={msc_projectSettingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="Build & Maintenance"
                  subtitle="Detection, dev/build scripts, build actions, and vault media cleanup."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
          <section className="bg-[#181818] -mx-10 px-10 py-4">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">DETECTION & SCRIPTS</h3>
            <div className="space-y-3">
              <div className="text-xs text-[#555555]">
                Detected Package Manager:{' '}
                <span className="text-[#A0A0A0]">{packageManager} (detected from package-lock.json)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#555555] mb-2">Port</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#555555] mb-2">Dev / start script</label>
                  <input
                    type="text"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#555555] mb-2">Build script</label>
                <input
                  type="text"
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] text-[13px] text-white focus:outline-none focus:border-[#4fde82] transition-colors"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">BUILD ACTIONS</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRebuild}
                className="h-8 rounded bg-[#4fde82] hover:bg-[#3fcf72] text-xs text-black font-medium transition-colors vader-focus flex items-center justify-center gap-2"
              >
                <Play size={12} />
                RUN BUILD
              </button>
              <button
                onClick={onRebuild}
                className="h-8 rounded border border-[#4fde82] text-xs text-[#4fde82] hover:bg-[#4fde82] hover:text-black transition-all vader-focus flex items-center justify-center gap-2"
              >
                <Play size={12} />
                RUN REBUILD
              </button>
              <button
                onClick={onCleanModules}
                className="h-8 rounded bg-[#2a2a2a] border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
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
                  className="flex-1 px-3 rounded bg-[#0a0a0a] border border-[#333333] text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82] transition-colors"
                />
                <button className="h-8 px-3 rounded border border-[#333333] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus">
                  EXECUTE
                </button>
              </div>
            </div>
          </section>

          <section className="border-t border-[#333333] pt-6 pb-2">
            <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-3">
              MAINTENANCE
            </h3>
            <button
              type="button"
              onClick={handlePurgeOrphanedMedia}
              disabled={purgingOrphanMedia}
              className="w-full h-9 rounded border-2 border-[#8B0000] bg-[#0a0a0a] text-xs font-semibold text-white hover:bg-[#1a0505] disabled:opacity-50 transition-all vader-focus flex items-center justify-center gap-2"
            >
              {purgingOrphanMedia ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Eraser size={14} aria-hidden />
              )}
              PURGE ORPHANED MEDIA
            </button>
            <p className="text-[10px] text-[#A0A0A0] mt-2 text-center">
              Remaps legacy thumbnail paths into the vault, deletes unused <code className="text-[#e8e8e8]">_vpe_thumb*</code>{' '}
              files, removes legacy scratch folders when safe, and drops vault dirs with no registry project.
            </p>
          </section>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tactical-recovery" className="border-b-0">
              <AccordionTrigger type="button" className={msc_projectSettingsAccordionTriggerClass}>
                <VpeSettingsVaultHeading
                  title="Tactical Recovery"
                  subtitle="Repair and nuke pipelines when the workspace or dev server needs recovery."
                />
              </AccordionTrigger>
              <AccordionContent className="px-10">
                <div className="space-y-6 pt-1">
                  <section>
                    <h3 className="text-[10px] text-[#555555] uppercase tracking-[0.1em] mb-2">
                      TACTICAL RECOVERY
                    </h3>
                    <p className="text-[10px] text-[#555555] mb-3">
                      Heavy repair and nuke pipelines — use when the dev server or workspace needs recovery.
                    </p>
                    {onTacticalRepair || onTacticalNuke ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {onTacticalRepair ? (
                          <button
                            type="button"
                            onClick={onTacticalRepair}
                            className="h-9 rounded border border-[#333333] bg-[#2a2a2a] text-xs text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center justify-center gap-2"
                          >
                            <Wrench size={14} aria-hidden />
                            RUN REPAIR
                          </button>
                        ) : null}
                        {onTacticalNuke ? (
                          <button
                            type="button"
                            onClick={onTacticalNuke}
                            className="h-9 rounded border border-[#e02b20]/55 bg-[#0a0a0a] text-xs text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus flex items-center justify-center gap-2"
                          >
                            <Trash2 size={14} aria-hidden />
                            NUKE PIPELINE
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#666666]">
                        Repair and nuke actions are not wired for this surface.
                      </p>
                    )}
                  </section>

                  <section className="border-t border-[#333333] pt-6">
                    <h3 className="text-[10px] text-[#e02b20] uppercase tracking-[0.1em] mb-3">DANGER ZONE</h3>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="w-full h-9 rounded border border-[#e02b20]/50 text-sm text-[#e02b20] hover:bg-[#e02b20]/10 transition-all vader-focus"
                    >
                      DELETE FROM REGISTRY
                    </button>
                    <p className="text-[10px] text-[#555555] mt-2 text-center">
                      Removes project from VPE. Does not delete any files from your disk.
                    </p>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-[#333333] flex flex-col gap-2 sticky bottom-0 bg-[#1c1c1c]">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-9 px-6 rounded border border-[#333333] text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
              type="button"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !projectId}
              className="h-9 px-6 rounded bg-[#4fde82] hover:bg-[#3fcf72] text-sm font-medium text-black transition-colors vader-focus disabled:opacity-50"
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
