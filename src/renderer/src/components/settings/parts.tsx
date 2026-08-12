import type { ReactNode } from 'react'

// The pieces every settings page is built from. A page is a stack of sections,
// a section is a stack of rows, and a row is what it is called on the left and
// what you do about it on the right.
//
// Nothing here is set in a solid grey. The card floats over whatever the app
// happens to be showing, so the words take the foreground at an opacity and sit
// above the surface rather than beside it.

export function Page({ title, line, children }: { title: string; line?: string; children: ReactNode }) {
  return (
    <section className="px-8 pt-7 pb-10">
      <h2 className="text-lg font-semibold text-fg pr-10">{title}</h2>
      {line && <p className="mt-1 text-sm text-fg/45">{line}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// A section can carry one control on its title line, for the thing that is
// about the whole list rather than about any row in it. Standing in a row of its
// own underneath, it would need a label, and the only label there is to write is
// the button read back in longer words.
export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="pt-7 first:pt-0">
      {title && (
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <h3 className="text-sm font-semibold text-fg/45">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// A line under the label only where it says something the row cannot say on its
// own. Naming back what a person is already looking at is a row of type spent on
// nothing.
export function Row({
  label,
  line,
  bleed,
  children
}: {
  label: string
  line?: ReactNode
  // A row inside a card that holds its own padding, where the rule under it runs
  // edge to edge rather than stopping short of both sides.
  bleed?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-6 py-3.5 border-b border-fg/[0.06] last:border-b-0 ${
        bleed ? '-mx-6 px-6' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base text-fg">{label}</p>
        {line && <div className="text-sm text-fg/45 mt-0.5">{line}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  )
}

// A row whose right hand side is a plain fact rather than something to press.
// It takes the foreground at an opacity the way every other quiet word on the
// card does, and it is selectable because a fact is there to be copied.
export function Fact({ children }: { children: ReactNode }) {
  return <p className="text-base text-fg/45 select-text">{children}</p>
}

// A word to press and nothing around it, for a control that stands beside a
// section title rather than in a row. A pill up there would weigh more than the
// title it is standing next to.
export function Quiet({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 text-sm font-semibold text-fg/45 transition-colors hover:text-fg active:scale-95"
    >
      {label}
    </button>
  )
}

export function Danger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 px-4 rounded-full text-sm font-semibold text-danger bg-danger/10 transition-all duration-150 hover:bg-danger/20 active:scale-95"
    >
      {label}
    </button>
  )
}

export function Action({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold text-fg/70 bg-fg/[0.07] transition-all duration-150 hover:bg-fg/[0.12] hover:text-fg active:scale-95 disabled:opacity-40"
    >
      {icon && <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {label}
    </button>
  )
}
