import { useRef, useState } from 'react'
import { MORE_TABS, type Tab } from '../navTabs'
import { MenuItem, Popover } from '../Popover'
import TabIcon, { MoreTabIcon } from '../TabIcon'

export default function SidebarMore({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const here = MORE_TABS.some(one => one.id === tab)

  const show = () => {
    const rect = rowRef.current?.getBoundingClientRect()
    if (!rect) return
    setAt({ x: rect.right + 6, y: rect.top - 6 })
    setOpen(true)
  }

  return (
    <div
      ref={rowRef}
      onPointerEnter={show}
      onPointerLeave={() => setOpen(false)}
      className="relative"
    >
      <button
        onClick={show}
        aria-current={here ? 'page' : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.99] ${
          here || open ? 'bg-fg/[0.08] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
        }`}
      >
        <span className={here || open ? 'text-fg/70' : 'text-fg/45'}>
          <MoreTabIcon size={18} />
        </span>
        More
      </button>
      {open && at && (
        <Popover open onClose={() => setOpen(false)} at={at} className="min-w-44">
          {MORE_TABS.map(one => (
            <MenuItem
              key={one.id}
              icon={<TabIcon tab={one.id} size={16} />}
              label={one.label}
              active={tab === one.id}
              onClick={() => {
                setOpen(false)
                onTab(one.id)
              }}
            />
          ))}
        </Popover>
      )}
    </div>
  )
}
