import type { ReactNode } from 'react'

export default function Pill({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border ${
        solid ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-400'
      }`}
    >
      {children}
    </span>
  )
}
