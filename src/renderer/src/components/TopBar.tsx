import { useEffect, useRef, useState } from 'react'
import {
  CheckCircleGlyph,
  CheckGlyph,
  LeaveGlyph,
  LinkGlyph,
  MoreGlyph,
  MoonGlyph,
  PeopleGlyph,
  SpeakerGlyph,
  SpeakerOffGlyph,
  SunGlyph
} from '../icons'
import { playSound } from '../media/sounds'
import { reviewCount } from '../state/alerts'
import { setSounds, useSounds } from '../state/sound'
import { useCrew } from '../state/store'
import { toggleTheme, useTheme } from '../state/theme'
import { useFullScreen } from '../state/windowShape'
import Avatar from './Avatar'
import Badge from './Badge'
import CrewLogo from './CrewLogo'
import PhotoPicker from './PhotoPicker'
import Pill from './Pill'
import PresenceStack from './PresenceStack'
import TabIcon from './TabIcon'
import Toolbox from './Toolbox'
import ToolboxMark from './ToolboxMark'
import Tooltip from './Tooltip'
import { MenuDivider, MenuItem, Popover } from './Popover'

export type Tab = 'chat' | 'agents' | 'docs' | 'design'

export type NavTab = Exclude<Tab, 'agents'>

export const TOP_BAR_H = 70

const COMPACT_WIDTH = 760
const COLLAPSED_NAV_WIDTH = 560

const TABS: Array<{ id: NavTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
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
  const hosting = useCrew(s => s.hosting)
  const shared = useCrew(s => s.shared)
  const share = useCrew(s => s.share)
  const selfName = useCrew(s => s.selfName)
  const hasPhoto = useCrew(s => Boolean(s.members.find(m => m.id === s.selfId)?.avatar))
  const setMyPhoto = useCrew(s => s.setMyPhoto)
  const leave = useCrew(s => s.leave)
  const waiting = useCrew(reviewCount)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const theme = useTheme()
  const sounds = useSounds()
  const full = useFullScreen()
  const headerRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  const [collapsedNav, setCollapsedNav] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setCompact(el.clientWidth <= COMPACT_WIDTH)
      setCollapsedNav(el.clientWidth <= COLLAPSED_NAV_WIDTH)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!collapsedNav) setMoreOpen(false)
  }, [collapsedNav])

  const standing =
    connection === 'reconnecting'
      ? 'Reconnecting'
      : connection === 'connecting'
        ? 'Connecting'
        : !hosting
          ? 'Joined'
          : shared
            ? 'Hosting'
            : 'On this machine'

  const showCopied = () => {
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setMenuOpen(false)
    }, 900)
  }

  const copyLink = async () => {
    if (!joinLink) return
    await navigator.clipboard.writeText(joinLink)
    showCopied()
  }

  // Inviting people is one action, so the session goes onto the network and the
  // link is on the clipboard by the time the menu says so.
  const invite = async () => {
    const link = await share(true)
    if (!link) return
    await navigator.clipboard.writeText(link)
    showCopied()
  }

  const selectTab = (next: NavTab) => {
    if (next !== tab) playSound(`tab.${next}`)
    onTab(next)
  }

  const visibleTabs = collapsedNav ? TABS.filter(item => item.id === tab) : TABS
  const hiddenTabs = collapsedNav ? TABS.filter(item => item.id !== tab) : []

  return (
    <header
      ref={headerRef}
      style={{ height: TOP_BAR_H }}
      className="top-bar app-drag relative grid grid-cols-[1fr_auto_1fr] items-center px-6 shrink-0"
    >
      <span className={`flex items-center ${full ? '' : 'mac:pl-[64px]'}`}>
        <CrewLogo />
      </span>

      <nav aria-label="Main navigation" className="app-no-drag flex items-center gap-2">
        {visibleTabs.map(t => (
          <Tooltip key={t.id} label={t.label} disabled={!compact}>
            <button
              onClick={() => selectTab(t.id)}
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
        {collapsedNav && (
          <div className="relative">
            <Tooltip label="More" disabled={moreOpen}>
              <button
                onClick={() => setMoreOpen(open => !open)}
                aria-label="More"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`top-bar-tab flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
                  moreOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:bg-fg/[0.04] hover:text-fg-secondary'
                }`}
              >
                <MoreGlyph className="h-5 w-5" />
              </button>
            </Tooltip>
            <Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="center" className="min-w-40">
              {hiddenTabs.map(item => (
                <MenuItem
                  key={item.id}
                  icon={<TabIcon tab={item.id} />}
                  label={item.label}
                  onClick={() => {
                    setMoreOpen(false)
                    selectTab(item.id)
                  }}
                />
              ))}
            </Popover>
          </div>
        )}
      </nav>

      <div className={`app-no-drag flex items-center justify-end ${compact ? 'gap-1' : 'gap-2'}`}>
        {connection === 'reconnecting' && (
          <span className="text-xs text-fg-muted animate-pulse mr-1">Connection lost. Trying again…</span>
        )}
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
          <Tooltip label="Tasks">
            <button
              onClick={() => {
                if (!tasksOpen) playSound('tasks.open')
                onToggleTasks()
              }}
              aria-label="Tasks"
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
        <div className="relative">
          <button
            onClick={() => setMenuOpen(open => !open)}
            aria-label="Profile menu"
            className={`flex rounded-full transition-all duration-150 hover:ring-2 hover:ring-fg/15 active:scale-95 ${
              menuOpen ? 'ring-2 ring-fg/25' : ''
            }`}
          >
            <Avatar name={selfName || '?'} presence={connection === 'online' ? 'online' : 'offline'} />
          </button>
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="min-w-56">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <PhotoPicker has={hasPhoto} onChange={setMyPhoto}>
                <Avatar name={selfName || '?'} presence={connection === 'online' ? 'online' : 'offline'} />
              </PhotoPicker>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg truncate">{selfName}</p>
                <p className="text-xs text-fg/45">{standing}</p>
              </div>
              {import.meta.env.DEV && <Pill glass>DEV</Pill>}
            </div>
            <MenuDivider />
            <MenuItem
              icon={<PeopleGlyph />}
              label="Crew"
              active={tab === 'agents'}
              onClick={() => {
                setMenuOpen(false)
                onTab('agents')
              }}
            />
            {joinLink && (
              <MenuItem
                icon={copied ? <CheckGlyph /> : <LinkGlyph />}
                label={copied ? 'Copied' : 'Invite link'}
                onClick={() => void copyLink()}
              />
            )}
            <MenuDivider />
            <MenuItem
              icon={theme === 'dark' ? <SunGlyph /> : <MoonGlyph />}
              label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggleTheme}
            />
            <MenuItem
              icon={sounds ? <SpeakerOffGlyph /> : <SpeakerGlyph />}
              label={sounds ? 'Mute sounds' : 'Unmute sounds'}
              onClick={() => {
                setSounds(!sounds)
                if (!sounds) playSound('sound.on')
              }}
            />
            <MenuDivider />
            <MenuItem
              icon={<LeaveGlyph />}
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
