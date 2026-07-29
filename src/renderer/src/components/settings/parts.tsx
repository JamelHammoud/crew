import type { ReactNode } from 'react'

// The pieces every settings page is built from. A page is a stack of sections,
// a section is a stack of rows, and a row is what it is called on the left and
// what you do about it on the right.
//
// Nothing here is set in a solid grey. The card floats over whatever the app
// happens to be showing, so the words take the foreground at an opacity and sit
// above the surface rather than beside it.

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-8 pt-7 pb-10">
      <h2 className="text-lg font-semibold text-fg pr-10">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="pt-7 first:pt-0">
      {title && <h3 className="text-sm font-semibold text-fg/45 mb-1.5">{title}</h3>}
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
  children
}: {
  label: string
  line?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-6 py-3.5 border-b border-fg/[0.06] last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-base text-fg">{label}</p>
        {line && <div className="text-sm text-fg/45 mt-0.5">{line}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
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
