import type { ReactElement } from 'react'
import { badgeText } from '../../../shared/presence'

export default function Badge({
  count,
  rim = true,
  className = ''
}: {
  count?: number
  rim?: boolean
  className?: string
}): ReactElement | null {
  if (count !== undefined && count <= 0) return null
  const ring = rim ? 'ring-2 ring-ink-900' : ''
  if (count === undefined) return <span className={`w-2 h-2 rounded-full bg-fg ${ring} ${className}`} />
  return (
    <span
      className={`min-w-[18px] h-[18px] px-1 rounded-full bg-fg text-ink-900 text-xs font-bold flex items-center justify-center ${ring} ${className}`}
    >
      {badgeText(count)}
    </span>
  )
}
