'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react'
import { getVpeApi } from '@/lib/vpe-bridge'
import { useToast } from '@/components/vader-toast'

export type EnvModelLine =
  | { id: string; kind: 'blank'; raw: string }
  | { id: string; kind: 'comment'; raw: string }
  | { id: string; kind: 'kv'; key: string; value: string; exportPrefix: boolean }

function msc_newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `env-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function msc_unquoteEnvValue(v: string): string {
  const t = v.trim()
  if (t.length >= 2) {
    if (t.startsWith('"') && t.endsWith('"')) {
      return t
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }
    if (t.startsWith("'") && t.endsWith("'")) {
      return t.slice(1, -1).replace(/\\'/g, "'")
    }
  }
  const sharp = t.indexOf(' #')
  if (sharp !== -1) return t.slice(0, sharp).trimEnd()
  return t
}

function msc_quoteEnvValue(v: string): string {
  if (/[\s#"\\]/.test(v) || v.includes('\n')) {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    return `"${escaped}"`
  }
  return v
}

export function msc_parseDotEnvToLines(content: string): EnvModelLine[] {
  const lines = content.split(/\r?\n/)
  return lines.map((raw) => {
    const id = msc_newId()
    if (/^\s*$/.test(raw)) return { id, kind: 'blank', raw }
    const t = raw.trimStart()
    if (t.startsWith('#')) return { id, kind: 'comment', raw }
    const ex = /^\s*(export\s+)([\w.-]+)\s*=\s*(.*)$/.exec(raw)
    if (ex) {
      return {
        id,
        kind: 'kv',
        key: ex[2],
        value: msc_unquoteEnvValue(ex[3]),
        exportPrefix: true,
      }
    }
    const m = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(raw)
    if (m) {
      return {
        id,
        kind: 'kv',
        key: m[1],
        value: msc_unquoteEnvValue(m[2]),
        exportPrefix: false,
      }
    }
    return { id, kind: 'comment', raw }
  })
}

export function msc_serializeDotEnvLines(rows: EnvModelLine[]): string {
  const body = rows
    .map((row) => {
      if (row.kind === 'blank') return row.raw
      if (row.kind === 'comment') return row.raw
      const pfx = row.exportPrefix ? 'export ' : ''
      return `${pfx}${row.key}=${msc_quoteEnvValue(row.value)}`
    })
    .join('\n')
  return body === '' ? '' : `${body}\n`
}

function msc_envKeyIsSensitive(key: string): boolean {
  const u = key.toUpperCase()
  return ['KEY', 'SECRET', 'TOKEN', 'PASSWORD'].some((frag) => u.includes(frag))
}

/** JEDI_MOD_02 — no VPE green outline; accent border + subtle inset glow on focus. */
const inputCls =
  'w-full min-w-0 rounded border border-white/12 bg-[#1c1c1c] px-2 py-1.5 text-[12px] text-[#d1d5db] placeholder:text-[#666666] outline-none ring-0 transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:border-[color:var(--msc-accent)]/45 focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_0_14px_rgba(79,222,130,0.06)]'

/** JEDI_MOD_02_ENV_CLEANUP — long values / dot masks must clip inside the field. */
const inputValueCls = `${inputCls} overflow-hidden text-ellipsis whitespace-nowrap`

/** Key / value / delete — labels row + inputs row; trash sits on input row only (JEDI_MOD_03). */
const envRowGrid =
  'grid grid-cols-1 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] sm:grid-rows-[auto_auto] sm:gap-x-2 sm:gap-y-0.5'

const labelCls =
  'mb-px block text-[9px] leading-none uppercase tracking-wider text-[#555555]'

/** In-field visibility toggle (absolute, right). */
const eyeInFieldCls =
  'absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded border border-white/12 bg-[#141414]/95 text-[#c8c8c8] outline-none transition-[border-color,box-shadow] duration-150 hover:border-white/25 hover:text-white focus:outline-none focus:ring-0 focus-visible:border-[color:var(--msc-accent)]/40 focus-visible:shadow-[inset_0_0_8px_rgba(79,222,130,0.06)]'

/** Shared min height so Key/Value inputs + trash share one visual band (JEDI_MOD_03). */
const envFieldMinH = 'min-h-[34px]'

const envActionsGrid =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] sm:gap-x-2 sm:items-stretch'

const iconBtnCls =
  'flex shrink-0 items-center justify-center rounded border border-white/12 bg-[#1a1a1a] text-[#c8c8c8] outline-none transition-[border-color,box-shadow] duration-150 hover:border-white/25 hover:text-white focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[color:var(--msc-accent)]/40 focus-visible:shadow-[inset_0_0_10px_rgba(79,222,130,0.05)]'

type Props = {
  projectId: string
  /** Tab is selected and accordion is open — triggers load. */
  active: boolean
}

export function Msc_ProjectEnvTab({ projectId, active }: Props) {
  const { addToast } = useToast()
  const [lines, setLines] = useState<EnvModelLine[]>([])
  const [baseline, setBaseline] = useState('')
  const [diskPath, setDiskPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.readProjectDotEnv) return
    setLoading(true)
    try {
      const res = await api.readProjectDotEnv(projectId)
      if (!res?.ok) {
        addToast('Environment', 'error', res?.error ?? 'Could not read .env', undefined, 4000)
        setLines([])
        setBaseline('')
        setDiskPath(null)
        return
      }
      const parsed = msc_parseDotEnvToLines(typeof res.content === 'string' ? res.content : '')
      setLines(parsed)
      const ser = msc_serializeDotEnvLines(parsed)
      setBaseline(ser)
      setDiskPath(typeof res.path === 'string' ? res.path : null)
      setRevealed({})
    } catch (e) {
      addToast('Environment', 'error', e instanceof Error ? e.message : String(e), undefined, 4000)
    } finally {
      setLoading(false)
    }
  }, [projectId, addToast])

  useEffect(() => {
    if (!active || !projectId.trim()) return
    void load()
  }, [active, projectId, load])

  const serialized = useMemo(() => msc_serializeDotEnvLines(lines), [lines])
  const dirty = serialized !== baseline

  const updateKv = useCallback(
    (id: string, patch: Partial<Pick<EnvModelLine & { kind: 'kv' }, 'key' | 'value' | 'exportPrefix'>>) => {
      setLines((prev) =>
        prev.map((row) => (row.kind === 'kv' && row.id === id ? { ...row, ...patch } : row)),
      )
    },
    [],
  )

  const addVariable = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { id: msc_newId(), kind: 'kv', key: '', value: '', exportPrefix: false },
    ])
  }, [])

  const removeKv = useCallback((id: string) => {
    setLines((prev) => prev.filter((r) => !(r.kind === 'kv' && r.id === id)))
    setRevealed((r) => {
      const next = { ...r }
      delete next[id]
      return next
    })
  }, [])

  const save = async () => {
    const api = getVpeApi()
    if (!api?.writeProjectDotEnv) return
    setSaving(true)
    try {
      const res = await api.writeProjectDotEnv({ projectId, content: serialized })
      if (!res?.ok) {
        addToast('Save failed', 'error', res?.error ?? 'Write rejected', undefined, 4000)
        return
      }
      setBaseline(serialized)
      if (typeof res.path === 'string') setDiskPath(res.path)
      addToast('Saved', 'success', '.env updated on disk.', undefined, 2500)
    } catch (e) {
      addToast('Save failed', 'error', e instanceof Error ? e.message : String(e), undefined, 4000)
    } finally {
      setSaving(false)
    }
  }

  const toggleReveal = (id: string) => {
    setRevealed((r) => ({ ...r, [id]: !r[id] }))
  }

  if (!projectId.trim()) {
    return <p className="text-[11px] text-[#888888]">No project id — cannot load .env.</p>
  }

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-[#A0A0A0]">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          Loading .env…
        </div>
      ) : null}

      {diskPath ? (
        <p className="break-all font-mono text-[10px] leading-snug text-[#666666]" title={diskPath}>
          {diskPath}
        </p>
      ) : null}

      <div className="max-h-[220px] overflow-y-auto pr-0.5">
        <div className="flex flex-col gap-2">
          {lines.map((row) => {
            if (row.kind === 'blank') {
              return <div key={row.id} className="h-1.5" aria-hidden />
            }
            if (row.kind === 'comment') {
              return (
                <div
                  key={row.id}
                  className="rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 font-mono text-[11px] text-[#888888]"
                >
                  {row.raw}
                </div>
              )
            }
            const sens = msc_envKeyIsSensitive(row.key)
            const showSecret = !sens || revealed[row.id]
            return (
              <div key={row.id} className={envRowGrid}>
                <label className={`${labelCls} sm:col-start-1 sm:row-start-1`}>Key</label>
                <label className={`${labelCls} sm:col-start-2 sm:row-start-1`}>Value</label>
                <div
                  className="hidden min-h-[11px] sm:col-start-3 sm:row-start-1 sm:block"
                  aria-hidden
                />
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateKv(row.id, { key: e.target.value })}
                  className={`${inputCls} ${envFieldMinH} min-w-0 overflow-hidden text-ellipsis whitespace-nowrap sm:col-start-1 sm:row-start-2`}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="VAR_NAME"
                />
                <div className={`relative min-w-0 ${envFieldMinH} sm:col-start-2 sm:row-start-2`}>
                  {sens && !showSecret ? (
                    <button
                      type="button"
                      onClick={() => toggleReveal(row.id)}
                      className={`${inputValueCls} ${envFieldMinH} block w-full cursor-pointer pr-10 text-left font-mono tracking-[0.12em] text-[#b0b0b0]`}
                      title="Show value"
                    >
                      {row.value
                        ? '•'.repeat(Math.min(100, Math.max(8, row.value.length)))
                        : '••••••••'}
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateKv(row.id, { value: e.target.value })}
                      className={`${inputValueCls} ${envFieldMinH} ${sens ? 'pr-10' : ''}`}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="value"
                    />
                  )}
                  {sens ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleReveal(row.id)
                      }}
                      className={eyeInFieldCls}
                      title={showSecret ? 'Mask value' : 'Show value'}
                      aria-label={showSecret ? 'Mask secret value' : 'Show secret value'}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center justify-end pt-0.5 sm:col-start-3 sm:row-start-2 sm:items-center sm:justify-center sm:self-center sm:pt-0">
                  <button
                    type="button"
                    onClick={() => removeKv(row.id)}
                    className={`${iconBtnCls} ${envFieldMinH} w-8 shrink-0`}
                    title="Remove variable (save to write .env)"
                    aria-label={`Delete environment variable ${row.key || 'row'}`}
                  >
                    <Trash2 size={14} className="text-[#b45353] opacity-90" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={envActionsGrid}>
        <div className="flex min-h-[34px] min-w-0 gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={addVariable}
            className={`${iconBtnCls} inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[#A0A0A0] hover:text-white`}
          >
            <Plus size={12} className="shrink-0" />
            Add variable
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="inline-flex min-h-[34px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-[#e02b20]/80 bg-[#2a1515] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#f5f5f5] outline-none ring-0 transition-[border-color,box-shadow] duration-150 hover:bg-[#3a1f1f] focus:outline-none focus:ring-0 focus-visible:border-[color:var(--msc-accent)]/45 focus-visible:shadow-[inset_0_0_12px_rgba(79,222,130,0.06)] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-1 sm:px-3"
          >
            {saving ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
            Save changes
          </button>
        </div>
        <div className="hidden min-h-[34px] sm:col-start-3 sm:block sm:min-w-[2.25rem]" aria-hidden />
      </div>
    </div>
  )
}
