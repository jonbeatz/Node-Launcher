'use client'

import { useEffect } from 'react'
import { msc_formatUnknownIPCError } from '@/lib/vpe-bridge'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[VPE app/error]', msc_formatUnknownIPCError(error))
  }, [error])

  const msg =
    typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : msc_formatUnknownIPCError(error)

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-[#eaeaea] p-8">
      <p className="text-[#e02b20] font-sans text-sm mb-3 tracking-wide uppercase">
        Route error (recovered surface)
      </p>
      <p className="text-[#c8c8c8] text-center max-w-lg mb-6 text-sm leading-relaxed">
        {msg}
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          className="px-4 py-2 rounded border border-[#333] text-sm hover:border-[#4fde82]"
          onClick={() => reset()}
        >
          Try again
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded border border-[#444] text-sm text-[#A0A0A0] hover:border-[#D1D5DB] hover:text-white"
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
