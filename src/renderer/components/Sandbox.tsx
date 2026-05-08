'use client'

import { useState } from 'react'
import { LiveProvider, LiveError, LivePreview } from 'react-live'
import { themes } from 'prism-react-renderer'
import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const DEFAULT_SNIPPET = `() => (
  <div className="p-6 rounded-lg border border-neutral-700 bg-neutral-900 text-white max-w-md">
    <p className="text-sm font-semibold text-[#c8c8c8]">VPE Sandbox</p>
    <p className="text-xs text-[#A0A0A0] mt-2">
      Paste a v0.dev-style function component. Tailwind classes from the host app apply inside the preview.
    </p>
  </div>
)`

/** v1.3.5 — Strategist + Engineer tabs each use Radix Accordion for steps; live preview unchanged. */
export function Sandbox() {
  const [code, setCode] = useState(DEFAULT_SNIPPET)

  const tabListClass =
    'inline-flex h-9 w-full max-w-md items-center justify-start rounded-lg border border-[#333333] bg-[#1c1c1c] p-[3px] gap-0.5'
  const tabTriggerClass =
    'flex-1 rounded-md px-3 py-1.5 font-sans text-xs font-medium text-[#A0A0A0] transition-colors border border-transparent hover:text-white hover:bg-[#2a2a2a] data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-white data-[state=active]:border-[#333333] data-[state=active]:shadow-none focus-visible:ring-1 focus-visible:ring-[#555555]/50'

  const accordItem =
    'border border-[#333333] bg-[#161616] rounded-md overflow-hidden last:border-b'
  const accordTrigger =
    'px-3 py-2.5 hover:bg-[#2a2a2a] hover:no-underline text-left font-sans text-sm text-white [&>svg]:text-[#888888]'
  const accordBody = 'px-3 pb-3 pt-0 text-xs text-[#A0A0A0] leading-relaxed font-sans border-t border-[#2a2a2a]'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4 gap-4">
      <Tabs defaultValue="strategist" className="w-full shrink-0 gap-3">
        <TabsList className={tabListClass}>
          <TabsTrigger value="strategist" className={tabTriggerClass}>
            Strategist
          </TabsTrigger>
          <TabsTrigger value="engineer" className={tabTriggerClass}>
            Engineer
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="strategist"
          className="mt-0 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-3"
        >
          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="step-prime" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 1: The Brain Bank (Prime)
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 pb-1">
                  <strong className="text-[#c8c8c8]">Instruction:</strong> Open the{' '}
                  <strong className="text-white">Prompt Vault</strong> (Maintenance → Prompt Vault).
                  Copy your <strong className="text-white">Vader Build Protocol</strong> or{' '}
                  <strong className="text-white">E2E Snippet</strong>.
                </p>
                <p>
                  <strong className="text-[#c8c8c8]">Goal:</strong> Give Cursor / v0 the rules they need so
                  they do not ship generic, broken code.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="step-preview" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 2: The Audition (Preview)
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 pb-1">
                  <strong className="text-[#c8c8c8]">Instruction:</strong> Paste the code your AI generated
                  into the <strong className="text-white">Source</strong> panel below, then watch{' '}
                  <strong className="text-white">Live preview</strong> update beside it.
                </p>
                <p>
                  <strong className="text-[#c8c8c8]">Goal:</strong> See the new UI instantly without touching
                  your production site or repo files (e.g. your live marketing / portfolio tree).
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="step-ship" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 3: The Ship (Deploy)
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 pb-1">
                  <strong className="text-[#c8c8c8]">Instruction:</strong> When the preview matches what you
                  want, copy from the Sandbox and paste into the real file in Cursor.
                </p>
                <p>
                  <strong className="text-[#c8c8c8]">Goal:</strong> Total safety — you only ship code you have
                  already seen working here.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
        <TabsContent
          value="engineer"
          className="mt-0 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-3"
        >
          <p className="text-[10px] text-[#888888] uppercase tracking-[0.12em] mb-2 font-sans">
            Technical workflow
          </p>
          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="eng-1" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 1: Vault Entry
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 font-sans text-xs text-[#A0A0A0] leading-relaxed">
                  Store complex build directives or CLI commands in the Vault (Maintenance → Prompt
                  Vault).
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="eng-2" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 2: One-Click Copy
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 font-sans text-xs text-[#A0A0A0] leading-relaxed">
                  Use <strong className="text-white">Prime AI Assistant</strong> on a vault row to
                  pull a Master Directive into your clipboard.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="eng-3" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 3: AI Prime
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 font-sans text-xs text-[#A0A0A0] leading-relaxed">
                  Paste into Cursor, Gemini, or your assistant to align on Vader Protocol / MSC build
                  standards.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="eng-4" className={accordItem}>
              <AccordionTrigger className={accordTrigger}>
                Step 4: Sandbox Staging
              </AccordionTrigger>
              <AccordionContent className={accordBody}>
                <p className="pt-2 font-sans text-xs text-[#A0A0A0] leading-relaxed">
                  Use this page to experiment with UI components before committing them to the main
                  Tactical Dashboard.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      <p className="font-sans text-[10px] text-[#A0A0A0] uppercase tracking-[0.12em] shrink-0">
        VPE Sandbox — Studio Dark preview (#121212)
      </p>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-4">
        <div className="flex-1 flex flex-col min-h-[200px] min-w-0 rounded border border-[#333333] overflow-hidden bg-[#121212]">
          <div className="px-2 py-1 border-b border-[#2a2a2a] font-sans text-[10px] text-[#666666] uppercase">
            Source
          </div>
          <textarea
            className="flex-1 min-h-[160px] w-full bg-[#0d0d0d] text-[#e0e0e0] font-mono text-xs p-3 resize-none outline-none focus:ring-1 focus:ring-[#555555]/50"
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
        Preview executes in-process for layout checks only; do not paste untrusted code from
        unknown sources.
      </p>
    </div>
  )
}
