'use client'

/**
 * v1.8.5 — Grey desaturated equalizer bars (informational “health” glyph; non-interactive).
 */
export function VpeHealthEqualizerIcon({
  className = '',
  size = 16,
  title,
}: {
  className?: string
  /** Viewport box (square). */
  size?: number
  title?: string
}) {
  const w = size
  const h = size
  /** Relative bar heights (0–1), left → right — matches five-bar reference layout. */
  const bars = [0.28, 0.78, 0.52, 0.78, 0.92]
  const baseY = 12.5
  const maxH = 9
  const barW = 1.35
  const gap = 1.65
  const x0 = 2.4

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <line
        x1="2"
        y1={baseY}
        x2="14"
        y2={baseY}
        stroke="currentColor"
        strokeWidth="0.9"
        opacity={0.35}
      />
      {bars.map((rel, i) => {
        const bh = maxH * rel
        const x = x0 + i * (barW + gap)
        const y = baseY - bh
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={0.35}
            fill="currentColor"
            opacity={0.42 + i * 0.06}
          />
        )
      })}
    </svg>
  )
}
