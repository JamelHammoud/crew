import type { ReactElement } from 'react'

export const badgeCount = (count: number): string => (count > 9 ? '9+' : String(count))

export default function Badge({
  count,
  className = ''
}: {
  count: number
  className?: string
}): ReactElement | null {
  if (count <= 0) return null
  return (
    <span
      className={`min-w-[18px] h-[18px] px-1 rounded-full bg-fg text-ink-900 text-xs font-bold flex items-center justify-center ring-2 ring-ink-900 ${className}`}
    >
      {badgeCount(count)}
    </span>
  )
}
