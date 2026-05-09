/**
 * v1.6.0 — Project journal: `notes` column holds JSON `{ v: 1, entries: [...] }` or legacy plain text.
 */

export interface VpeJournalEntry {
  id: string
  text: string
  at: string
}

export interface VpeJournalPayload {
  v: 1
  entries: VpeJournalEntry[]
}

function msc_newJournalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `je_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Parse registry `notes` into journal entries (legacy single block → one entry). */
export function msc_parseProjectJournal(raw: string | null | undefined): VpeJournalEntry[] {
  if (raw == null || String(raw).trim() === '') return []
  const s = String(raw).trim()
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as unknown
      if (
        o &&
        typeof o === 'object' &&
        'v' in o &&
        'entries' in o &&
        (o as { v: unknown }).v === 1 &&
        Array.isArray((o as { entries: unknown }).entries)
      ) {
        const entries = (o as VpeJournalPayload).entries.filter(
          (e): e is VpeJournalEntry =>
            e != null &&
            typeof e === 'object' &&
            typeof (e as VpeJournalEntry).id === 'string' &&
            typeof (e as VpeJournalEntry).text === 'string' &&
            typeof (e as VpeJournalEntry).at === 'string',
        )
        return entries
      }
    } catch {
      /* fall through to legacy */
    }
  }
  return [
    {
      id: msc_newJournalId(),
      text: s,
      at: new Date().toISOString(),
    },
  ]
}

export function msc_serializeProjectJournal(entries: VpeJournalEntry[]): string | null {
  const clean = entries
    .map((e) => ({
      id: String(e.id || msc_newJournalId()),
      text: String(e.text ?? '').trim(),
      at: typeof e.at === 'string' && e.at ? e.at : new Date().toISOString(),
    }))
    .filter((e) => e.text.length > 0)
  if (clean.length === 0) return null
  return JSON.stringify({ v: 1, entries: clean } satisfies VpeJournalPayload)
}

export function msc_journalAddEntry(
  entries: VpeJournalEntry[],
  text: string,
): VpeJournalEntry[] {
  const t = text.trim()
  if (!t) return entries
  return [
    ...entries,
    { id: msc_newJournalId(), text: t, at: new Date().toISOString() },
  ]
}

export function msc_journalRemoveEntry(
  entries: VpeJournalEntry[],
  id: string,
): VpeJournalEntry[] {
  return entries.filter((e) => e.id !== id)
}
