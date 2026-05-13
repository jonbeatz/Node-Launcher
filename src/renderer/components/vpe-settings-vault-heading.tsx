'use client'

/** v1.8.9 — Prompt Vault–style accordion title + subtitle for App / Project Settings. */
export function VpeSettingsVaultHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left pr-3">
      <span className="font-sans text-sm font-semibold leading-snug tracking-tight text-white">
        {title}
      </span>
      <span className="font-sans text-xs font-normal leading-relaxed text-[#888888]">
        {subtitle}
      </span>
    </span>
  )
}
