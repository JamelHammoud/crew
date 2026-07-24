import { ArrowRightStartOnRectangleIcon, CheckIcon, LinkIcon, MoonIcon, SunIcon } from '@heroicons/react/16/solid'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useCrew } from '../state/store'
import { applyTheme, useTheme } from '../state/theme'
import Avatar from './Avatar'
import Pill from './Pill'
import RepoControls from './RepoControls'
import TabIcon from './TabIcon'
import Tooltip from './Tooltip'
import { MenuItem, Popover } from './Popover'

export type Tab = 'chat' | 'agents' | 'docs' | 'design'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'agents', label: 'Space' },
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
  const reviewCount = useCrew(
    s =>
      Object.values(s.threads).filter(
        t => t.status === 'open' && !s.threadPrompts[t.id] && (s.queues[t.id]?.length ?? 0) === 0
      ).length
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const theme = useTheme()

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
    <header className="app-drag relative grid grid-cols-[1fr_auto_1fr] items-center px-6 h-[70px] shrink-0">
      <span className="font-mono font-semibold text-xl text-fg select-none pl-[64px]">crew</span>

      <nav className="app-no-drag flex items-center gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`flex items-center h-10 px-4 rounded-full text-base font-semibold transition-all duration-150 active:scale-95 ${
              tab === t.id ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
            }`}
          >
            {tab === t.id && <TabIcon tab={t.id} />}
            {t.label}
          </button>
        ))}
      </nav>

      <div className="app-no-drag flex items-center justify-end gap-3">
        {connection === 'reconnecting' && (
          <span className="text-xs text-fg-muted animate-pulse">Connection lost. Trying again…</span>
        )}
        <RepoControls />
        <Tooltip label="Tasks">
          <button
            onClick={onToggleTasks}
            aria-label="Tasks"
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
              tasksOpen ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
            }`}
          >
            <CheckCircleIcon className="w-[22px] h-[22px]" strokeWidth={1.8} />
            {reviewCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-fg text-ink-900 text-xs font-bold flex items-center justify-center">
                {reviewCount > 9 ? '9+' : reviewCount}
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
