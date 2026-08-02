import { PanelRightGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import Tooltip from './Tooltip'

export default function PanelToggle() {
  const away = useBrowser(s => !s.open && s.tabs.length > 0)

  if (!away) return null

  return (
    <Tooltip label="Show panel">
      <button
        onClick={() => useBrowser.getState().openPanel()}
        aria-label="Show panel"
        className="app-no-drag w-10 h-10 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg-secondary hover:bg-fg/[0.04] active:scale-95"
      >
        <PanelRightGlyph className="w-[18px] h-[18px]" />
      </button>
    </Tooltip>
  )
}
