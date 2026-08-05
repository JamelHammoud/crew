import { PanelRightGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import Badge from './Badge'
import { usePanelOpens } from './panelOpens'
import Tooltip from './Tooltip'

export default function PanelToggle({ className = '' }: { className?: string }) {
  const away = useBrowser(s => !s.open)
  const held = useBrowser(s => s.tabs.length > 0)
  const waiting = usePanelOpens().filter(row => row.scope === 'thread')
  const stands = away && (held || waiting.length > 0)

  const show = () => {
    for (const row of [...waiting].reverse()) row.open()
    useBrowser.getState().openPanel()
  }

  return (
    <div
      aria-hidden={!stands}
      className={`shrink-0 overflow-hidden transition-all ease-out ${
        stands ? 'w-10 opacity-100 translate-x-0 duration-200' : 'w-0 opacity-0 translate-x-2 pointer-events-none duration-150'
      } ${className}`}
    >
      <Tooltip label="Show panel">
        <button
          onClick={show}
          tabIndex={stands ? undefined : -1}
          aria-label="Show panel"
          className="app-no-drag relative w-10 h-10 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg-secondary hover:bg-fg/[0.04] active:scale-95"
        >
          <span className="relative flex">
            <PanelRightGlyph className="w-[18px] h-[18px]" />
            {waiting.length > 0 && <Badge className="absolute -top-[7px] -right-[7px]" />}
          </span>
        </button>
      </Tooltip>
    </div>
  )
}
