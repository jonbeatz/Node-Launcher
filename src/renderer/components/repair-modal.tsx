'use client'
import { X, RotateCcw, Check, Loader2 } from 'lucide-react'

interface RepairModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: () => void
  onUndo: () => void
}

const ORIGINAL_CODE = `export default function Page() {
  const data = fetchData()
  
  return (
    <div>
      <h1>Dashboard</h1>
      <DataTable data={data} />
    </div>
  )
}`

const PATCHED_CODE = `import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<Loading />}>
        <DataTable />
      </Suspense>
    </div>
  )
}`

export function RepairModal({ isOpen, onClose, onApply, onUndo }: RepairModalProps) {
  const isScanning = false
  const scanComplete = true // For demo, start with scan complete

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-[85vw] max-w-[900px] max-h-[85vh] overflow-hidden bg-[#1c1c1c] border border-[#333333] rounded">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333]">
          <div>
            <h2 className="font-sans font-bold text-white text-lg">VADER REPAIR</h2>
            <span className="font-sans text-xs text-[#A0A0A0]">src/app/page.tsx</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-[#A0A0A0] hover:text-[#e02b20] transition-colors vader-focus"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scanning State */}
        {isScanning && (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 size={32} className="text-[#e02b20] animate-spin mb-4" />
            <span className="font-sans text-sm text-[#A0A0A0]">Scanning project for Suspense boundaries...</span>
            <div className="w-48 h-1 bg-[#333333] rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-[#e02b20] animate-pulse" style={{ width: '60%' }} />
            </div>
            <span className="font-sans text-xs text-[#555555] mt-2">Checking 14 files...</span>
          </div>
        )}

        {/* Diff Viewer */}
        {scanComplete && !isScanning && (
          <div className="flex min-h-[400px]">
            {/* Original */}
            <div className="flex-1 border-r border-[#333333] flex flex-col">
              <div className="px-4 py-2.5 bg-[#0a0a0a] border-b border-[#333333]">
                <span className="font-sans text-[11px] text-[#A0A0A0] uppercase">
                  ORIGINAL <span className="text-[#555555]">(.vader-backup)</span>
                </span>
              </div>
              <div className="flex-1 bg-[#0a0a0a] p-3 overflow-auto">
                <pre className="font-sans text-[13px] leading-relaxed">
                  {ORIGINAL_CODE.split('\n').map((line, i) => {
                    const isRemoved = line.includes('fetchData') || line.includes('DataTable data=')
                    return (
                      <div 
                        key={i} 
                        className={`flex ${isRemoved ? 'bg-[#ff4444]/15 border-l-2 border-[#ff4444] -ml-3 pl-2.5' : ''}`}
                      >
                        <span className="w-8 text-[#555555] select-none text-right pr-3 shrink-0">{i + 1}</span>
                        <span className={isRemoved ? 'text-[#ff4444]' : 'text-[#A0A0A0]'}>
                          {line || ' '}
                        </span>
                      </div>
                    )
                  })}
                </pre>
              </div>
            </div>

            {/* Patched */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2.5 bg-[#0a0a0a] border-b border-[#333333]">
                <span className="font-sans text-[11px] text-[#A0A0A0] uppercase">
                  PATCHED <span className="text-[#00cc66]">(vader-fix-suspense)</span>
                </span>
              </div>
              <div className="flex-1 bg-[#0a0a0a] p-3 overflow-auto">
                <pre className="font-sans text-[13px] leading-relaxed">
                  {PATCHED_CODE.split('\n').map((line, i) => {
                    const isAdded = line.includes('Suspense') || line.includes('fallback')
                    return (
                      <div 
                        key={i} 
                        className={`flex ${isAdded ? 'bg-[#00cc66]/15 border-l-2 border-[#00cc66] -ml-3 pl-2.5' : ''}`}
                      >
                        <span className="w-8 text-[#555555] select-none text-right pr-3 shrink-0">{i + 1}</span>
                        <span className={isAdded ? 'text-[#00cc66]' : 'text-[#A0A0A0]'}>
                          {line || ' '}
                        </span>
                      </div>
                    )
                  })}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#333333]">
          <span className="font-sans text-xs text-[#A0A0A0]">
            3 files affected, 12 lines added, 4 lines removed
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onUndo}
              className="h-9 px-4 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#4fde82] transition-all vader-focus flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              UNDO LAST FIX
            </button>
            <button
              onClick={onClose}
              className="h-9 px-4 rounded border border-[#333333] font-sans text-sm text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-all vader-focus"
            >
              CANCEL
            </button>
            <button
              onClick={onApply}
              className="h-9 px-5 rounded bg-[#4fde82] hover:bg-[#3fcf72] font-sans text-sm font-medium text-black transition-colors vader-focus flex items-center gap-2"
            >
              <Check size={14} />
              APPLY FIX
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
