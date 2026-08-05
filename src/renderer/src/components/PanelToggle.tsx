import { PanelRightGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import Badge from './Badge'
import { usePanelOpens } from './panelOpens'
import Tooltip from './Tooltip'

export default function PanelToggle({ className = '' }: { className?: string }) {
  const away = useBrowser(s => !s.open)
  const held = useBrowser(s => s.tabs.length > 0)
  const waiting = usePanelOpens().filter(row => row.scope === 'thread')

  if (!away || (!held && waiting.length === 0)) return null

  const show = () => {
    for (const row of [...waiting].reverse()) row.open()
    useBrowser.getState().openPanel()
  }

  return (
    <Tooltip label="Show panel" className={className}>
      <button
        onClick={show}
        aria-label="Show panel"
        className="app-no-drag relative w-10 h-10 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg-secondary hover:bg-fg/[0.04] active:scale-95"
      >
        <PanelRightGlyph className="w-[18px] h-[18px]" />
        {waiting.length > 0 && <Badge className="absolute top-1.5 right-1.5" />}
      </button>
    </Tooltip>
  )
}
