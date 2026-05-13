/**
 * Runs in the client bundle before React hydration (Next.js 15+).
 * Registers before Next DevTools’ stitched-error handler so IPC/Event rejections
 * don’t surface as a full-screen `[object Event]` overlay in dev.
 */
import { msc_formatUnknownIPCError } from './lib/vpe-bridge'

if (typeof window !== 'undefined') {
  const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
    const msg = msc_formatUnknownIPCError(ev.reason)
    console.warn('[VPE] Unhandled rejection (instrumentation):', msg)
    ev.preventDefault()
    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation()
    }
  }
  window.addEventListener('unhandledrejection', onUnhandledRejection, {
    capture: true,
  })
}
