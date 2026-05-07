'use client'

import { RepairHistoryView, type RepairHistoryRow } from '@/components/repair-history-view'
import { PromptVaultPanel } from '@/components/prompt-vault-panel'

export type MaintenanceTab = 'logs' | 'vault'

interface MaintenanceSectionProps {
  maintenanceTab: MaintenanceTab
  onMaintenanceTab: (t: MaintenanceTab) => void
  repairLogRev: number
  onViewDiff: (row: RepairHistoryRow) => void
  onUndo: (repairId: string) => void
  onClearHistory?: () => void
  onRemoveEntry?: (repairId: string) => void
}

export function MaintenanceSection({
  maintenanceTab,
  onMaintenanceTab,
  repairLogRev,
  onViewDiff,
  onUndo,
  onClearHistory,
  onRemoveEntry,
}: MaintenanceSectionProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 px-6 pt-4 pb-2 flex gap-2 border-b border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => onMaintenanceTab('logs')}
          className={`h-8 px-4 rounded-t font-sans text-[11px] font-medium uppercase tracking-wide vader-focus transition-colors ${
            maintenanceTab === 'logs'
              ? 'bg-[#252525] text-white border border-b-0 border-[#333333]'
              : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          Repair Logs
        </button>
        <button
          type="button"
          onClick={() => onMaintenanceTab('vault')}
          className={`h-8 px-4 rounded-t font-sans text-[11px] font-medium uppercase tracking-wide vader-focus transition-colors ${
            maintenanceTab === 'vault'
              ? 'bg-[#252525] text-white border border-b-0 border-[#333333]'
              : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          Prompt Vault
        </button>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {maintenanceTab === 'logs' ? (
          <RepairHistoryView
            refreshSignal={repairLogRev}
            onViewDiff={onViewDiff}
            onUndo={onUndo}
            onClearHistory={onClearHistory}
            onRemoveEntry={onRemoveEntry}
          />
        ) : (
          <PromptVaultPanel />
        )}
      </div>
    </div>
  )
}
