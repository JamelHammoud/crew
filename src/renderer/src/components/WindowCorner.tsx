import { PanelLeftGlyph } from '../icons'
import { useSidebar } from '../state/sidebar'
import { useFullScreen } from '../state/windowShape'
import CrewLogo from './CrewLogo'
import Tooltip from './Tooltip'
import { TOP_BAR_H } from './TopBar'

export default function WindowCorner() {
  const pinned = useSidebar(s => s.pinned)
  const peek = useSidebar(s => s.peek)
  const toggle = useSidebar(s => s.toggle)
  const full = useFullScreen()

  return (
    <div
      style={{ height: TOP_BAR_H }}
      className="app-drag absolute top-0 left-0 z-[55] flex items-center px-6"
    >
      <span className={`flex items-center gap-2 ${full ? '' : 'mac:pl-[64px]'}`}>
        <CrewLogo />
        <Tooltip label={pinned ? 'Hide projects' : 'Projects'}>
          <button
            onClick={toggle}
            onMouseEnter={() => peek(true)}
            onMouseLeave={() => peek(false)}
            aria-label="Projects"
            aria-expanded={pinned}
            className={`app-no-drag w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
              pinned ? 'bg-fg/[0.10] text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
            }`}
          >
            <PanelLeftGlyph className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
      </span>
    </div>
  )
}
