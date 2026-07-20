import type { ReactNode } from 'react'

export default function Pill({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
        solid ? 'bg-fg text-ink-900' : 'bg-white/[0.06] text-fg-muted'
      }`}
    >
      {children}
    </span>
  )
}
