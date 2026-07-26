import type { ReactNode } from 'react'
import { ChevronLeftGlyph } from '../icons'
import Tooltip from './Tooltip'

export const FIELD =
  'w-full h-9 px-3.5 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg/25 outline-none transition-colors focus:bg-fg/[0.1]'

export const AREA =
  'w-full px-3.5 py-2 rounded-2xl bg-fg/[0.06] text-sm leading-5 text-fg placeholder:text-fg/25 outline-none transition-colors resize-none focus:bg-fg/[0.1] [scrollbar-width:none]'

export function Rule() {
  return <div className="h-px bg-fg/[0.06]" />
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="block mb-1.5 px-1 text-xs text-fg/45">{children}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  )
}

export function HeaderButton({
  label,
  danger,
  onClick,
  children
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-all duration-150 active:scale-95 ${
          danger ? 'hover:text-danger hover:bg-danger/10' : 'hover:text-fg hover:bg-fg/[0.06]'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

// Every screen the toolbox holds wears the same bar: a way back where there is
// one, the name of the screen, and whatever that screen can do on the right.
export function SheetHeader({
  title,
  onBack,
  children
}: {
  title: string
  onBack?: () => void
  children?: ReactNode
}) {
  return (
    <>
      <header className={`h-12 pr-2.5 flex items-center gap-1 ${onBack ? 'pl-1.5' : 'pl-4'}`}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
          >
            <ChevronLeftGlyph className="w-4 h-4" />
          </button>
        )}
        <h3 className="flex-1 text-sm font-semibold text-fg">{title}</h3>
        {children}
      </header>
      <Rule />
    </>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-full bg-fg/[0.06] p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex-1 h-8 rounded-full text-xs font-semibold transition-colors ${
            value === option.value ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// One tile, whatever is behind it: a tool in the toolbox, or the kind of thing a
// tool being built will do. Lit white while it is the thing chosen, filled
// quietly when it is waiting, barely there when it cannot be pressed. A tile
// that is not ready yet says so on hover rather than wearing a label, and it
// warms from the group, since a disabled button never matches its own hover.
export function Tile({
  mark,
  name,
  active,
  soon,
  onClick,
  children
}: {
  mark: ReactNode
  name: string
  active?: boolean
  soon?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const look = soon
    ? 'bg-fg/[0.03] text-fg/30 group-hover:bg-fg/[0.06] group-hover:text-fg/50'
    : active
      ? 'bg-fg text-ink-900'
      : 'bg-fg/[0.05] text-fg/70 hover:bg-fg/[0.09] hover:text-fg'
  return (
    <div className="group relative">
      <Tooltip label="Coming soon" disabled={!soon} className="w-full">
        <button
          onClick={onClick}
          disabled={soon}
          aria-pressed={active}
          className={`w-full h-[82px] px-1.5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 enabled:active:scale-95 disabled:cursor-default ${look}`}
        >
          {mark}
          <span className="w-full truncate text-center text-xs font-medium leading-none">{name}</span>
        </button>
      </Tooltip>
      {children}
    </div>
  )
}
