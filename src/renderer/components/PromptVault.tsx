'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Plus, Trash2, Pencil, X } from 'lucide-react'
import {
  getVpeApi,
  type VpePromptVaultData,
  type VpePromptVaultEntryType,
  type VpePromptVaultItem,
} from '@/lib/vpe-bridge'
import { useToast } from '@/components/vader-toast'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

function msc_newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

function msc_copyBlob(item: VpePromptVaultItem): string {
  const d = (item.description ?? '').trim()
  const parts = [item.versionLabel]
  if (d) parts.push(d)
  parts.push(item.bodyMd)
  return parts.join('\n\n')
}

function msc_resolvedVaultType(item: VpePromptVaultItem): VpePromptVaultEntryType {
  const t = item.type
  if (t === 'Command' || t === 'Directive' || t === 'Snippet') return t
  return 'Directive'
}

function msc_vaultTypeBadge(t: VpePromptVaultEntryType): string {
  if (t === 'Command') return '[CMD]'
  if (t === 'Snippet') return '[SNP]'
  return '[DIR]'
}

export function PromptVault() {
  const { addToast } = useToast()
  const [data, setData] = useState<VpePromptVaultData>({ v: 1, items: [] })
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const [description, setDescription] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [itemType, setItemType] = useState<VpePromptVaultEntryType>('Directive')

  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<VpePromptVaultItem | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eVersion, setEVersion] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eBody, setEBody] = useState('')
  const [eType, setEType] = useState<VpePromptVaultEntryType>('Directive')

  const reload = useCallback(async () => {
    const api = getVpeApi()
    if (!api?.promptVaultRead) return
    const res = await api.promptVaultRead()
    if (res.ok && res.data && Array.isArray(res.data.items)) {
      setData({
        v: typeof res.data.v === 'number' ? res.data.v : 1,
        items: res.data.items,
      })
    }
  }, [])

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
      addToast('Incomplete template', 'info', 'Title, version label, and content are required')
      return
    }
    const item: VpePromptVaultItem = {
      id: msc_newId(),
      title: t,
      versionLabel: v,
      type: itemType,
      description: description.trim() || undefined,
      bodyMd: b,
      updatedAt: new Date().toISOString(),
    }
    void persist({ v: 1, items: [item, ...data.items] })
    setTitle('')
    setVersionLabel('')
    setDescription('')
    setBodyMd('')
    setItemType('Directive')
    addToast('Template saved', 'success', item.versionLabel)
  }

  const handleDelete = (id: string) => {
    void persist({ v: 1, items: data.items.filter((i) => i.id !== id) })
  }

  const handleCopy = async (item: VpePromptVaultItem) => {
    const blob = msc_copyBlob(item)
    try {
      await navigator.clipboard.writeText(blob)
      addToast('Copied', 'success', item.title)
    } catch {
      addToast('Copy failed', 'error', 'Clipboard permission denied')
    }
  }

  const openEdit = (item: VpePromptVaultItem) => {
    setEditItem(item)
    setETitle(item.title)
    setEVersion(item.versionLabel)
    setEDesc(item.description ?? '')
    setEBody(item.bodyMd)
    setEType(msc_resolvedVaultType(item))
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editItem) return
    const api = getVpeApi()
    if (!api?.updateVaultItem) {
      addToast('Edit unavailable', 'error', 'Update IPC not exposed — use full VPE build.')
      return
    }
    const t = eTitle.trim()
    const v = eVersion.trim()
    const b = eBody.trim()
    if (!t || !v || !b) {
      addToast('Incomplete', 'info', 'Title, version, and content are required')
      return
    }
    try {
      await api.updateVaultItem({
        id: editItem.id,
        title: t,
        versionLabel: v,
        description: eDesc.trim(),
        bodyMd: b,
        type: eType,
      })
      setEditOpen(false)
      setEditItem(null)
      await reload()
      addToast('Vault item updated', 'success', t)
    } catch (e) {
      addToast('Update failed', 'error', e instanceof Error ? e.message : 'Unknown error')
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
      <Accordion
        type="single"
        collapsible
        className="shrink-0 w-full rounded border border-[#333333] bg-[#1c1c1c] overflow-hidden"
      >
        <AccordionItem value="new-master-directive" className="border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:bg-[#2a2a2a] hover:no-underline text-sm font-sans text-white font-medium [&>svg]:text-[#888888]">
            + Create New Master Directive
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0 border-t border-[#2a2a2a] space-y-3">
            <p className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.12em] pt-1">
              Build protocol template
            </p>
            <input
              className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white placeholder:text-[#555555] vader-focus"
              placeholder="Title (e.g. Vader Sync)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white placeholder:text-[#555555] vader-focus"
              placeholder='Version label (e.g. v1.3.7 or "MSC Media Engine v1.3.7")'
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-[#888888] uppercase tracking-wide">
                Type
              </label>
              <select
                className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white vader-focus"
                value={itemType}
                onChange={(e) => setItemType(e.target.value as VpePromptVaultEntryType)}
              >
                <option value="Directive">Directive — [DIR]</option>
                <option value="Command">Command — [CMD]</option>
                <option value="Snippet">Snippet — [SNP]</option>
              </select>
            </div>
            <input
              className="w-full h-9 rounded bg-[#121212] border border-[#333333] px-3 font-sans text-sm text-white placeholder:text-[#555555] vader-focus"
              placeholder="Short description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <textarea
              className="w-full min-h-[120px] rounded bg-[#121212] border border-[#333333] px-3 py-2 font-mono text-xs text-[#e0e0e0] placeholder:text-[#555555] vader-focus resize-y"
              placeholder="Command or Markdown body…"
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded border border-[#333333] bg-transparent text-[#e0e0e0] font-sans text-xs font-semibold uppercase tracking-wide hover:bg-[#2a2a2a] hover:border-[#444444] vader-focus"
            >
              <Plus size={16} />
              Save template
            </button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {data.items.length === 0 ? (
          <p className="font-sans text-sm text-[#666666]">
            No templates yet — expand <strong className="text-[#909090]">+ Create New Master Directive</strong> to add one.
          </p>
        ) : (
          <Accordion type="single" collapsible className="space-y-2 w-full">
            {data.items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded border border-[#333333] bg-[#161616] overflow-hidden last:border-b"
              >
                <div className="flex items-stretch gap-0">
                  <AccordionTrigger className="flex-1 px-4 py-3 hover:bg-[#2a2a2a] hover:no-underline text-left [&>svg]:text-[#888888] font-sans">
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="shrink-0 font-mono text-[10px] font-semibold tracking-wide text-[#888888] border border-[#333333] rounded px-1.5 py-0.5 bg-[#121212]"
                          title={
                            msc_resolvedVaultType(item) === 'Command'
                              ? 'Command — runnable / CLI oriented'
                              : msc_resolvedVaultType(item) === 'Snippet'
                                ? 'Snippet — short copy-paste'
                                : 'Directive — protocol or narrative'
                          }
                        >
                          {msc_vaultTypeBadge(msc_resolvedVaultType(item))}
                        </span>
                        <span className="text-sm font-medium text-white truncate">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-[#c8c8c8]">{item.versionLabel}</span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-1 pr-2 shrink-0 border-l border-[#2a2a2a]">
                    <button
                      type="button"
                      title="Prime AI Assistant"
                      aria-label="Prime AI Assistant"
                      onClick={() => void handleCopy(item)}
                      className="h-9 w-9 flex items-center justify-center rounded bg-[#2a2a2a] text-[#eaeaea] hover:bg-[#333333] vader-focus"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      title="Edit vault template"
                      aria-label="Edit vault template"
                      onClick={() => openEdit(item)}
                      className="h-9 w-9 flex items-center justify-center rounded bg-[#2a2a2a] text-[#eaeaea] hover:bg-[#333333] vader-focus"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
                <AccordionContent className="px-4 pb-4 pt-0 border-t border-[#2a2a2a] bg-[#141414] text-sm">
                  <p className="font-sans text-[10px] text-[#555555] uppercase tracking-wide pt-3 mb-1">
                    Description
                  </p>
                  <p className="font-sans text-xs text-[#A0A0A0] mb-3 whitespace-pre-wrap">
                    {(item.description ?? '').trim() || '—'}
                  </p>
                  <p className="font-sans text-[10px] text-[#555555] uppercase tracking-wide mb-1">
                    Content
                  </p>
                  <pre className="font-mono text-[11px] text-[#d4d4d4] whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar rounded bg-[#0a0a0a] border border-[#333333] p-3">
                    {item.bodyMd}
                  </pre>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-sans text-[10px] text-[#555555]">
                      Updated {new Date(item.updatedAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      title="Remove from vault"
                      aria-label="Remove from vault"
                      onClick={() => handleDelete(item.id)}
                      className="h-8 px-3 rounded border border-[#333333] text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a] font-sans text-[11px] vader-focus inline-flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {editOpen && editItem ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setEditOpen(false)}
            aria-hidden
          />
          <div className="relative w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto rounded border border-[#333333] bg-[#1c1c1c] shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-sm font-semibold text-white">Edit vault item</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1 rounded text-[#A0A0A0] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="w-full h-9 rounded bg-[#0a0a0a] border border-[#333333] px-3 font-sans text-sm text-white vader-focus"
                value={eTitle}
                onChange={(e) => setETitle(e.target.value)}
                placeholder="Title"
              />
              <input
                className="w-full h-9 rounded bg-[#0a0a0a] border border-[#333333] px-3 font-sans text-sm text-white vader-focus"
                value={eVersion}
                onChange={(e) => setEVersion(e.target.value)}
                placeholder="Version label"
              />
              <div className="flex flex-col gap-1">
                <label className="font-sans text-[10px] text-[#888888] uppercase tracking-wide">
                  Type
                </label>
                <select
                  className="w-full h-9 rounded bg-[#0a0a0a] border border-[#333333] px-3 font-sans text-sm text-white vader-focus"
                  value={eType}
                  onChange={(e) => setEType(e.target.value as VpePromptVaultEntryType)}
                >
                  <option value="Directive">Directive — [DIR]</option>
                  <option value="Command">Command — [CMD]</option>
                  <option value="Snippet">Snippet — [SNP]</option>
                </select>
              </div>
              <textarea
                className="w-full min-h-[72px] rounded bg-[#0a0a0a] border border-[#333333] px-3 py-2 font-sans text-xs text-[#e0e0e0] vader-focus resize-y"
                value={eDesc}
                onChange={(e) => setEDesc(e.target.value)}
                placeholder="Description"
              />
              <textarea
                className="w-full min-h-[160px] rounded bg-[#0a0a0a] border border-[#333333] px-3 py-2 font-mono text-xs text-[#e0e0e0] vader-focus resize-y"
                value={eBody}
                onChange={(e) => setEBody(e.target.value)}
                placeholder="Content / commands"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="h-9 px-4 rounded border border-[#333333] font-sans text-xs text-[#A0A0A0] hover:text-white hover:bg-[#2a2a2a] vader-focus"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="h-9 px-4 rounded bg-[#2a2a2a] border border-[#444444] font-sans text-xs text-white hover:bg-[#333333] vader-focus"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
