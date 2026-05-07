'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import {
  getVpeApi,
  type VpePromptVaultData,
  type VpePromptVaultItem,
} from '@/lib/vpe-bridge'
import { useToast } from '@/components/vader-toast'

function msc_newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

export function PromptVaultPanel() {
  const { addToast } = useToast()
  const [data, setData] = useState<VpePromptVaultData>({ v: 1, items: [] })
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [bodyMd, setBodyMd] = useState('')

  const persist = useCallback(
    async (next: VpePromptVaultData) => {
      const api = getVpeApi()
      if (!api?.promptVaultWrite) {
        addToast('Prompt Vault unavailable', 'error', 'Run inside VPE (Electron)')
        return
      }
      try {
        await api.promptVaultWrite(next)
        setData(next)
      } catch (e) {
        addToast('Save failed', 'error', e instanceof Error ? e.message : 'Unknown error')
      }
    },
    [addToast],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const api = getVpeApi()
      if (!api?.promptVaultRead) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await api.promptVaultRead()
        if (cancelled) return
        if (res.ok && res.data && Array.isArray(res.data.items)) {
          setData({
            v: typeof res.data.v === 'number' ? res.data.v : 1,
            items: res.data.items,
          })
        }
      } catch {
        if (!cancelled) addToast('Load failed', 'error', 'Could not read prompt vault')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [addToast])

  const handleAdd = () => {
    const t = title.trim()
    const v = versionLabel.trim()
    const b = bodyMd.trim()
    if (!t || !v || !b) {
      addToast('Incomplete template', 'info', 'Title, version label, and Markdown body are required')
      return
    }
    const item: VpePromptVaultItem = {
      id: msc_newId(),
      title: t,
      versionLabel: v,
      bodyMd: b,
      updatedAt: new Date().toISOString(),
    }
    void persist({ v: 1, items: [item, ...data.items] })
    setTitle('')
    setVersionLabel('')
    setBodyMd('')
    addToast('Template saved', 'success', item.versionLabel)
  }

  const handleDelete = (id: string) => {
    void persist({ v: 1, items: data.items.filter((i) => i.id !== id) })
  }

  const handleCopy = async (item: VpePromptVaultItem) => {
    const blob = `${item.versionLabel}\n\n${item.bodyMd}`
    try {
      await navigator.clipboard.writeText(blob)
      addToast('Copied', 'success', item.versionLabel)
    } catch {
      addToast('Copy failed', 'error', 'Clipboard permission denied')
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-sans text-sm text-[#A0A0A0]">
        Loading Prompt Vault…
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4 gap-4">
      <div className="shrink-0 rounded border border-[#333333] bg-[#1c1c1c] p-4 space-y-3">
        <p className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.12em]">
          New Master Directive / Build Protocol
        </p>
        <input
          className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white placeholder:text-[#555555] vader-focus"
          placeholder="Title (e.g. Vader Sync)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white placeholder:text-[#555555] vader-focus"
          placeholder='Version label (e.g. "Vader Protocol v1.0.8")'
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
        />
        <textarea
          className="w-full min-h-[140px] rounded bg-[#121212] border border-[#333333] px-3 py-2 font-mono text-xs text-[#e0e0e0] placeholder:text-[#555555] vader-focus resize-y"
          placeholder="Markdown template body…"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded bg-[#4fde82] hover:bg-[#3fcf72] text-black font-sans text-xs font-semibold uppercase tracking-wide vader-focus"
        >
          <Plus size={16} />
          Save template
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3">
        {data.items.length === 0 ? (
          <p className="font-sans text-sm text-[#666666]">No templates yet — add one above.</p>
        ) : (
          data.items.map((item) => (
            <div
              key={item.id}
              className="rounded border border-[#333333] bg-[#161616] p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-sans text-sm font-medium text-white">{item.title}</h3>
                  <p className="font-sans text-[11px] text-[#4fde82] mt-0.5">{item.versionLabel}</p>
                  <p className="font-sans text-[10px] text-[#666666] mt-1">
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Copy to clipboard"
                    onClick={() => void handleCopy(item)}
                    className="h-8 px-3 rounded bg-white text-black hover:bg-[#e8e8e8] font-sans text-[11px] font-bold uppercase tracking-wide vader-focus"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Copy size={14} />
                      Copy
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => handleDelete(item.id)}
                    className="h-8 w-8 flex items-center justify-center rounded border border-[#444444] text-[#A0A0A0] hover:text-red-400 hover:border-red-400/50 vader-focus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <pre className="font-mono text-[11px] text-[#b0b0b0] whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar border-t border-[#2a2a2a] pt-2">
                {item.bodyMd}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
