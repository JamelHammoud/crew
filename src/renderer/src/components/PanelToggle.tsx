import { PanelRightGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import Tooltip from './Tooltip'

export default function PanelToggle() {
  const open = useBrowser(s => s.open)
  const any = useBrowser(s => s.tabs.length > 0)
  const label = open ? 'Hide panel' : 'Show panel'

  if (!any) return null

  return (
    <Tooltip label={label}>
      <button
        onClick={() => useBrowser.getState().togglePanel()}
        aria-label={label}
        aria-expanded={open}
        className={`app-no-drag w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
          open ? 'bg-fg/[0.10] text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
        }`}
      >
        <PanelRightGlyph className="w-[18px] h-[18px]" />
      </button>
    </Tooltip>
  )
}
