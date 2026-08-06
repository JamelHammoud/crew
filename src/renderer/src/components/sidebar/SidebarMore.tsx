import { useEffect, useRef, useState } from 'react'
import { CompassGlyph, SignalGlyph, ToolboxGlyph } from '../../icons'
import { playSound } from '../../media/sounds'
import { useBrowser } from '../../state/browser'
import { useHuddle } from '../../state/huddle'
import { useSidebar } from '../../state/sidebar'
import { MORE_TABS, MoreIcon, TAB_ICON, type Tab } from '../navTabs'
import { MenuItem, Popover } from '../Popover'
import Toolbox from '../Toolbox'
import { useHoverMenu, type Spot } from '../useHoverMenu'
import NavRow from './NavRow'

export default function SidebarMore({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const menu = useHoverMenu(rowRef)
  const holdRail = useSidebar(s => s.hold)
  const [toolbox, setToolbox] = useState<Spot | null>(null)
  const here = MORE_TABS.some(one => one.id === tab)
  const open = menu.open

  useEffect(() => {
    holdRail(open || toolbox !== null)
  }, [holdRail, open, toolbox])

  useEffect(() => () => holdRail(false), [holdRail])

  const press = () => {
    if (toolbox) {
      setToolbox(null)
      return
    }
    menu.press()
  }

  const openToolbox = () => {
    const at = menu.at
    menu.close()
    playSound('toolbox.open')
    setToolbox(at)
  }

  const openBrowser = () => {
    menu.close()
    useBrowser.getState().openPanel()
  }

  return (
    <div
      ref={rowRef}
      onPointerEnter={() => toolbox === null && menu.show()}
      onPointerLeave={menu.leave}
      className="relative"
    >
      <NavRow
        icon={<MoreIcon className={TAB_ICON} />}
        label="More"
        lit={here || open || toolbox !== null}
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
                icon={<one.Icon />}
                label={one.label}
                active={tab === one.id}
                onClick={() => {
                  menu.close()
                  onTab(one.id)
                }}
              />
            ))}
            <MenuItem icon={<CompassGlyph />} label="Browser" onClick={openBrowser} />
            <MenuItem icon={<ToolboxGlyph />} label="Toolbox" onClick={openToolbox} />
          </div>
        </Popover>
      )}
      <Toolbox
        open={toolbox !== null}
        at={toolbox ?? undefined}
        anchor={rowRef}
        onClose={() => setToolbox(null)}
      />
    </div>
  )
}
