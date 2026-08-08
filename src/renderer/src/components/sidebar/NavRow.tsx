import type { ReactNode } from 'react'

export default function NavRow({
  icon,
  label,
  lit,
  current,
  expanded,
  menu,
  after,
  onClick
}: {
  icon: ReactNode
  label: string
  lit?: boolean
  current?: boolean
  expanded?: boolean
  menu?: boolean
  after?: ReactNode
  onClick: () => void
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-current={current ? 'page' : undefined}
        aria-expanded={expanded}
        aria-haspopup={menu ? 'menu' : undefined}
        className={`w-full rounded-xl py-1.5 pl-2 flex items-center gap-2 text-left text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.99] ${
          after ? 'pr-9' : 'pr-2'
        } ${
          lit
            ? 'bg-fg/[0.08] text-fg'
            : current
              ? 'text-fg hover:bg-fg/[0.06]'
              : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
        }`}
      >
        <span className={lit || current ? 'text-fg/70' : 'text-fg/45'}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
      </button>
      {after && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center">{after}</span>
      )}
    </div>
  )
}
