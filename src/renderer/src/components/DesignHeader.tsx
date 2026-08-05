import type { Editor } from '../canvas'
import { bandColumns, nameInset, namePull, toolsInset } from '../design/headerBand'
import { cornerRoom, useHeaderSlot } from '../state/headerSlot'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import type { DesignPanelsOpen } from './designPanelsOpen'
import { BoardSwitcher, DesignZoom } from './DesignPanels'
import HeaderSlot from './HeaderSlot'

export default function DesignHeader({
  editor,
  panels
}: {
  editor: Editor | null
  panels: DesignPanelsOpen
}) {
  const pinned = useSidebar(s => s.pinned)
  const corner = useHeaderSlot(s => s.corner)
  const own = useHeaderSlot(s => s.own)
  const open = { left: panels.left && !!editor, right: panels.right && !!editor }
  const columns = bandColumns(open)
  const offset = pinned ? SIDEBAR_W : 0

  return (
    <>
      <HeaderSlot place="backdrop">
        <div data-design-band className="design flex h-full w-full">
          {columns.left > 0 && (
            <div
              data-design-band-left
              style={{ width: columns.left }}
              className="shrink-0 h-full bg-ink-900 border-r border-ink-700"
            />
          )}
          <div className="flex-1 min-w-0 h-full bg-[var(--design-canvas)]" />
          {columns.right > 0 && (
            <div
              data-design-band-right
              style={{ width: columns.right }}
              className="shrink-0 h-full bg-ink-900 border-l border-ink-700"
            />
          )}
        </div>
      </HeaderSlot>

      <HeaderSlot place="left">
        <div
          data-design-name
          style={{
            marginLeft: -namePull(open, corner, offset),
            paddingLeft: nameInset(open, cornerRoom(corner, offset))
          }}
          className="flex items-center min-w-0"
        >
          <BoardSwitcher />
        </div>
      </HeaderSlot>

      {editor && (
        <HeaderSlot place="right">
          <div data-design-tools style={{ paddingRight: toolsInset(open, own) }} className="flex items-center">
            <DesignZoom />
          </div>
        </HeaderSlot>
      )}
    </>
  )
}
