import { useEffect, useRef, useState } from 'react'
import { PinGlyph, PopOutGlyph } from '../../icons'
import { playSound } from '../../media/sounds'
import { useSidebar } from '../../state/sidebar'
import { setSidebarPinned, useSidebarPins } from '../../state/sidebarPins'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Toolbox from '../Toolbox'
import { useHoverMenu, type Spot } from '../useHoverMenu'
import { MoreIcon, TAB_ICON, type Tab } from '../navTabs'
import NavRow from './NavRow'
import { openSidebarItem, openSidebarItemWindow, sidebarItemOpensWindow } from './sidebarItemAction'
import { itemTab, SIDEBAR_ITEMS, type SidebarItem } from './sidebarItems'

function MoreItem({
  item,
  tab,
  close,
  onTab,
  onToolbox
}: {
  item: SidebarItem
  tab: Tab
  close: () => void
  onTab: (tab: Tab) => void
  onToolbox: () => void
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      <MenuItem
        icon={<item.Icon />}
        label={item.label}
        active={itemTab(item.id) === tab}
        onClick={() => {
          close()
          openSidebarItem(item.id, onTab, onToolbox)
        }}
      />
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-40">
        {sidebarItemOpensWindow(item.id) && (
          <>
            <MenuItem
              icon={<PopOutGlyph />}
              label="Open in new window"
              onClick={() => {
                setMenuAt(null)
                close()
                openSidebarItemWindow(item.id)
              }}
            />
            <MenuDivider />
          </>
        )}
        <MenuItem
          icon={<PinGlyph />}
          label="Pin to sidebar"
          onClick={() => {
            setMenuAt(null)
            setSidebarPinned(item.id, true)
          }}
        />
      </Popover>
    </div>
  )
}

export default function SidebarMore({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const menu = useHoverMenu(rowRef)
  const holdRail = useSidebar(s => s.hold)
  const pinned = useSidebarPins()
  const [toolbox, setToolbox] = useState<Spot | null>(null)
  const unpinned = SIDEBAR_ITEMS.filter(item => !pinned.includes(item.id))
  const panelItems = unpinned.filter(item => ['files', 'review', 'terminal', 'web'].includes(item.id))
  const crewItems = unpinned.filter(item => !panelItems.includes(item))
  const here = unpinned.some(item => itemTab(item.id) === tab)
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
            {panelItems.map(item => (
              <MoreItem
                key={item.id}
                item={item}
                tab={tab}
                close={menu.close}
                onTab={onTab}
                onToolbox={openToolbox}
              />
            ))}
            {panelItems.length > 0 && crewItems.length > 0 && <MenuDivider />}
            {crewItems.map(item => (
              <MoreItem
                key={item.id}
                item={item}
                tab={tab}
                close={menu.close}
                onTab={onTab}
                onToolbox={openToolbox}
              />
            ))}
          </div>
        </Popover>
      )}
      <Toolbox open={toolbox !== null} at={toolbox ?? undefined} anchor={rowRef} onClose={() => setToolbox(null)} />
    </div>
  )
}
