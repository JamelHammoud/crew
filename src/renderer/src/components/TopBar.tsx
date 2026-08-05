import { useEffect, useRef, useState } from 'react'
import { CheckCircleGlyph } from '../icons'
import { playSound } from '../media/sounds'
import { reviewCount } from '../state/alerts'
import { openSettings, useSettings } from '../state/settings'
import { useCrew } from '../state/store'
import { tasksShowing, useTasks } from '../state/tasks'
import Avatar from './Avatar'
import Badge from './Badge'
import PanelToggle from './PanelToggle'
import PresenceStack from './PresenceStack'
import Toolbox from './Toolbox'
import ToolboxMark from './ToolboxMark'
import Tooltip from './Tooltip'
import UpdatePill from './UpdatePill'
import type { NavTab, Tab } from './navTabs'

export type { NavTab, Tab }

export const TOP_BAR_H = 70

const COMPACT_WIDTH = 760

export default function TopBar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const connection = useCrew(s => s.connection)
  const selfName = useCrew(s => s.selfName)
  const waiting = useCrew(reviewCount)
  const settingsOpen = useSettings() !== null
  const tasksOpen = useTasks(tasksShowing)
  const toggleTasks = useTasks(s => s.toggle)
  const peekTasks = useTasks(s => s.peek)
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setCompact(el.clientWidth <= COMPACT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header
      ref={headerRef}
      style={{ height: TOP_BAR_H }}
      className="top-bar app-drag relative flex items-center px-6 shrink-0"
    >
      <div className={`app-no-drag ml-auto flex items-center justify-end ${compact ? 'gap-1' : 'gap-2'}`}>
        {connection === 'reconnecting' && (
          <span className="text-xs text-fg-muted animate-pulse mr-1">Connection lost. Trying again…</span>
        )}
        <UpdatePill />
        <div className="flex items-center gap-0.5">
          <div className="relative flex items-center">
            <Tooltip label="Toolbox" disabled={toolboxOpen}>
              <button
                onClick={() => {
                  if (!toolboxOpen) playSound('toolbox.open')
                  setToolboxOpen(open => !open)
                }}
                aria-label="Toolbox"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
                  toolboxOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
                }`}
              >
                <ToolboxMark open={toolboxOpen} />
              </button>
            </Tooltip>
            <Toolbox
              open={toolboxOpen}
              onClose={() => setToolboxOpen(false)}
              onChat={() => {
                if (tab !== 'chat') onTab('chat')
              }}
            />
          </div>
          <Tooltip label="Tasks" disabled={tasksOpen}>
            <button
              onClick={toggleTasks}
              onMouseEnter={() => peekTasks(true)}
              onMouseLeave={() => peekTasks(false)}
              aria-label="Tasks"
              aria-expanded={tasksOpen}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
                tasksOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
              }`}
            >
              <CheckCircleGlyph className="w-[22px] h-[22px]" />
              <Badge count={waiting} className="absolute top-0 right-0" />
            </button>
          </Tooltip>
        </div>
        {!compact && <span className="w-px h-5 bg-fg/[0.07] mr-[9px]" />}
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
        {tab === 'chat' && <PanelToggle className="-mr-2" />}
      </div>
    </header>
  )
}
