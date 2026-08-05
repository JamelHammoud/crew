import type { ReactNode } from 'react'
import { PanelLeftGlyph, PanelRightGlyph } from '../icons'
import Tooltip from './Tooltip'

export function HeaderButton({
  label,
  pressed,
  disabled,
  onClick,
  children
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={pressed}
        className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 enabled:hover:text-fg-secondary enabled:hover:bg-fg/[0.04] enabled:active:scale-95 disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}

// A panel is put away from inside itself, and the mark says which side it
// stands on, so the same button reads as the way out of either one.
export function HidePanel({ side, onClose }: { side: 'left' | 'right'; onClose: () => void }) {
  const Glyph = side === 'left' ? PanelLeftGlyph : PanelRightGlyph
  return (
    <PanelButton label="Hide panel" onClick={onClose}>
      <Glyph className="w-4 h-4" />
    </PanelButton>
  )
}

export function PanelButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-all enabled:active:scale-95 disabled:opacity-25 ${
          active ? 'bg-fg text-ink-900' : 'text-fg-muted enabled:hover:text-fg enabled:hover:bg-fg/[0.06]'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}
