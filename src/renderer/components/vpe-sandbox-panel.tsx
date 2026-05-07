'use client'

import { useState } from 'react'
import { LiveProvider, LiveError, LivePreview } from 'react-live'
import { themes } from 'prism-react-renderer'
import * as React from 'react'

const DEFAULT_SNIPPET = `() => (
  <div className="p-6 rounded-lg border border-neutral-700 bg-neutral-900 text-white max-w-md">
    <p className="text-sm font-semibold text-[#4fde82]">VPE Sandbox</p>
    <p className="text-xs text-[#A0A0A0] mt-2">
      Paste a v0.dev-style function component. Tailwind classes from the host app apply inside the preview.
    </p>
  </div>
)`

export function VpeSandboxPanel() {
  const [code, setCode] = useState(DEFAULT_SNIPPET)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4 gap-3">
      <p className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.12em] shrink-0">
        VPE Sandbox — Studio Dark preview (#121212)
      </p>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-4">
        <div className="flex-1 flex flex-col min-h-[200px] min-w-0 rounded border border-[#333333] overflow-hidden bg-[#121212]">
          <div className="px-2 py-1 border-b border-[#2a2a2a] font-sans text-[10px] text-[#666666] uppercase">
            Source
          </div>
          <textarea
            className="flex-1 min-h-[160px] w-full bg-[#0d0d0d] text-[#e0e0e0] font-mono text-xs p-3 resize-none outline-none focus:ring-1 focus:ring-[#4fde82]/40"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="() => ( <div /> )"
          />
        </div>
        <div className="flex-1 flex flex-col min-h-[200px] min-w-0 rounded border border-[#333333] overflow-hidden bg-[#121212]">
          <div className="px-2 py-1 border-b border-[#2a2a2a] font-sans text-[10px] text-[#666666] uppercase">
            Live preview
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 bg-[#121212]">
            <LiveProvider code={code} scope={{ React }} theme={themes.nightOwl}>
              <LivePreview className="[&_*]:text-inherit" />
              <LiveError className="font-mono text-xs text-red-400 mt-2 whitespace-pre-wrap" />
            </LiveProvider>
          </div>
        </div>
      </div>
      <p className="font-sans text-[10px] text-[#555555] shrink-0">
        Preview executes in-process for layout checks only; do not paste untrusted code from unknown sources.
      </p>
    </div>
  )
}
