import type { Editor } from '../canvas'
import { nameInset, namePull, toolsInset } from '../design/headerBand'
import { cornerRoom, useHeaderSlot } from '../state/headerSlot'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import type { DesignPanelsOpen } from './designPanelsOpen'
import { BoardSwitcher, DesignZoom } from './DesignPanels'
import HeaderSlot from './HeaderSlot'

export default function DesignHeader({ editor, panels }: { editor: Editor | null; panels: DesignPanelsOpen }) {
  const pinned = useSidebar(s => s.pinned)
  const corner = useHeaderSlot(s => s.corner)
  const own = useHeaderSlot(s => s.own)
  const open = { left: panels.left && !!editor, right: panels.right && !!editor }
  const offset = pinned ? SIDEBAR_W : 0

  return (
    <>
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
