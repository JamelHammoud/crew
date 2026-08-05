import type { Editor } from '../canvas'
import { BoardSwitcher, DesignZoom } from './DesignPanels'
import HeaderSlot from './HeaderSlot'

export default function DesignHeader({ editor }: { editor: Editor | null }) {
  return (
    <HeaderSlot>
      <div className="flex items-center gap-1 min-w-0">
        <BoardSwitcher />
        {editor && <DesignZoom />}
      </div>
    </HeaderSlot>
  )
}
