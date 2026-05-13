/**
 * VPE system log buffer — FIFO cap and append helpers (JEDI_MOD_25 / Sentinel).
 * Renderer-only; IPC persistence remains in main.
 */

export const VPE_TERMINAL_LINE_CAP = 1000

export type LogEntryType = 'system' | 'warning' | 'error' | 'command' | 'output'

export interface LogEntry {
  id: string
  type: LogEntryType
  time: string
  label?: string
  message: string
}

/** Strip CSI/OSC and lone ESC; removes SGR fragments so logs don't show "dark boxes." */
export function msc_stripAnsiDisplay(input: string): string {
  if (!input) return input
  let s = input
    .replace(/\u001b\[[\?]?[0-9;]*[A-Za-z]/g, '')
    .replace(/\u001b\][\d;]*(?:;[^\u0007\u001b]*)?\u0007/g, '')
    .replace(/\u001b\][\d;]*(?:;[^\u001b\\]*)?\\/g, '')
    .replace(/[\u001b\u009b\u0090]/g, '')
  s = s.replace(/\[[0-9;]*m/g, '')
  s = s.replace(/#< CLIXML[\s\S]*?<\/Objs>/gi, '')
  s = s.replace(/<Objs[^>]*>[\s\S]*?<\/Objs>/gi, '')
  return s
}

export function msc_effectiveLineCap(prefScrollback: number): number {
  const n = Number.isFinite(prefScrollback) ? Math.floor(prefScrollback) : VPE_TERMINAL_LINE_CAP
  return Math.min(Math.max(1, n), VPE_TERMINAL_LINE_CAP)
}

export function msc_appendLogCapped(
  prev: LogEntry[],
  entry: LogEntry,
  cap: number = VPE_TERMINAL_LINE_CAP,
): LogEntry[] {
  const c = msc_effectiveLineCap(cap)
  const next = [...prev, entry]
  if (next.length <= c) return next
  return next.slice(-c)
}

export function msc_appendLogsCapped(
  prev: LogEntry[],
  entries: LogEntry[],
  cap: number = VPE_TERMINAL_LINE_CAP,
): LogEntry[] {
  const c = msc_effectiveLineCap(cap)
  const next = [...prev, ...entries]
  if (next.length <= c) return next
  return next.slice(-c)
}

export function msc_logLineMatchesQuery(log: LogEntry, low: string): boolean {
  const msg = msc_stripAnsiDisplay(log.message).toLowerCase()
  if (msg.includes(low)) return true
  if (log.label && log.label.toLowerCase().includes(low)) return true
  return false
}

/** Deep filter: lines not matching are omitted (caller maps to DOM only `filtered`). */
export function msc_filterLogsForSearch(
  logs: LogEntry[],
  searchTerm: string,
  errorOnly: boolean,
): LogEntry[] {
  let result = logs
  if (errorOnly) {
    result = result.filter((l) => l.type === 'error' || l.type === 'warning')
  }
  const q = searchTerm.trim().toLowerCase()
  if (!q) return result
  return result.filter((l) => msc_logLineMatchesQuery(l, q))
}
