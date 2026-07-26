import type { ReactNode } from 'react'
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

export function PanelTabs<T extends string>({
  tabs,
  current,
  onPick
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>
  current: T
  onPick: (id: T) => void
}) {
  return (
    <div className="flex-1 min-w-0 flex gap-0.5 rounded-full bg-fg/[0.05] p-0.5">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onPick(tab.id)}
          aria-pressed={current === tab.id}
          className={`flex-1 min-w-0 h-7 rounded-full text-xs font-semibold transition-colors ${
            current === tab.id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
