import { PanelLeftGlyph, PanelRightGlyph } from '../icons'
import Tooltip from './Tooltip'

// One button for the state you are not in. A panel that is up is put away from
// inside itself, so nothing stands here until there is a panel to ask back.
export default function DesignPanelBack({
  side,
  label,
  onOpen
}: {
  side: 'left' | 'right'
  label: string
  onOpen: () => void
}) {
  const Glyph = side === 'left' ? PanelLeftGlyph : PanelRightGlyph
  return (
    <Tooltip label={label} className={`absolute top-3 z-20 ${side === 'left' ? 'left-3' : 'right-3'}`}>
      <button
        onClick={onOpen}
        aria-label={label}
        className="glass glass-strong w-9 h-9 rounded-full flex items-center justify-center text-fg/70 transition-all duration-150 hover:text-fg active:scale-95"
      >
        <Glyph className="w-[18px] h-[18px] scale-x-[-1]" />
      </button>
    </Tooltip>
  )
}
