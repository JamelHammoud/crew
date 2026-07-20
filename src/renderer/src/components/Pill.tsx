import type { ReactNode } from 'react'

export default function Pill({ children, solid, lg }: { children: ReactNode; solid?: boolean; lg?: boolean }) {
  return (
    <span
      className={`font-medium rounded-full transition-colors ${lg ? 'text-xs px-2.5 py-1.5' : 'text-[11px] px-2 py-0.5'} ${
        solid ? 'bg-fg text-ink-900' : 'bg-white/[0.06] text-fg-muted'
      }`}
    >
      {children}
    </span>
  )
}
