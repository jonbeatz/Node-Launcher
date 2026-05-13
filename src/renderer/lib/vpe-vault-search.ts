import { msc_shieldTypeTitle } from '@/lib/shield-colors'

/**
 * v1.6.0 — Vault Search: **continuous substring** only on catalog fields (case-insensitive).
 * "Tag" = shield type keys + human titles + persisted `project_type` override.
 * No subsequence / "fuzzy gap" matching — e.g. `v0` matches only where the literal `v0` appears in name, tag, or port.
 */

function msc_vaultSearchTagHaystack(p: {
  shield_project_type?: string
  project_type?: string | null
  detected_project_type?: string
}): string {
  const st = p.shield_project_type
  const dt = p.detected_project_type
  const parts = [
    st ?? '',
    dt ?? '',
    p.project_type ?? '',
    msc_shieldTypeTitle(st),
    msc_shieldTypeTitle(dt),
  ]
  return parts.join(' ').toLowerCase()
}

function msc_tokenMatchesField(field: string, token: string): boolean {
  if (!token) return true
  return field.includes(token)
}

export interface MscVaultSearchProjectShape {
  name: string
  port: number
  path: string
  shield_project_type?: string
  project_type?: string | null
  detected_project_type?: string
}

/** Single whitespace-delimited token must hit name, tag haystack, or port string (substring). */
function msc_vaultSearchTokenMatches(
  p: MscVaultSearchProjectShape,
  token: string,
  opts: { includePath: boolean },
): boolean {
  const name = p.name.toLowerCase()
  const portStr = String(p.port).toLowerCase()
  const tag = msc_vaultSearchTagHaystack(p)
  const fields = [name, portStr, tag]
  if (opts.includePath) {
    fields.push(p.path.toLowerCase())
  }
  return fields.some((f) => msc_tokenMatchesField(f, token))
}

/**
 * @param rawQuery — trimmed internally; empty → matches all
 * @param opts.includePath — jump palette (Ctrl+K) also searches filesystem path
 */
export function msc_projectMatchesVaultSearch(
  p: MscVaultSearchProjectShape,
  rawQuery: string,
  opts: { includePath: boolean },
): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((tok) => msc_vaultSearchTokenMatches(p, tok, opts))
}
