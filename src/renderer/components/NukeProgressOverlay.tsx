'use client'

import { X } from 'lucide-react'

const DEFAULT_LAUNCHER_PORT = 3000

interface NukeProgressOverlayProps {
  open: boolean
  projectName: string
  /** Configured managed app port (shown in verify step). */
  projectPort: number
  launcherPort?: number
  logLines: string[]
  onDismiss: () => void
}

export function NukeProgressOverlay({
  open,
  projectName,
  projectPort,
  launcherPort = DEFAULT_LAUNCHER_PORT,
  logLines,
  onDismiss,
}: NukeProgressOverlayProps) {
  if (!open) return null

  const blob = logLines.join('\n')
  const killDone = /\[nuke:stage\] kill_done/.test(blob)
  const purgeDone = /\[nuke:stage\] purge_done/.test(blob)
  const installStarted = /\[nuke:stage\] install_started/.test(blob)
  const installExit = /\[nuke:stage\] install_exit/.test(blob)
  const installOk = /\[nuke:stage\] install_exit code=0/.test(blob)
  const verifyDone =
    /\[nuke:stage\] verify_health_result /.test(blob) ||
    /\[nuke:stage\] verify_health_skipped/.test(blob)

  type Row = { id: string; label: string; state: 'pending' | 'running' | 'done' | 'error' }
  const rows: Row[] = [
    {
      id: 'kill',
      label: 'Stop PM2 / kill tree',
      state: killDone ? 'done' : 'running',
    },
    {
      id: 'purge',
      label: 'Purge node_modules & .next',
      state: purgeDone ? 'done' : killDone ? 'running' : 'pending',
    },
    {
      id: 'install',
      label: 'Dependency install',
      state: installExit ? (installOk ? 'done' : 'error') : installStarted ? 'running' : 'pending',
    },
    {
      id: 'verify',
      label: `Verify HTTP on port ${projectPort} (launcher UI ${launcherPort})`,
      state: verifyDone ? 'done' : installOk && installExit ? 'running' : 'pending',
    },
  ]

  const badge = (s: Row['state']) => {
    switch (s) {
      case 'done':
        return <span className="text-[#4fde82] font-mono text-[10px]">done</span>
      case 'running':
        return <span className="text-[#ffcc00] font-mono text-[10px]">running…</span>
      case 'error':
        return <span className="text-[#e02b20] font-mono text-[10px]">failed</span>
      default:
        return <span className="text-[#555555] font-mono text-[10px]">pending</span>
    }
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-lg border border-[#333333] bg-[#1c1c1c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#333333] px-4 py-3">
          <div>
            <h2 className="font-sans text-sm font-semibold text-white">NUKE PROTOCOL</h2>
            <p className="font-sans text-[11px] text-[#A0A0A0]">{projectName}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1.5 text-[#A0A0A0] hover:bg-[#252525] hover:text-white"
            title="Dismiss (operations continue in background)"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2 border-b border-[#333333] px-4 py-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 font-sans text-[12px] text-[#d0d0d0]"
            >
              <span>{r.label}</span>
              {badge(r.state)}
            </li>
          ))}
        </ul>

        <div className="min-h-[160px] flex-1 overflow-y-auto bg-[#0a0a0a] p-3 font-mono text-[10px] leading-relaxed text-[#888888]">
          {logLines.length === 0 ? (
            <span className="text-[#555555]">Waiting for engine output…</span>
          ) : (
            logLines.slice(-80).map((line, i) => (
              <div key={`${i}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
