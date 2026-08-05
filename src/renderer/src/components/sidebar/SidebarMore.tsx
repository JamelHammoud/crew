import { useEffect, useRef, useState } from 'react'
import { ToolboxGlyph } from '../../icons'
import { playSound } from '../../media/sounds'
import { useSidebar } from '../../state/sidebar'
import { MORE_TABS, type Tab } from '../navTabs'
import { MenuItem, Popover } from '../Popover'
import TabIcon, { MoreTabIcon } from '../TabIcon'
import Toolbox from '../Toolbox'
import { useHoverMenu } from '../useHoverMenu'
import NavRow from './NavRow'

export default function SidebarMore({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const menu = useHoverMenu(rowRef)
  const holdRail = useSidebar(s => s.hold)
  const [toolbox, setToolbox] = useState(false)
  const here = MORE_TABS.some(one => one.id === tab)
  const open = menu.open

  useEffect(() => {
    holdRail(open || toolbox)
  }, [holdRail, open, toolbox])

  useEffect(() => () => holdRail(false), [holdRail])

  // The toolbox stands off this row, so the row is the way in and the way back
  // out: hovering it while the toolbox is up would open a menu over the panel it
  // just opened, and pressing it puts that panel away rather than standing a
  // second card on top of it.
  const press = () => {
    if (toolbox) {
      setToolbox(false)
      return
    }
    menu.press()
  }

  const openToolbox = () => {
    menu.close()
    playSound('toolbox.open')
    setToolbox(true)
  }

  return (
    <div
      ref={rowRef}
      onPointerEnter={() => !toolbox && menu.show()}
      onPointerLeave={menu.leave}
      className="relative"
    >
      <NavRow
        icon={<MoreTabIcon size={18} />}
        label="More"
        lit={here || open || toolbox}
        current={here}
        expanded={open}
        menu
        onClick={press}
      />
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
            <MenuItem icon={<ToolboxGlyph />} label="Toolbox" onClick={openToolbox} />
          </div>
        </Popover>
      )}
      <Toolbox open={toolbox} onClose={() => setToolbox(false)} />
    </div>
  )
}
