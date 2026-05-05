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

export interface VpeApi {
  getProjects: () => Promise<VpeProjectRow[]>
  getLogs: (projectId: string) => Promise<VpeLogRow[]>
  toggleStatus: (
    projectId: string,
  ) => Promise<{ ok?: boolean; status?: string }>
  runBuild: (projectId: string) => Promise<{ ok?: boolean }>
  nukeProject: (projectId: string) => Promise<{ ok?: boolean; id?: string }>
  saveSettings: (payload: SaveSettingsPayload) => Promise<{ ok?: boolean }>
  addProject: (payload: AddProjectPayload) => Promise<{ ok?: boolean; id?: string }>
  deleteProject: (projectId: string) => Promise<{ ok?: boolean }>
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
    port: Number(row.port) || 3000,
    uptime: '--',
    status: st,
    cpu: 0,
    ram: '—',
    pkgManager: pm,
    path: row.path,
    thumbnail_url: row.thumbnail_url,
    start_script: row.start_script || 'dev',
    build_script: row.build_script || 'build',
  }
}
