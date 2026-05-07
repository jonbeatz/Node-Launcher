'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileText, Eye, Undo2, Search, Calendar } from 'lucide-react'
import { format, isAfter, parseISO, subDays } from 'date-fns'
import { getVpeApi, type VpeRepairRunRow, type VpeRepairRunStatus } from '@/lib/vpe-bridge'

export interface RepairHistoryRow {
  id: string
  date: string
  projectId: string
  projectName: string
  filesChanged: number
  status: VpeRepairRunStatus
  description: string
  createdAtIso: string
}

interface RepairHistoryViewProps {
  /** Increment after a repair is recorded so the list refetches. */
  refreshSignal?: number
  onViewDiff: (repair: RepairHistoryRow) => void
  onUndo: (repairId: string) => void
  onClearHistory?: () => void
}

function formatRepairDate(iso: string): string {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, 'yyyy-MM-dd HH:mm')
  } catch {
    return iso
  }
}

export function RepairHistoryView({
  refreshSignal = 0,
  onViewDiff,
  onUndo,
  onClearHistory,
}: RepairHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [rows, setRows] = useState<RepairHistoryRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(
    () => typeof window !== 'undefined' && Boolean(getVpeApi()?.getRepairRuns),
  )

  useEffect(() => {
    let cancelled = false
    const api = getVpeApi()
    if (!api?.getRepairRuns) {
      if (!cancelled) {
        setRows([])
        setLoadError(null)
        setLoading(false)
      }
      return
    }
    ;(async () => {
      try {
        setLoadError(null)
        setLoading(true)
        const raw: VpeRepairRunRow[] = await api.getRepairRuns!(200)
        if (cancelled) return
        const mapped: RepairHistoryRow[] = (raw ?? []).map((r) => {
          const st: VpeRepairRunStatus =
            r.status === 'partial' || r.status === 'failed' || r.status === 'success'
              ? r.status
              : 'success'
          return {
            id: r.id,
            date: formatRepairDate(r.created_at),
            projectId: r.project_id,
            projectName: r.project_name?.trim() || r.project_id,
            filesChanged: Number(r.files_changed) || 0,
            status: st,
            description: r.description || '',
            createdAtIso: r.created_at,
          }
        })
        setRows(mapped)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setLoadError(e instanceof Error ? e.message : 'Failed to load repair history')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  const filteredRepairs = useMemo(() => {
    const cutoff =
      dateFilter === '7d'
        ? subDays(new Date(), 7)
        : dateFilter === '30d'
          ? subDays(new Date(), 30)
          : null

    return rows.filter((repair) => {
      if (searchTerm && !repair.projectName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      if (cutoff) {
        const d = parseISO(repair.createdAtIso)
        if (Number.isNaN(d.getTime()) || !isAfter(d, cutoff)) return false
      }
      return true
    })
  }, [rows, searchTerm, dateFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded-sm bg-[#00cc66]/20 text-[#00cc66] font-sans text-[10px]">
            SUCCESS
          </span>
        )
      case 'partial':
        return (
          <span className="px-2 py-0.5 rounded-sm bg-[#3daef2]/20 text-[#3daef2] font-sans text-[10px]">
            PARTIAL
          </span>
        )
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded-sm bg-[#333333]/40 text-[#777777] font-sans text-[10px]">
            FAILED
          </span>
        )
      default:
        return null
    }
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <FileText size={48} className="text-[#333333] mb-4" />
        <p className="font-sans text-[#e02b20] mb-1 text-center">{loadError}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <FileText size={48} className="text-[#333333] mb-4 animate-pulse" />
        <p className="font-sans text-[#A0A0A0] text-center">Loading repair history…</p>
      </div>
    )
  }

  if (!getVpeApi()?.getRepairRuns) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <FileText size={48} className="text-[#333333] mb-4" />
        <p className="font-sans text-[#A0A0A0] mb-1 text-center">Repair history unavailable</p>
        <p className="font-sans text-sm text-[#555555] text-center max-w-md">
          Open the app in Electron to load persisted repair runs from the main process.
        </p>
      </div>
    )
  }

  if (filteredRepairs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <FileText size={48} className="text-[#333333] mb-4" />
        <p className="font-sans text-[#A0A0A0] mb-1 text-center">
          {searchTerm || dateFilter !== 'all' ? 'No matching repairs' : 'No repairs performed yet'}
        </p>
        <p className="font-sans text-sm text-[#555555] text-center max-w-md">
          {searchTerm || dateFilter !== 'all'
            ? 'Try another filter or project name.'
            : 'Apply a fix from the repair modal to record a run here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-white text-lg mb-1">REPAIR HISTORY</h2>
          <p className="text-[11px] text-[#555555] uppercase tracking-wider font-medium">Maintenance Engine v1.0.8</p>
        </div>
        {onClearHistory && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-transparent border border-[#e02b20]/30 text-[#e02b20] hover:bg-[#e02b20]/10 font-sans text-[11px] font-medium transition-all"
          >
            CLEAR HISTORY
          </button>
        )}
      </div>

      <div className="px-6 py-4 bg-[#0d0d0d] border-b border-[#333333]">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project name..."
              className="w-full pl-9 pr-4 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#4fde82]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#555555]" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 rounded bg-[#0a0a0a] border border-[#333333] font-sans text-sm text-white focus:outline-none focus:border-[#4fde82]"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-[#161616] border-b border-[#333333] sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Date
              </th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Project
              </th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Files
              </th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Status
              </th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Description
              </th>
              <th className="px-4 py-3 text-right font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((repair, index) => (
              <tr
                key={repair.id}
                className={`${index % 2 === 0 ? 'bg-[#121212]' : 'bg-[#1a1a1a]'} hover:bg-[#1c1c1c] transition-colors`}
              >
                <td className="px-4 py-3 font-sans text-[12px] text-[#555555]">{repair.date}</td>
                <td className="px-4 py-3 font-sans text-[13px] text-white font-medium">
                  {repair.projectName}
                </td>
                <td className="px-4 py-3 font-sans text-[13px] text-[#A0A0A0]">
                  {repair.filesChanged} files
                </td>
                <td className="px-4 py-3">{getStatusBadge(repair.status)}</td>
                <td className="px-4 py-3 font-sans text-[12px] text-[#A0A0A0] max-w-[300px] truncate">
                  {repair.description}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDiff(repair)}
                      className="flex items-center gap-1 px-3 h-6 rounded-sm border border-[#333333] font-sans text-[10px] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all"
                    >
                      <Eye size={10} />
                      VIEW DIFF
                    </button>
                    <button
                      type="button"
                      onClick={() => onUndo(repair.id)}
                      disabled={repair.status === 'failed'}
                      className="flex items-center gap-1 px-3 h-6 rounded-sm border border-[#333333] font-sans text-[10px] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Undo2 size={10} />
                      UNDO
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
