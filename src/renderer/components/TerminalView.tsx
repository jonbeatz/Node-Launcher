'use client'

/**
 * JEDI_MOD_26 — Version line for log chrome: use `msc_mscEngineFooterLine()` from `@/lib/vpe-bridge`
 * (`window.vpeInfo.version` from preload). Parent `log-drawer` renders docked/detached footers.
 */

import type { RefObject } from 'react'
import { Search, X, Filter, Trash2, ChevronDown } from 'lucide-react'
import type { LogEntry } from '@/store/logStore'
import { msc_stripAnsiDisplay, msc_logLineMatchesQuery } from '@/store/logStore'

function msc_escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type Seg = { k: string; t: 'plain' | 'err' | 'q'; s: string }

function msc_segmentMessage(msg: string, query: string): Seg[] {
  let segs: Seg[] = [{ k: '0', t: 'plain', s: msg }]
  const q = query.trim()
  if (q) {
    const reQ = new RegExp(`(${msc_escapeRegExp(q)})`, 'gi')
    segs = msc_applySegSplit(segs, 'q', reQ)
  }
  const reE = /(error)/gi
  segs = msc_applySegSplit(segs, 'err', reE)
  return segs
}

function msc_applySegSplit(segs: Seg[], type: Seg['t'], re: RegExp): Seg[] {
  const out: Seg[] = []
  let k = 0
  for (const seg of segs) {
    if (seg.t !== 'plain') {
      out.push(seg)
      continue
    }
    const parts = seg.s.split(re)
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (p === undefined || p === '') continue
      const isCap = i % 2 === 1
      out.push({
        k: `${k++}`,
        t: isCap ? type : 'plain',
        s: p,
      })
    }
  }
  return out
}

function msc_getLogColor(type: string): string {
  switch (type) {
    case 'system':
      return 'text-[#00cc66]'
    case 'error':
      return 'text-[#e02b20]'
    case 'warning':
      return 'text-[#3daef2]'
    case 'command':
      return 'text-[#00cc66]'
    case 'output':
      return 'text-[#d1d5db]'
    default:
      return 'text-[#d1d5db]'
  }
}

function MscHighlightedInline({ text, searchTerm }: { text: string; searchTerm: string }) {
  const segs = msc_segmentMessage(text, searchTerm)
  return (
    <>
      {segs.map((seg) => {
        if (seg.t === 'err') {
          return (
            <span
              key={seg.k}
              className="rounded px-0.5 bg-[#e02b20]/12 text-[#fca5a5]"
            >
              {seg.s}
            </span>
          )
        }
        if (seg.t === 'q') {
          return (
            <mark
              key={seg.k}
              className="rounded px-0.5 bg-[color:color-mix(in_srgb,var(--msc-accent)_22%,transparent)] text-inherit [text-decoration:none]"
            >
              {seg.s}
            </mark>
          )
        }
        return <span key={seg.k}>{seg.s}</span>
      })}
    </>
  )
}

export interface TerminalViewProps {
  logs: LogEntry[]
  filteredLogs: LogEntry[]
  searchTerm: string
  onSearchTermChange: (value: string) => void
  errorOnly: boolean
  onToggleErrorOnly: () => void
  onClear: () => void
  terminalRef: RefObject<HTMLDivElement | null>
  onTerminalScroll: () => void
  showJumpButton: boolean
  onJumpToBottom: () => void
  logFontPx: number
  /** Extra classes for scroll viewport (e.g. docked `left-1` gutter). */
  scrollViewportClassName: string
  onTerminalBodyClick?: () => void
}

export function TerminalView({
  logs,
  filteredLogs,
  searchTerm,
  onSearchTermChange,
  errorOnly,
  onToggleErrorOnly,
  onClear,
  terminalRef,
  onTerminalScroll,
  showJumpButton,
  onJumpToBottom,
  logFontPx,
  scrollViewportClassName,
  onTerminalBodyClick,
}: TerminalViewProps) {
  const total = logs.length
  const shown = filteredLogs.length
  const statusLabel =
    searchTerm.trim() || errorOnly
      ? `Showing ${shown}/${total} lines`
      : `${shown} line${shown === 1 ? '' : 's'}`

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#333333] bg-[#1c1c1c] px-3 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#555555]"
            size={14}
            aria-hidden
          />
          <input
            type="search"
            autoComplete="off"
            placeholder="Filter logs…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full rounded border border-[#333333] bg-[#121212] py-1 pl-8 pr-8 text-xs text-[#e5e5e5] placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[var(--msc-accent)] focus:ring-offset-0"
            aria-label="Search and filter log lines"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
        <div
          className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-[#a3a3a3]"
          title="Visible lines vs total buffer"
        >
          {statusLabel}
        </div>
        <button
          type="button"
          onClick={onToggleErrorOnly}
          className={`shrink-0 rounded p-1.5 transition-all ${
            errorOnly
              ? 'bg-[#e02b20]/20 text-[#e02b20]'
              : 'text-[#A0A0A0] hover:bg-[#252525] hover:text-white'
          }`}
          title="Errors & warnings only"
        >
          <Filter size={14} />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex shrink-0 items-center gap-1.5 rounded border border-[#333333] bg-[#121212] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#e5e5e5] transition-colors hover:border-[#e02b20]/55 hover:bg-[#e02b20]/12 hover:text-white"
          title="Clear log buffer for this tab"
        >
          <Trash2 size={13} className="opacity-80" aria-hidden />
          Clear
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={terminalRef}
          onScroll={onTerminalScroll}
          className={`vpe-system-log-viewport vpe-terminal-scrollbar absolute z-10 max-h-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#121212] pl-10 pr-4 py-4 ${scrollViewportClassName}`}
          style={{ opacity: 1 }}
          onClick={onTerminalBodyClick}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div
            className="relative z-30 min-w-0 space-y-0.5 overflow-x-hidden text-[#d1d5db]"
            style={{ fontSize: logFontPx }}
          >
            {filteredLogs.map((log) => {
              const msg = msc_stripAnsiDisplay(log.message)
              const q = searchTerm.trim().toLowerCase()
              const rowMatch = !!q && msc_logLineMatchesQuery(log, q)

              return (
                <div
                  key={log.id}
                  className={`flex min-w-0 leading-relaxed ${
                    rowMatch ? 'rounded-sm bg-[color:color-mix(in_srgb,var(--msc-accent)_12%,transparent)]' : ''
                  }`}
                >
                  {log.time ? (
                    <span className="mr-2 shrink-0 select-none text-[#525252]">[{log.time}]</span>
                  ) : null}
                  {log.label ? (
                    <span className={`${msc_getLogColor(log.type)} mr-1 shrink-0`}>
                      <MscHighlightedInline text={log.label} searchTerm={searchTerm} />
                    </span>
                  ) : null}
                  <span
                    className={
                      log.type === 'command' ? 'text-white' : msc_getLogColor(log.type)
                    }
                  >
                    <MscHighlightedInline text={msg} searchTerm={searchTerm} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {showJumpButton ? (
          <button
            type="button"
            onClick={onJumpToBottom}
            className="absolute bottom-4 right-6 z-40 flex items-center gap-1.5 rounded-full border border-[#404040] bg-[#1c1c1c]/95 px-3 py-1.5 text-[11px] font-medium text-[#d4d4d4] shadow-lg backdrop-blur-sm transition-colors hover:border-[var(--msc-accent)]/40 hover:bg-[#252525] hover:text-white"
          >
            <ChevronDown size={14} className="text-[var(--msc-accent)]" aria-hidden />
            ↓ New logs
          </button>
        ) : null}
      </div>
    </>
  )
}

export { msc_mscEngineFooterLine, msc_getVpeShippedVersion } from '@/lib/vpe-bridge'
