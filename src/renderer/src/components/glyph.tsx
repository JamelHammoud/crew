import type { ComponentType, ReactNode } from 'react'

export type Glyph = ComponentType<{ className?: string }>

export function glyph(art: ReactNode, weight = 1.5): Glyph {
  return function CrewGlyph({ className = 'w-4 h-4' }: { className?: string }) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {art}
      </svg>
    )
  }
}
