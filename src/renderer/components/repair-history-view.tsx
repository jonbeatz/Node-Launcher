'use client'

import { useState } from 'react'
import { FileText, Eye, Undo2, Search, Calendar } from 'lucide-react'

interface RepairLog {
  id: string
  date: string
  projectName: string
  filesChanged: number
  status: 'success' | 'partial' | 'failed'
  description: string
}

const SAMPLE_REPAIRS: RepairLog[] = [
  { id: '1', date: '2026-05-04 14:22:31', projectName: 'MSC_PRIMARY_GATE', filesChanged: 3, status: 'success', description: 'Suspense boundary auto-fix applied to page.tsx' },
  { id: '2', date: '2026-05-03 09:15:42', projectName: 'MEDIA_PRO_RENDER_V4', filesChanged: 1, status: 'success', description: 'Missing key prop added to list component' },
  { id: '3', date: '2026-05-02 18:30:11', projectName: 'MSC_PRIMARY_GATE', filesChanged: 5, status: 'partial', description: 'Dynamic import wrapper applied (2 manual fixes needed)' },
  { id: '4', date: '2026-05-01 11:45:00', projectName: 'VADER_BACKUP_NODE', filesChanged: 2, status: 'failed', description: 'Unable to resolve circular dependency' },
]

interface RepairHistoryViewProps {
  onViewDiff: (repairId: string) => void
  onUndo: (repairId: string) => void
}

export function RepairHistoryView({ onViewDiff, onUndo }: RepairHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

  const filteredRepairs = SAMPLE_REPAIRS.filter(repair => {
    if (searchTerm && !repair.projectName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 rounded-sm bg-[#00cc66]/20 text-[#00cc66] font-sans text-[10px]">SUCCESS</span>
      case 'partial':
        return <span className="px-2 py-0.5 rounded-sm bg-[#3daef2]/20 text-[#3daef2] font-sans text-[10px]">PARTIAL</span>
      case 'failed':
        return <span className="px-2 py-0.5 rounded-sm bg-[#333333]/40 text-[#777777] font-sans text-[10px]">FAILED</span>
      default:
        return null
    }
  }

  if (filteredRepairs.length === 0 && !searchTerm) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <FileText size={48} className="text-[#333333] mb-4" />
        <p className="font-sans text-[#A0A0A0] mb-1">No repairs performed yet</p>
        <p className="font-sans text-sm text-[#555555]">Repair operations will appear here</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#333333]">
        <h2 className="font-sans font-bold text-white text-lg mb-4">REPAIR HISTORY</h2>
        
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
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Date</th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Project</th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Files</th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Status</th>
              <th className="px-4 py-3 text-left font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Description</th>
              <th className="px-4 py-3 text-right font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.1em]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.map((repair, index) => (
              <tr 
                key={repair.id}
                className={`${index % 2 === 0 ? 'bg-[#121212]' : 'bg-[#1a1a1a]'} hover:bg-[#1c1c1c] transition-colors`}
              >
                <td className="px-4 py-3 font-sans text-[12px] text-[#555555]">{repair.date}</td>
                <td className="px-4 py-3 font-sans text-[13px] text-white font-medium">{repair.projectName}</td>
                <td className="px-4 py-3 font-sans text-[13px] text-[#A0A0A0]">{repair.filesChanged} files</td>
                <td className="px-4 py-3">{getStatusBadge(repair.status)}</td>
                <td className="px-4 py-3 font-sans text-[12px] text-[#A0A0A0] max-w-[300px] truncate">{repair.description}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewDiff(repair.id)}
                      className="flex items-center gap-1 px-3 h-6 rounded-sm border border-[#333333] font-sans text-[10px] text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all"
                    >
                      <Eye size={10} />
                      VIEW DIFF
                    </button>
                    <button
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
