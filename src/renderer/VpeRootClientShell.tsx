'use client'

import React, {
  Component,
  createContext,
  useContext,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'
import { getVpeApi, msc_formatUnknownIPCError } from '@/lib/vpe-bridge'
import {
  msc_applyVpeFontFamily,
  msc_normalizeFontStyle,
} from '@/lib/vpe-font-engine'

const VpeUiReadyContext = createContext(false)

/** True once the hydration shield lifts — modals defer body until then. */
export function useVpeUiReady(): boolean {
  return useContext(VpeUiReadyContext)
}

type ShellProps = { children: ReactNode }

/** Min time on shield so FOUCTailwind/fonts don’t flash through. Max caps stuck fonts API. */
const MIN_SHIELD_MS = 480
const MAX_SHIELD_MS = 15_000

class VpeRootErrorBoundary extends Component<
  ShellProps,
  { err: Error | null }
> {
  state: { err: Error | null } = { err: null }

  static getDerivedStateFromError(error: unknown) {
    return { err: new Error(msc_formatUnknownIPCError(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(
      '[VPE RootErrorBoundary]',
      msc_formatUnknownIPCError(error),
      info?.componentStack,
    )
  }

  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-[#eaeaea] p-8">
          <p className="text-[#e02b20] font-sans text-sm mb-3 tracking-wide uppercase">
            Shell recovered — non-fatal UI fault
          </p>
          <p className="text-[#c8c8c8] text-center max-w-lg mb-6 text-sm leading-relaxed">
            {this.state.err.message}
          </p>
          <p className="text-[#666666] text-center max-w-md mb-8 text-xs leading-relaxed">
            The dashboard boundary caught this so the app can keep running. If a control caused a
            React lifecycle warning, try again; use Reload if the surface stays stuck.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded border border-[#333] text-[#eaeaea] text-sm hover:border-[#4fde82]"
              onClick={() => this.setState({ err: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded border border-[#444] text-[#A0A0A0] text-sm hover:border-[#D1D5DB] hover:text-white"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload()
              }}
            >
              Reload shell
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function VpeUnhandledRejectionShield({ children }: ShellProps) {
  useEffect(() => {
    const captureOpts = { capture: true }
    const onRejection = (ev: PromiseRejectionEvent) => {
      const msg = msc_formatUnknownIPCError(ev.reason)
      console.warn('[VPE] Unhandled rejection (contained):', msg)
      ev.preventDefault()
    }
    window.addEventListener('unhandledrejection', onRejection, captureOpts)
    return () =>
      window.removeEventListener('unhandledrejection', onRejection, captureOpts)
  }, [])
  return children
}

function VpeHydrationShield({ children }: ShellProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const maxTimer = setTimeout(() => {
      if (!cancelled) setReady(true)
    }, MAX_SHIELD_MS)

    const finishShield = () => {
      if (cancelled) return
      clearTimeout(maxTimer)
      setReady(true)
    }

    void (async () => {
      const t0 = performance.now()
      try {
        if (typeof document !== 'undefined' && document.fonts?.ready) {
          await document.fonts.ready
        }
      } catch {
        /* fonts API optional */
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
      const elapsed = performance.now() - t0
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(0, MIN_SHIELD_MS - elapsed)),
      )
      finishShield()
    })()

    return () => {
      cancelled = true
      clearTimeout(maxTimer)
    }
  }, [])

  if (!ready) {
    return (
      <div
        className="fixed inset-0 z-[2147483646] flex flex-col items-center justify-center gap-5 bg-[#121212]"
        aria-busy="true"
        aria-label="VPE loading"
        suppressHydrationWarning
      >
        <Loader2
          className="h-12 w-12 shrink-0 text-cyan-400 animate-spin motion-reduce:animate-none motion-reduce:opacity-70"
          aria-hidden
          strokeWidth={2}
        />
        <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-cyan-300/85">
          VPE Shield
        </span>
      </div>
    )
  }

  return (
    <VpeUiReadyContext.Provider value={true}>
      <VpeTypographySync>{children}</VpeTypographySync>
    </VpeUiReadyContext.Provider>
  )
}

function VpeTypographySync({ children }: ShellProps) {
  useEffect(() => {
    const applyFromStore = () => {
      const api = getVpeApi()
      if (!api?.getAppSettings) {
        msc_applyVpeFontFamily(msc_normalizeFontStyle(undefined))
        return
      }
      void api.getAppSettings().then((s) => {
        msc_applyVpeFontFamily(msc_normalizeFontStyle(s.font_style))
      })
    }
    applyFromStore()
    if (typeof window === 'undefined') return
    const onSaved = () => applyFromStore()
    window.addEventListener('vpe:settings-saved', onSaved)
    return () => window.removeEventListener('vpe:settings-saved', onSaved)
  }, [])
  return children
}

export function VpeRootClientShell({ children }: ShellProps) {
  return (
    <VpeRootErrorBoundary>
      <VpeUnhandledRejectionShield>
        <VpeHydrationShield>{children}</VpeHydrationShield>
      </VpeUnhandledRejectionShield>
    </VpeRootErrorBoundary>
  )
}
