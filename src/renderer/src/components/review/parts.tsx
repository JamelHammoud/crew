import type { ReactNode } from 'react'

export function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex h-7 items-center gap-2 px-1">
        <h3 className="text-xs font-medium text-fg-muted">{title}</h3>
        <span className="text-xs text-fg-faint">{count}</span>
        <span className="flex-1" />
        {children}
      </div>
    </section>
  )
}

export function SectionAction({
  label,
  onClick,
  danger
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-fg/[0.06] active:scale-95 ${
        danger ? 'text-danger' : 'text-fg-muted hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
}
