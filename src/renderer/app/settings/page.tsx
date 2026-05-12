'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ToastProvider } from '@/components/vader-toast'
import { MscSystemMaintenanceTools } from '@/components/msc-system-maintenance-tools'
import { msc_mscEngineFooterLine } from '@/lib/vpe-bridge'

/** JEDI_MOD_29 — standalone maintenance surface (mirrors App Settings System Maintenance). */
function SettingsMaintenanceContent() {
  const engineFooterLine = msc_mscEngineFooterLine()
  return (
    <div className="min-h-screen bg-[#121212] vpe-theme-font text-[#eaeaea]">
      <header className="border-b border-[#2a2a2a] bg-[#121212] px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[#666666]">
              Vader Project Engine
            </p>
            <h1 className="mt-1 font-sans text-lg font-semibold tracking-tight text-white">
              Internal tools
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 self-start rounded border border-[#333333] bg-[#1c1c1c] px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-[#A0A0A0] transition-colors hover:border-[#555555] hover:text-white vader-focus sm:self-center"
          >
            <ArrowLeft size={14} className="shrink-0" aria-hidden />
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <MscSystemMaintenanceTools />
        <p
          className="msc-footer-engine-line mt-6 font-sans text-[11px] text-[#A0A0A0] transition-colors duration-200 hover:text-[color:var(--msc-accent)]"
          title={engineFooterLine}
        >
          {engineFooterLine}
        </p>
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsMaintenanceContent />
    </ToastProvider>
  )
}
