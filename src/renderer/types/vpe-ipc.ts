/**
 * Core IPC / SQLite-aligned types for the renderer.
 * `has_documentation` is stored as INTEGER 0/1 in SQLite; IPC may surface 0/1 or boolean before normalization.
 */

export type VpeShieldProjectType =
  | 'v0'
  | 'electron'
  | 'web'
  | 'node'
  | 'unknown'

/** SQLite boolean column semantics (0/1) and boolean JSON coercions — not string-typed at the boundary. */
export type VpeHasDocumentation = number | boolean

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
  /** Renderer enrich: reference vault has ≥1 user file (not internal thumb / keep). */
  vault_has_files?: boolean
  /** SQLite v13+ — 0/1 in DB; treat via `msc_rowHasDocumentationEnabled` for UI. */
  has_documentation?: VpeHasDocumentation
  /** SQLite v14+ — dashboard manual order (lower first). */
  sort_order?: number | null
  node_modules_missing?: boolean
  /** ISO timestamps from `fs.statSync` on project `path` (main enrich). */
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
  /** ISO time when dev session last started (SQLite v11+); drives live uptime in renderer. */
  dev_session_started_at?: string | null
  /** SQLite v16+ — JEDI_MOD_24: Watchdog auto-restart. */
  watchdog_enabled?: number | boolean | null
}

/** Dashboard project shape (grids, list, cards). */
export interface Project {
  id: string
  name: string
  port: number
  uptime: string
  status: 'running' | 'stopped' | 'error' | 'building'
  cpu: number
  ram: string
  pkgManager: 'npm' | 'yarn' | 'pnpm'
  path: string
  group?: string
  hasBuilt?: boolean
  start_script?: string
  build_script?: string
  thumbnail_url?: string | null
  health_http_code?: number | null
  health_checked_at?: string | null
  health_reachable?: boolean | null
  is_favorite?: boolean
  node_modules_missing?: boolean
  project_type?: string | null
  detected_project_type?: VpeShieldProjectType
  shield_project_type?: VpeShieldProjectType
  is_archived?: boolean
  notes?: string | null
  vault_has_files?: boolean
  /** Registry (SQLite v13+); paperclip requires enabled + vault reference files. */
  has_documentation?: VpeHasDocumentation
  /** Registry (SQLite v14+); manual dashboard order. */
  sort_order?: number | null
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
  dev_session_started_at?: string | null
  /** SQLite v16+ — JEDI_MOD_24: Watchdog auto-restart. */
  watchdog_enabled?: number | boolean | null
}
