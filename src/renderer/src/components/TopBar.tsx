import {
  ArrowRightStartOnRectangleIcon,
  CheckIcon,
  LinkIcon,
  MoonIcon,
  SignalIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  SunIcon
} from '@heroicons/react/16/solid'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import { playSound } from '../media/sounds'
import { reviewCount } from '../state/alerts'
import { useHuddle } from '../state/huddle'
import { setSounds, useSounds } from '../state/sound'
import { useCrew } from '../state/store'
import { applyTheme, useTheme } from '../state/theme'
import Avatar from './Avatar'
import { CrewMark } from './CrewMark'
import Pill from './Pill'
import TabIcon from './TabIcon'
import Tooltip from './Tooltip'
import { MenuItem, Popover } from './Popover'

export type Tab = 'chat' | 'agents' | 'docs' | 'design'

const COMPACT_WIDTH = 760

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'agents', label: 'Crew' },
  { id: 'docs', label: 'Docs' },
  { id: 'design', label: 'Design' }
]

export default function TopBar({
  tab,
  onTab,
  tasksOpen,
  onToggleTasks
}: {
  tab: Tab
  onTab: (tab: Tab) => void
  tasksOpen: boolean
  onToggleTasks: () => void
}) {
  const connection = useCrew(s => s.connection)
  const joinLink = useCrew(s => s.joinLink)
  const selfName = useCrew(s => s.selfName)
  const leave = useCrew(s => s.leave)
  const waiting = useCrew(reviewCount)
  const huddleJoined = useHuddle(s => s.joined)
  const huddleSize = useHuddle(s => s.room.peers.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const theme = useTheme()
  const sounds = useSounds()
  const headerRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setCompact(el.clientWidth <= COMPACT_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const copyLink = async () => {
    if (!joinLink) return
    await navigator.clipboard.writeText(joinLink)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setMenuOpen(false)
    }, 900)
  }

  return (
    <header
      ref={headerRef}
      style={{ height: TOP_BAR_H }}
      className="top-bar app-drag relative grid grid-cols-[1fr_auto_1fr] items-center px-6 shrink-0"
    >
      <span className="pl-[64px]">
        <CrewMark className="h-[18px] w-auto text-fg" />
      </span>

      <nav aria-label="Main navigation" className="app-no-drag flex items-center gap-2">
        {TABS.map(t => (
          <Tooltip key={t.id} label={t.label} disabled={!compact}>
            <button
              onClick={() => {
                if (t.id !== tab) playSound(`tab.${t.id}`)
                onTab(t.id)
              }}
              aria-label={t.label}
              className={`top-bar-tab flex items-center justify-center h-10 px-4 rounded-full text-base font-semibold transition-all duration-150 active:scale-95 ${
                tab === t.id
                  ? 'is-active bg-ink-800 text-fg'
                  : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
              }`}
            >
              <TabIcon tab={t.id} />
              <span className="top-bar-tab-label">{t.label}</span>
            </button>
          </Tooltip>
        ))}
      </nav>

      <div className="app-no-drag flex items-center justify-end gap-3">
        {connection === 'reconnecting' && (
          <span className="text-xs text-fg-muted animate-pulse">Connection lost. Trying again…</span>
        )}
        <Tooltip label="Tasks">
          <button
            onClick={onToggleTasks}
            aria-label="Tasks"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
              tasksOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
            }`}
          >
            <CheckCircleIcon className="w-[22px] h-[22px]" strokeWidth={1.8} />
            {waiting > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-fg text-ink-900 text-xs font-bold flex items-center justify-center">
                {waiting > 9 ? '9+' : waiting}
              </span>
            )}
          </button>
        </Tooltip>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(open => !open)}
            aria-label="Profile menu"
            className={`block rounded-full transition-all duration-150 hover:ring-2 hover:ring-fg/15 active:scale-95 ${
              menuOpen ? 'ring-2 ring-fg/25' : ''
            }`}
          >
            <Avatar name={selfName || '?'} presence={connection === 'online' ? 'online' : 'offline'} />
          </button>
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="min-w-44">
            <div className="px-3 pt-2 pb-1.5">
              <p className="text-sm font-semibold text-fg">{selfName}</p>
              <p className="text-xs text-fg-muted">{joinLink ? 'Hosting' : 'Joined'}</p>
              {import.meta.env.DEV && (
                <div className="mt-1.5">
                  <Pill>DEV mode</Pill>
                </div>
              )}
            </div>
            <div className="h-px bg-fg/[0.06] my-1" />
            <MenuItem
              icon={<SignalIcon />}
              label={huddleJoined ? 'Leave huddle' : huddleSize > 0 ? 'Join huddle' : 'Huddle'}
              hint={huddleSize > 0 ? `${huddleSize}` : undefined}
              onClick={() => {
                setMenuOpen(false)
                const huddle = useHuddle.getState()
                if (huddle.joined) huddle.leave()
                else void huddle.join()
              }}
            />
            {joinLink && (
              <MenuItem
                icon={copied ? <CheckIcon /> : <LinkIcon />}
                label={copied ? 'Copied' : 'Invite link'}
                onClick={() => void copyLink()}
              />
            )}
            <MenuItem
              icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
            />
            <MenuItem
              icon={sounds ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
              label={sounds ? 'Mute sounds' : 'Unmute sounds'}
              onClick={() => setSounds(!sounds)}
            />
            <MenuItem
              icon={<ArrowRightStartOnRectangleIcon />}
              label="Leave"
              danger
              onClick={() => {
                setMenuOpen(false)
                leave()
              }}
            />
          </Popover>
        </div>
      </div>
    </header>
  )
}
