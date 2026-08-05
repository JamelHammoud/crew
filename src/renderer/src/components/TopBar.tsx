import { useEffect, useRef, useState } from 'react'
import { cornerRoom, HEADER_EDGE, useHeaderSlot } from '../state/headerSlot'
import { openSettings, useSettings } from '../state/settings'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import Avatar from './Avatar'
import PanelToggle from './PanelToggle'
import PresenceStack from './PresenceStack'
import Tooltip from './Tooltip'
import UpdatePill from './UpdatePill'

export const TOP_BAR_H = 70

const COMPACT_WIDTH = 760

export default function TopBar() {
  const connection = useCrew(s => s.connection)
  const selfName = useCrew(s => s.selfName)
  const settingsOpen = useSettings() !== null
  const pinned = useSidebar(s => s.pinned)
  const hold = useHeaderSlot(s => s.hold)
  const corner = useHeaderSlot(s => s.corner)
  const measure = useHeaderSlot(s => s.measure)
  const headerRef = useRef<HTMLElement>(null)
  const ownRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setCompact(el.clientWidth <= COMPACT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = ownRef.current
    if (!el) return
    const observer = new ResizeObserver(() => measure('own', el.clientWidth))
    observer.observe(el)
    measure('own', el.clientWidth)
    return () => observer.disconnect()
  }, [measure])

  return (
    <header
      ref={headerRef}
      style={{ height: TOP_BAR_H, paddingLeft: HEADER_EDGE, paddingRight: HEADER_EDGE }}
      className="top-bar app-drag relative grid grid-cols-[1fr_auto_1fr] items-center shrink-0"
    >
      <div ref={hold.backdrop} className="absolute inset-0 pointer-events-none" />

      <div
        ref={hold.left}
        style={{ paddingLeft: cornerRoom(corner, pinned ? SIDEBAR_W : 0) }}
        className="app-no-drag relative flex items-center min-w-0"
      />

      <div ref={hold.center} className="app-no-drag relative flex items-center justify-center" />

      <div className={`col-start-3 relative flex items-center justify-end ${compact ? 'gap-1' : 'gap-2'}`}>
        <div ref={hold.right} className="app-no-drag flex items-center" />
        <div ref={ownRef} className={`app-no-drag flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
          {connection === 'reconnecting' && (
            <span className="text-xs text-fg-muted animate-pulse mr-1">Connection lost. Trying again…</span>
          )}
          <UpdatePill />
          <PresenceStack compact={compact} />
          {/* Your face is the way into the settings. Everything a menu here used
              to hold has a page of its own now, so the press goes straight to it
              rather than through a list of the same things. */}
          <Tooltip label="Settings" disabled={settingsOpen}>
            <button
              onClick={() => openSettings()}
              aria-label="Settings"
              className={`flex rounded-full transition-all duration-150 hover:ring-2 hover:ring-fg/15 active:scale-95 ${
                settingsOpen ? 'ring-2 ring-fg/25' : ''
              }`}
            >
              <Avatar name={selfName || '?'} presence={connection === 'online' ? 'online' : 'offline'} />
            </button>
          </Tooltip>
          <PanelToggle className="-mr-2" />
        </div>
      </div>
    </header>
  )
}
