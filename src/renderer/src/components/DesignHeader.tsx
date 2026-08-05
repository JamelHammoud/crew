import type { Editor } from '../canvas'
import { PanelLeftGlyph, PanelRightGlyph } from '../icons'
import { HeaderButton } from './DesignControls'
import { BoardSwitcher, DesignZoom } from './DesignPanels'
import HeaderSlot from './HeaderSlot'

const GLYPH = 'w-[18px] h-[18px] transition-transform duration-200'

export interface DesignPanelsOpen {
  left: boolean
  right: boolean
}

export default function DesignHeader({
  editor,
  panels,
  onPanels
}: {
  editor: Editor | null
  panels: DesignPanelsOpen
  onPanels: (next: (value: DesignPanelsOpen) => DesignPanelsOpen) => void
}) {
  return (
    <HeaderSlot>
      <div className="flex items-center gap-1 min-w-0">
        <HeaderButton
          label={panels.left ? 'Hide layers' : 'Show layers'}
          pressed={panels.left}
          onClick={() => onPanels(value => ({ ...value, left: !value.left }))}
        >
          <PanelLeftGlyph className={`${GLYPH} ${panels.left ? '' : 'scale-x-[-1]'}`} />
        </HeaderButton>
        <BoardSwitcher />
        {editor && <DesignZoom />}
        <HeaderButton
          label={panels.right ? 'Hide board panel' : 'Show board panel'}
          pressed={panels.right}
          onClick={() => onPanels(value => ({ ...value, right: !value.right }))}
        >
          <PanelRightGlyph className={`${GLYPH} ${panels.right ? '' : 'scale-x-[-1]'}`} />
        </HeaderButton>
      </div>
    </HeaderSlot>
  )
}
