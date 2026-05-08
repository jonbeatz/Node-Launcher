/** SQLite / IPC row from main process */

export type VpeShieldProjectType =
  | 'v0'
  | 'electron'
  | 'web'
  | 'node'
  | 'unknown'

export interface VpeProjectRow {
  id: string
  name: string
  path: string
  port: number
  status: 'running' | 'stopped'
  thumbnail_url: string | null
  start_script: string
  build_script: string
  pkg_manager: string
  /** User override (`null`/empty → auto classify). SQLite v6+ */
  project_type?: string | null
  /** Live classifier for current path */
  detected_project_type?: VpeShieldProjectType
  /** Resolved shield icon on cards (`project_type` or detected). */
  shield_project_type?: VpeShieldProjectType
  /** Last HTTP status from GET / on project port after dev start; null if unreachable. */
  health_http_code?: number | null
  health_checked_at?: string | null
  /** Whether TCP/HTTP reply was received (vs connection error). SQLite may return 0/1. */
  health_reachable?: boolean | number | null
  is_favorite?: number | boolean | null
  /** SQLite v7+ — hidden from default dashboard until Archive filter */
  is_archived?: number | boolean | null
  /** SQLite v8+ — Project Settings notes */
  notes?: string | null
  /** Renderer enrich: reference vault has ≥1 file */
  vault_has_files?: boolean
  node_modules_missing?: boolean
}

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

/** v1.4.0 — Prompt Vault row categorization (UI badges: CMD / DIR / SNP). */
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
  /** `card` → dashboard grid layout in renderer. */
  default_view: 'card' | 'list'
  theme_accent?: string
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
  saveSettings: (payload: SaveSettingsPayload) => Promise<{ ok?: boolean }>
  getAppSettings?: () => Promise<VpeAppSettings>
  updateAppSettings?: (
    payload: Partial<VpeAppSettings>,
  ) => Promise<{ ok?: boolean; settings?: VpeAppSettings }>
  updateSettingLaunchStartup?: (
    value: boolean,
  ) => Promise<{ ok?: boolean; settings?: VpeAppSettings }>
  addProject: (payload: AddProjectPayload) => Promise<{ ok?: boolean; id?: string }>
  deleteProject: (projectId: string) => Promise<{ ok?: boolean }>
  /** Reassign port + refresh detected scripts/package manager after preflight failure. */
  autoFixProjectPort: (
    projectId: string,
  ) => Promise<{ ok?: boolean; port: number; start_script?: string }>
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
  /** Main registers `vpe:e2e-vault-copy-from-path` only when `VPE_E2E=1` (Playwright). */
  e2eVaultCopyFromPath?: (
    projectId: string,
    absoluteSourcePath: string,
  ) => Promise<{ ok: boolean; dest?: string; name?: string }>
  pickThumbnail: (projectId: string) => Promise<string | null>
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
  restoreStateSnapshot?: () => Promise<{ ok: boolean; error?: string }>
  executeTerminalCommand?: (command: string, activeProjectId?: string) => Promise<{ ok: boolean; output: string }>
  openExplorer?: (folderPath: string) => Promise<{ ok: boolean; error?: string }>
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
    log?: string[]
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

/** v1.2.1 — safe message for terminals / toasts when IPC rejects with a DOM Event or other non-Error. */
export function msc_formatUnknownIPCError(reason: unknown): string {
  if (reason == null) return 'Unknown failure'
  if (typeof reason === 'string') return reason
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

export function msc_rowToDashboardProject(row: VpeProjectRow): {
  id: string
  name: string
  port: number
  uptime: string
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
} {
  const pm =
    row.pkg_manager === 'yarn' || row.pkg_manager === 'pnpm'
      ? row.pkg_manager
      : 'npm'
  const st: 'running' | 'stopped' =
    row.status === 'running' ? 'running' : 'stopped'
  return {
    id: row.id,
    name: row.name,
    port: Number.isFinite(Number(row.port)) && Number(row.port) > 0 ? Number(row.port) : 3001,
    uptime: '--',
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
  }
}
