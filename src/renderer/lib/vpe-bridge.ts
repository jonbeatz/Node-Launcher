/** SQLite / IPC row from main process */

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
  /** Last HTTP status from GET / on project port after dev start; null if unreachable. */
  health_http_code?: number | null
  health_checked_at?: string | null
  /** Whether TCP/HTTP reply was received (vs connection error). SQLite may return 0/1. */
  health_reachable?: boolean | number | null
  is_favorite?: number | boolean | null
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
}

export interface AddProjectPayload {
  id?: string
  name: string
  path: string
  port?: number
  thumbnail_url?: string | null
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
  cpuTemp?: number | null
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

export interface CatalogExportResult {
  ok: boolean
  canceled?: boolean
  path?: string
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
    suggestedPort: number
    reservedPort: number
  }>
  toggleStatus: (
    projectId: string,
  ) => Promise<{ ok?: boolean; status?: string }>
  /** PM2 stop-all + runner kill-all + SQLite all stopped */
  stopAllProjects?: () => Promise<{ ok?: boolean }>
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
  addProject: (payload: AddProjectPayload) => Promise<{ ok?: boolean; id?: string }>
  deleteProject: (projectId: string) => Promise<{ ok?: boolean }>
  /** Reassign port + refresh detected scripts/package manager after preflight failure. */
  autoFixProjectPort: (
    projectId: string,
  ) => Promise<{ ok?: boolean; port: number; start_script?: string }>
  openDirectory: () => Promise<string | null>
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
  }
}
