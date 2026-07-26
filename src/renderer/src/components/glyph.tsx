import type { ComponentType, ReactNode } from 'react'

export type Glyph = ComponentType<{ className?: string; strokeWidth?: number }>

// A stroke does not scale with the icon. Worn small, 1.5 on a 24 grid comes out
// under a pixel and the mark goes grey, so a small one is drawn heavier and a
// large one lighter. The weight is the drawing's own and the prop is the wear.
export function glyph(art: ReactNode, weight = 1.5): Glyph {
  return function CrewGlyph({
    className = 'w-4 h-4',
    strokeWidth = weight
  }: {
    className?: string
    strokeWidth?: number
  }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {art}
      </svg>
    )
  }
}
