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
  | 'wordpress-local'

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
  /** SQLite v14+ — legacy mirror of manual order (kept in sync with `display_order`). */
  sort_order?: number | null
  /** SQLite v17+ — dashboard sort key (tie-break: `id` in main query). */
  display_order?: number | null
  node_modules_missing?: boolean
  /** ISO timestamps from `fs.statSync` on project `path` (main enrich). */
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
  /** ISO time when dev session last started (SQLite v11+); drives live uptime in renderer. */
  dev_session_started_at?: string | null
  /** SQLite v16+ — JEDI_MOD_24: Watchdog auto-restart. */
  watchdog_enabled?: number | boolean | null
  /** Main enrich JEDI_MOD_29 — registry `path` not found on disk (boolean or 0/1 from IPC). */
  project_path_missing?: boolean | number | null
  /** JEDI_MOD_136 — disk root exists and `package.json` present (HTTP health / offline semantics). */
  vpe_repo_runnable_for_http?: boolean | number | null
  /** LocalWP / wordpress-local: persisted custom domain (e.g. `http://sitename.local/`). */
  project_url?: string | null
  /** LocalWP: site identifier / folder slug for the `local.exe` CLI. Falls back to project `name`. */
  slug?: string | null
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
  /** Registry (SQLite v14+); mirrors `display_order`. */
  sort_order?: number | null
  /** Registry (SQLite v17+). */
  display_order?: number | null
  project_folder_created_at?: string | null
  project_folder_modified_at?: string | null
  dev_session_started_at?: string | null
  /** SQLite v16+ — JEDI_MOD_24: Watchdog auto-restart. */
  watchdog_enabled?: number | boolean | null
  /** JEDI_MOD_29 — workspace root missing on disk. */
  project_path_missing?: boolean
  /** JEDI_MOD_136 — false when folder or package.json missing; UI stays staging vs error. */
  vpe_repo_runnable_for_http?: boolean
  /** LocalWP / wordpress-local: persisted custom domain (e.g. `http://sitename.local/`). */
  project_url?: string | null
  /** LocalWP: site identifier / folder slug for the `local.exe` CLI. Falls back to project `name`. */
  slug?: string | null
}
