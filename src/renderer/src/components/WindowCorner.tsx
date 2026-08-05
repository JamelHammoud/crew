import { useEffect, useRef } from 'react'
import { PanelLeftGlyph } from '../icons'
import { useHeaderSlot } from '../state/headerSlot'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useFullScreen } from '../state/windowShape'
import CrewLogo from './CrewLogo'
import Tooltip from './Tooltip'
import { TOP_BAR_H } from './TopBar'

export default function WindowCorner() {
  const pinned = useSidebar(s => s.pinned)
  const peeking = useSidebar(s => s.peeking)
  const peek = useSidebar(s => s.peek)
  const toggle = useSidebar(s => s.toggle)
  const full = useFullScreen()
  const measure = useHeaderSlot(s => s.measure)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => measure('corner', el.clientWidth))
    observer.observe(el)
    measure('corner', el.clientWidth)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div
      ref={box}
      style={{ height: TOP_BAR_H, width: pinned ? SIDEBAR_W : undefined }}
      className="app-drag absolute top-0 left-0 z-[55] flex items-center px-6"
    >
      <span className={`flex h-full items-center ${full ? '' : 'mac:pl-[64px]'}`}>
        <span
          onMouseEnter={() => {
            if (pinned || peeking) peek(true)
          }}
          onMouseLeave={() => peek(false)}
          className="app-no-drag flex h-full items-center gap-2"
        >
          <CrewLogo />
          <Tooltip label={pinned ? 'Hide projects' : 'Projects'}>
            <button
              onClick={toggle}
              onMouseEnter={() => peek(true)}
              aria-label="Projects"
              aria-expanded={pinned}
              className="app-no-drag w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]"
            >
              <PanelLeftGlyph className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </span>
      </span>
    </div>
  )
}
