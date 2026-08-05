import { useEffect, useRef } from 'react'
import { useSidebar } from '../../state/sidebar'
import { MORE_TABS, type Tab } from '../navTabs'
import { MenuItem, Popover } from '../Popover'
import TabIcon, { MoreTabIcon } from '../TabIcon'
import { useHoverMenu } from '../useHoverMenu'

export default function SidebarMore({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const menu = useHoverMenu(rowRef)
  const holdRail = useSidebar(s => s.hold)
  const here = MORE_TABS.some(one => one.id === tab)
  const open = menu.open

  useEffect(() => {
    holdRail(open)
  }, [holdRail, open])

  useEffect(() => () => holdRail(false), [holdRail])

  return (
    <div ref={rowRef} onPointerEnter={menu.show} onPointerLeave={menu.leave} className="relative">
      <button
        onClick={menu.press}
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
      {open && menu.at && (
        <Popover open onClose={menu.close} at={menu.at} anchor={rowRef} flush className="min-w-44">
          <div className="p-1.5" onPointerEnter={menu.hold} onPointerLeave={menu.leave}>
            {MORE_TABS.map(one => (
              <MenuItem
                key={one.id}
                icon={<TabIcon tab={one.id} size={16} />}
                label={one.label}
                active={tab === one.id}
                onClick={() => {
                  menu.close()
                  onTab(one.id)
                }}
              />
            ))}
          </div>
        </Popover>
      )}
    </div>
  )
}
