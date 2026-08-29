import { useEffect, useRef, useState } from 'react'
import { PinGlyph, PopOutGlyph } from '../../icons'
import { useSidebar } from '../../state/sidebar'
import { setSidebarPinned, type SidebarItemId } from '../../state/sidebarPins'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Toolbox from '../Toolbox'
import { useHoverMenu } from '../useHoverMenu'
import { TAB_ICON, type Tab } from '../navTabs'
import NavRow from './NavRow'
import { openSidebarItem, openSidebarItemWindow, sidebarItemOpensWindow } from './sidebarItemAction'
import type { SidebarItem } from './sidebarItems'

export default function SidebarPinnedItem({
  item,
  tab,
  onTab
}: {
  item: SidebarItem
  tab: Tab
  onTab: (tab: Tab) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const toolbox = useHoverMenu(rowRef)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const holdRail = useSidebar(s => s.hold)
  const current = item.id === tab

  useEffect(() => {
    holdRail(toolbox.open || menuAt !== null)
  }, [holdRail, menuAt, toolbox.open])

  useEffect(() => () => holdRail(false), [holdRail])

  const unpin = (id: SidebarItemId) => {
    setMenuAt(null)
    setSidebarPinned(id, false)
  }

  return (
    <div ref={rowRef} className="relative">
      <NavRow
        icon={<item.Icon className={TAB_ICON} />}
        label={item.label}
        lit={current}
        current={current}
        expanded={item.id === 'toolbox' ? toolbox.open : undefined}
        menu={item.id === 'toolbox'}
        onClick={() => openSidebarItem(item.id, onTab, toolbox.press)}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
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
                openSidebarItemWindow(item.id)
              }}
            />
            <MenuDivider />
          </>
        )}
        <MenuItem icon={<PinGlyph />} label="Unpin from sidebar" onClick={() => unpin(item.id)} />
      </Popover>
      <Toolbox open={toolbox.open} at={toolbox.at ?? undefined} anchor={rowRef} onClose={toolbox.close} />
    </div>
  )
}
