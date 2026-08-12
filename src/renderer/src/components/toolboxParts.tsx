import type { ReactNode } from 'react'
import { ChevronLeftGlyph } from '../icons'

// The toolbox is a builder rather than chrome, so it is set on its own two
// radii: a tile is softer than the fields under it, and both are squarer than
// the pills the rest of the app wears.
export const FIELD =
  'w-full h-9 px-3 rounded-field bg-fg/[0.06] text-sm text-fg placeholder:text-fg/25 outline-none transition-colors focus:bg-fg/[0.09]'

export function Rule() {
  return <div className="h-px bg-fg/[0.06]" />
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="block mb-1.5 px-0.5 text-xs font-medium text-fg/45">{children}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  )
}

// Every screen the toolbox holds wears the same bar: a way back where there is
// one, the name of the screen, and whatever that screen can do on the right.
export function SheetHeader({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <>
      <header className={`h-12 pr-2 flex items-center gap-1 ${onBack ? 'pl-1.5' : 'pl-3.5'}`}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-8 h-8 shrink-0 rounded-field flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-fg hover:bg-fg/[0.08] active:scale-95"
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

// The one bar every screen ends on, with what it does held against the bottom
// of the sheet rather than floating after the last field.
export function Footer({ children }: { children: ReactNode }) {
  return (
    <>
      <Rule />
      <div className="p-2.5">{children}</div>
    </>
  )
}

export function Primary({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-9 rounded-field text-sm font-semibold transition-all duration-150 ${
        disabled ? 'bg-fg/[0.06] text-fg/25' : 'bg-fg text-ink-900 hover:bg-fg/90 active:scale-[0.98]'
      }`}
    >
      {label}
    </button>
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
    <div className="flex rounded-field bg-fg/[0.06] p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex-1 h-8 rounded-[7px] text-xs font-semibold transition-colors ${
            value === option.value ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// One tile: a tool in the toolbox, built in or built here. Lit white while the
// thing it opens is live, filled quietly the rest of the time, and barely there
// when it is the empty slot at the end waiting to be filled.
export function Tile({
  mark,
  name,
  active,
  ghost,
  onClick,
  children
}: {
  mark: ReactNode
  name: string
  active?: boolean
  ghost?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const look = ghost
    ? 'bg-fg/[0.02] text-fg/35 hover:bg-fg/[0.06] hover:text-fg'
    : active
      ? 'bg-fg text-ink-900'
      : 'bg-fg/[0.05] text-fg/70 hover:bg-fg/[0.09] hover:text-fg'
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`w-full h-[76px] px-1.5 rounded-tile flex flex-col items-center justify-center gap-2 transition-all duration-150 active:scale-95 ${look}`}
      >
        {mark}
        <span className="w-full truncate text-center text-xs font-medium leading-none">{name}</span>
      </button>
      {children}
    </div>
  )
}
