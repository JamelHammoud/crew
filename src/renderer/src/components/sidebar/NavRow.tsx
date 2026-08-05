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
    <button
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      aria-expanded={expanded}
      aria-haspopup={menu ? 'menu' : undefined}
      className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.99] ${
        lit ? 'bg-fg/[0.08] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
      }`}
    >
      <span className={lit ? 'text-fg/70' : 'text-fg/45'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {after}
    </button>
  )
}
