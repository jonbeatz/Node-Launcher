/** SQLite / IPC row from main process */

import type { VpeProjectRow, VpeShieldProjectType } from '@/types/vpe-ipc'

export type {
  Project,
  VpeHasDocumentation,
  VpeProjectRow,
  VpeShieldProjectType,
} from '@/types/vpe-ipc'

export interface VpeUnifiedLogRow {
  project_id: string
  timestamp: string
  level: string
  message: string
}

export interface VpeLogRow {
  id: number
  project_id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface VpeLogPayload {
  projectId: string
  timestamp: string
  level: string
  message: string
}

export interface SaveSettingsPayload {
  id: string
  name: string
  path: string
  port: number
  start_script?: string
  build_script?: string
  thumbnail_url?: string | null
  /** `auto` clears override → classifier decides from disk each session. */
  project_type?: 'auto' | VpeShieldProjectType | string | null
  is_archived?: boolean
  notes?: string | null
}

export interface AddProjectPayload {
  id?: string
  name: string
  path: string
  port?: number
  thumbnail_url?: string | null
  /** Omit or `auto` → classifier; concrete value persisted in registry. */
  project_type?: 'auto' | VpeShieldProjectType | string | null
}

/**
 * Live host + VPE metrics from `vpe:get-system-stats`.
 * IPC payload is plain JSON (numbers/strings only); `cpu === -1` means unavailable (first CPU poll).
 */
export interface VpeSystemStats {
  cpu: number
  memory: {
    total: number
    free: number
    used: number
    percentage: number
  }
  pm2: {
    status: string
    activeCount: number
  }
  uptime: {
    seconds: number
    label: string
  }
  projects: {
    active: number
    total: number
  }
}

export type VpeRepairRunStatus = 'success' | 'partial' | 'failed'

export interface VpeRepairRunRow {
  id: string
  project_id: string
  project_name?: string | null
  created_at: string
  status: VpeRepairRunStatus
  description: string
  files_changed: number
}

export interface RecordRepairRunPayload {
  projectId: string
  projectName?: string
  description: string
  filesChanged: number
  status?: VpeRepairRunStatus
}

export interface CatalogImportResult {
  ok: boolean
  canceled?: boolean
  imported?: number
  errors?: { id?: string; message: string }[]
}

export interface VpeLauncherPortHealth {
  p3000: boolean
  p3001: boolean
  /** CDP / remote debugging listener (e.g. `--remote-debugging-port=9222`). */
  p9222: boolean
  /** No foreign process on either port (node/electron-only or free). */
  ok: boolean
  /** Both 3000 and 3001 have no TCP listener — safe to run pre-forge / packaging. */
  forgeReady: boolean
}

export interface VpePurgeLauncherPortsResult {
  ok: boolean
  killed?: { pid: string; port: number; img: string }[]
  p3000?: boolean
  p3001?: boolean
  p9222?: boolean
  healthy?: boolean
  forgeReady?: boolean
}

/** v1.6.0 — Prompt Vault row categorization (UI badges: CMD / DIR / SNP). */
export type VpePromptVaultEntryType = 'Command' | 'Directive' | 'Snippet'

export interface VpePromptVaultItem {
  id: string
  title: string
  /** e.g. "Vader Protocol v1.0.8" */
  versionLabel: string
  /** Optional subtitle shown in expanded accordion / edit modal */
  description?: string
  bodyMd: string
  updatedAt: string
  /** Defaults to Directive when absent (legacy rows). */
  type?: VpePromptVaultEntryType
}

export interface VpeUpdateVaultItemPayload {
  id: string
  title?: string
  versionLabel?: string
  description?: string
  bodyMd?: string
  type?: VpePromptVaultEntryType | null
}

export interface VpePromptVaultData {
  v: number
  items: VpePromptVaultItem[]
}

export interface CatalogExportResult {
  ok: boolean
  canceled?: boolean
  path?: string
}

/** v1.3.2+ — main ghost watcher heartbeat (`vpe:ghost-detected` / cleared). */
export interface VpeGhostPresenceEvent {
  active: boolean
  ports?: number[]
  at?: number
}

/** App-level settings from `vpe:get-app-settings` (SQLite `settings` row). */
export interface VpeAppSettings {
  launch_at_login: boolean
  minimize_to_tray: boolean
  auto_start_projects: boolean
  /** `cinema` | `compact` | `list` (legacy `card` normalized in main to `cinema`). */
  default_view: 'cinema' | 'compact' | 'list'
  theme_accent?: string
  /** v1.7.9 — drives `--vpe-font-family` in the renderer */
  font_style?:
    | 'vpe_classic'
    | 'mulish_studio'
    | 'google_sans_modern'
    | 'noto_sans'
    | 'poppins'
  /** v1.8.5 — inclusive managed-port window hint (persisted). */
  port_range_start?: number
  port_range_end?: number
  /** v2.1.x — write portable DB snapshot under `process.cwd()/vpe-backups` on app quit. */
  auto_sync_db_on_close?: boolean
}

export interface VpeApi {
  getProjects: () => Promise<VpeProjectRow[]>
  getRepairRuns?: (limit?: number) => Promise<VpeRepairRunRow[]>
  recordRepairRun?: (
    payload: RecordRepairRunPayload,
  ) => Promise<{ ok?: boolean; id?: string }>
  getSystemStats?: () => Promise<VpeSystemStats>
  getLogs: (projectId: string) => Promise<VpeLogRow[]>
  inspectProject: (projectPath: string) => Promise<{
    ok?: boolean
    path: string
    detection: {
      pkg_manager: 'npm' | 'pnpm' | 'yarn'
      start_script: string
      build_script: string
    }
    project_type?: VpeShieldProjectType
    suggestedPort: number
    reservedPort: number
  }>
  toggleStatus: (
    projectId: string,
  ) => Promise<{
    ok?: boolean
    status?: string
    /** v1.2.3 — auto `npm install && dev`; UI shows installing until bootstrap signal. */
    installing?: boolean
    projectKind?: 'v0-prototype'
  }>
  /** Fires when install+dev pipeline appears to reach the dev server (or clear installing UI). */
  subscribeBootstrapDevVisible?: (
    cb: (payload: { projectId: string }) => void,
  ) => () => void
  subscribeGhostPresence?: (
    cb: (payload: VpeGhostPresenceEvent) => void,
  ) => () => void
  /** PM2 stop-all + runner kill-all + SQLite all stopped */
  stopAllProjects?: () => Promise<{ ok?: boolean; error?: string }>
  /** Save full catalog or one project as JSON (native save dialog). */
  catalogExport?: (opts: {
    scope: 'full' | 'single'
    projectId?: string
  }) => Promise<CatalogExportResult>
  /** Load catalog from JSON (native open dialog). `replace` wipes DB first. */
  catalogImport?: (opts: {
    mode: 'merge' | 'replace'
  }) => Promise<CatalogImportResult>
  /** Stop all engines and wipe every project row (+ logs / repair history). */
  clearAllProjects?: () => Promise<{ ok?: boolean }>
  runBuild: (projectId: string) => Promise<{ ok?: boolean }>
  nukeProject: (projectId: string) => Promise<{ ok?: boolean; id?: string }>
  saveSettings: (payload: SaveSettingsPayload) => Promise<{
    ok?: boolean
    detection?: unknown
    /** v1.7.8 — pulsed `vpe-vault://…?pulse=` (or external URL) for instant preview refresh */
    thumbnail_url_for_renderer?: string | null
    /** v1.8.4 — human-readable diff for contextual save toasts */
    changeSummary?: string
  }>
  getAppSettings?: () => Promise<VpeAppSettings>
  updateAppSettings?: (
    payload: Partial<VpeAppSettings>,
  ) => Promise<{ ok?: boolean; settings?: VpeAppSettings; changeSummary?: string }>
  updateSettingLaunchStartup?: (
    value: boolean,
  ) => Promise<{ ok?: boolean; settings?: VpeAppSettings; changeSummary?: string }>
  addProject: (payload: AddProjectPayload) => Promise<{ ok?: boolean; id?: string }>
  deleteProject: (
    projectId: string,
  ) => Promise<{ ok?: boolean; success?: boolean; filesPurged?: boolean }>
  /** Reassign port + refresh detected scripts/package manager after preflight failure. */
  autoFixProjectPort: (
    projectId: string,
  ) => Promise<{ ok?: boolean; port: number; start_script?: string }>
  /** Recovery: regenerate vault `_vpe_thumb.png` + fix broken `file:` thumbnail rows from images in each vault. */
  repairVaultLinks?: () => Promise<{
    ok: boolean
    repaired: number
    skipped: number
    errors: { id: string; message: string }[]
  }>
  openDirectory: () => Promise<string | null>
  vaultAddFile?: (
    projectId: string,
  ) => Promise<{
    ok: boolean
    canceled?: boolean
    dest?: string
    name?: string
    error?: string
  }>
  vaultListFiles?: (
    projectId: string,
  ) => Promise<{
    ok: boolean
    dir?: string
    files?: { name: string; path: string }[]
    error?: string
  }>
  vaultOpenFolder?: (
    projectId: string,
  ) => Promise<{ ok: boolean; dir?: string; error?: string }>
  /** v1.6.0 — remove one file from project vault on disk (basename only). */
  vaultDeleteFile?: (
    projectId: string,
    fileName: string,
  ) => Promise<{ ok: boolean; error?: string }>
  /** Main registers `vpe:e2e-vault-copy-from-path` only when `VPE_E2E=1` (Playwright). */
  e2eVaultCopyFromPath?: (
    projectId: string,
    absoluteSourcePath: string,
  ) => Promise<{ ok: boolean; dest?: string; name?: string }>
  pickThumbnail: (
    projectId: string,
    draftDisplayName?: string | null,
  ) => Promise<string | null>
  openProjectUrl: (url: string) => Promise<{ ok?: boolean }>
  /** Listen for live stdout/stderr / engine lines (main → renderer). */
  subscribeLogUpdate: (
    callback: (data: VpeLogPayload) => void,
  ) => () => void
  subscribeProjectsUpdated: (
    callback: (data: { projects: VpeProjectRow[] }) => void,
  ) => () => void
  getUnifiedLogs?: (limit?: number) => Promise<VpeUnifiedLogRow[]>
  patchStartScript?: (
    projectId: string,
  ) => Promise<{
    ok?: boolean
    previous?: string
    next?: string
    backupPath?: string
    scriptName?: string
  }>
  takeStateSnapshot?: () => Promise<{ ok: boolean; path?: string; error?: string }>
  /** Portable vault: copy active catalog DB into `vpe-backups` under repo / portable root. */
  backupLocalDb?: () => Promise<{ ok: boolean; path?: string; error?: string }>
  /** Manual registry order: swap `sort_order` with neighbor, optional portable auto-sync. */
  reorderProject?: (
    projectId: string,
    direction: 'up' | 'down',
  ) => Promise<{ ok: boolean; error?: string }>
  restoreStateSnapshot?: () => Promise<{ ok: boolean; error?: string }>
  executeTerminalCommand?: (command: string, activeProjectId?: string) => Promise<{ ok: boolean; output: string }>
  openExplorer?: (folderPath: string) => Promise<{ ok: boolean; error?: string }>
  /** Windows: spawn Cursor with project folder as argv. */
  openCursor?: (projectPath: string) => Promise<{ ok: boolean; error?: string }>
  openShell?: (path: string, type: 'powershell' | 'cmd') => Promise<{ ok: boolean; error?: string }>
  killProcessOnPort?: (port: number) => Promise<{ ok: boolean; message: string }>
  setProjectFavorite?: (projectId: string, isFavorite: boolean) => Promise<{ ok: boolean }>
  clearRepairHistory?: () => Promise<{ ok: boolean }>
  deleteRepairRun?: (repairId: string) => Promise<{ ok: boolean }>
  getLauncherPortHealth?: () => Promise<VpeLauncherPortHealth>
  purgeLauncherPorts?: () => Promise<VpePurgeLauncherPortsResult>
  scorchedEarth?: () => Promise<{
    ok: boolean
    skipped?: string
    /** `soft_dev` — dev: no taskkill; `full` — packaged Windows scorched earth */
    mode?: string
    log?: string[]
    error?: string
  }>
  /** v1.6.7 — migrate legacy thumbnail paths + hard scrub vault / legacy `media/thumbnails`. */
  purgeUnusedMedia?: () => Promise<{
    ok: boolean
    error?: string
    migration?: { migratedLegacy: number; nulledMissingVault: number; rowsTouched: number }
    scrub?: {
      deletedOrphanThumbFiles: number
      legacyThumbnailDirsRemoved: number
      orphanVaultDirsRemoved: number
      /** Dirs under vault root with no matching DB project (not deleted). */
      orphanVaultDirsDetected?: number
      /** Legacy thumbnail dirs that could be removed manually (not auto-deleted). */
      legacyThumbnailDirsEligible?: number
      legacyScratchRemoved: boolean
      bytesFreed: number
      mbFreed: number
    }
    vaultSync?: {
      foldersCreated: string[]
      keepFilesWritten: string[]
      projectsSynced: number
    }
  }>
  /** v2.0.0 — redacted JSON diagnostic file on Desktop */
  generateSupportBundle?: () => Promise<{
    ok: boolean
    path?: string
    error?: string
  }>
  runForgeDiagnostics?: () => Promise<{
    ok: boolean
    checks: { id: string; ok: boolean; detail?: string }[]
  }>
  promptVaultRead?: () => Promise<{ ok: boolean; data?: VpePromptVaultData; error?: string }>
  promptVaultWrite?: (data: VpePromptVaultData) => Promise<{ ok: boolean }>
  updateVaultItem?: (
    payload: VpeUpdateVaultItemPayload,
  ) => Promise<{ ok: boolean; item?: VpePromptVaultItem }>
  /** LOGIC_MOD_02 — project root `.env` (registered path only). */
  readProjectDotEnv?: (
    projectId: string,
  ) => Promise<{
    ok: boolean
    content?: string
    missingFile?: boolean
    path?: string
    error?: string
  }>
  writeProjectDotEnv?: (payload: {
    projectId: string
    content: string
  }) => Promise<{ ok: boolean; path?: string; error?: string }>
  subscribeRepairRunsChanged?: (callback: () => void) => () => void
}

declare global {
  interface Window {
    vpeAPI?: VpeApi
  }
}

export function getVpeApi(): VpeApi | null {
  if (typeof window === 'undefined') return null
  return window.vpeAPI ?? null
}

/** Registry / vault enumeration can stall on huge D:-drive vaults — cap wait via renderer-side race (main handler remains unchanged). */
export const VPE_GET_PROJECTS_TIMEOUT_MS = 60_000

/** Race IPC promise against a deadline; clears timer when settle wins. */
export async function msc_withIpcTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      tid = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
      }, ms)
    })
    return await Promise.race([promise, timeout])
  } finally {
    if (tid !== undefined) clearTimeout(tid)
  }
}

/** v1.2.1 — safe message for terminals / toasts when IPC rejects with a DOM Event or other non-Error. */
export function msc_formatUnknownIPCError(reason: unknown): string {
  if (reason == null) return 'Unknown failure'
  if (typeof reason === 'string') {
    if (reason === '[object Event]') return 'IPC/Event-style failure ([object Event])'
    return reason
  }
  if (typeof reason !== 'object') return String(reason)
  if (reason instanceof Error) return reason.message || reason.name || '[Error]'
  const o = reason as Record<string, unknown> & { constructor?: { name?: string } }
  if (typeof o.message === 'string' && o.message.trim()) return o.message
  if (typeof Event !== 'undefined' && reason instanceof Event) {
    const t = typeof o.type === 'string' ? o.type : 'unknown'
    const m = typeof o.message === 'string' ? o.message : ''
    return m ? `DOM Event (${t}): ${m}` : `DOM Event (${t})`
  }
  if (typeof o.type === 'string') {
    try {
      const s = JSON.stringify(o)
      if (s && s !== '{}') return s
      return `Event-like (${o.type})`
    } catch {
      return `Event-like (${o.type})`
    }
  }
  try {
    const s = JSON.stringify(o)
    if (s && s !== '{}') return s
  } catch {
    /* fall through */
  }
  const n = o.constructor?.name
  return n ? `[${n}]` : '[unserializable]'
}

/** SQLite / IPC: integer booleans + loose `'0'` from legacy paths; default on when null/undefined. */
export function msc_rowHasDocumentationEnabled(v: unknown): boolean {
  if (v === null || typeof v === 'undefined') return true
  if (v === false || v === 0 || v === '0') return false
  const n = Number(v)
  return !(Number.isFinite(n) && n === 0)
}

export function msc_rowToDashboardProject(row: VpeProjectRow): {
  id: string
  name: string
  port: number
  uptime: string
  dev_session_started_at: string | null
  status: 'running' | 'stopped' | 'error' | 'building'
  cpu: number
  ram: string
  pkgManager: 'npm' | 'yarn' | 'pnpm'
  path: string
  thumbnail_url?: string | null
  start_script: string
  build_script: string
  health_http_code?: number | null
  health_checked_at?: string | null
  health_reachable?: boolean | null
  is_favorite?: boolean | null
  node_modules_missing?: boolean
  project_type?: string | null
  detected_project_type?: VpeShieldProjectType
  shield_project_type?: VpeShieldProjectType
  is_archived?: boolean
  notes?: string | null
  vault_has_files?: boolean
  /** Registry flag: paperclip requires this on (default true) plus vault reference files. */
  has_documentation?: boolean
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
} {
  const pm =
    row.pkg_manager === 'yarn' || row.pkg_manager === 'pnpm'
      ? row.pkg_manager
      : 'npm'
  const st: 'running' | 'stopped' =
    row.status === 'running' ? 'running' : 'stopped'
  const dss = row.dev_session_started_at
  return {
    id: row.id,
    name: row.name,
    port: Number.isFinite(Number(row.port)) && Number(row.port) > 0 ? Number(row.port) : 3001,
    uptime: '--',
    dev_session_started_at:
      dss != null && String(dss).trim() !== '' ? String(dss).trim() : null,
    status: st,
    cpu: 0,
    ram: '—',
    pkgManager: pm,
    path: row.path,
    thumbnail_url: row.thumbnail_url,
    start_script: row.start_script || 'dev',
    build_script: row.build_script || 'build',
    health_http_code:
      row.health_http_code === undefined || row.health_http_code === null
        ? null
        : Number(row.health_http_code),
    health_checked_at: row.health_checked_at ?? null,
    health_reachable:
      row.health_reachable === true || row.health_reachable === 1
        ? true
        : row.health_reachable === false || row.health_reachable === 0
          ? false
          : null,
    is_favorite: row.is_favorite === true || row.is_favorite === 1,
    node_modules_missing: row.node_modules_missing,
    project_type: row.project_type ?? null,
    detected_project_type: row.detected_project_type,
    shield_project_type:
      row.shield_project_type ?? row.detected_project_type ?? 'unknown',
    is_archived: row.is_archived === true || row.is_archived === 1,
    notes:
      row.notes == null || typeof row.notes === 'undefined'
        ? null
        : String(row.notes),
    vault_has_files: row.vault_has_files === true,
    has_documentation: msc_rowHasDocumentationEnabled(row.has_documentation),
    project_folder_created_at: row.project_folder_created_at ?? null,
    project_folder_modified_at: row.project_folder_modified_at ?? null,
  }
}
