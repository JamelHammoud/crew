import { ArrowRightStartOnRectangleIcon, CheckIcon, LinkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useCrew } from '../state/store'
import Avatar from './Avatar'
import { MenuItem, Popover } from './Popover'

export type Tab = 'chat' | 'agents' | 'docs'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'agents', label: 'Space' },
  { id: 'docs', label: 'Docs' }
]

export default function TopBar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const connection = useCrew(s => s.connection)
  const joinLink = useCrew(s => s.joinLink)
  const selfName = useCrew(s => s.selfName)
  const leave = useCrew(s => s.leave)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

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
    <header className="relative grid grid-cols-[1fr_auto_1fr] items-center px-6 h-[70px] shrink-0">
      <span className="font-mono font-semibold text-xl text-fg select-none">crew</span>

      <nav className="flex items-center gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`h-10 px-4 rounded-full text-base font-semibold transition-all duration-150 active:scale-95 ${
              tab === t.id ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-end gap-3">
        {connection === 'reconnecting' && (
          <span className="text-xs text-fg-muted animate-pulse">Connection lost. Trying again…</span>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(open => !open)}
            aria-label="Profile menu"
            className={`block rounded-full transition-all duration-150 hover:ring-2 hover:ring-white/15 active:scale-95 ${
              menuOpen ? 'ring-2 ring-white/25' : ''
            }`}
          >
            <Avatar name={selfName || '?'} />
          </button>
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="min-w-44">
            <div className="px-3 pt-2 pb-1.5">
              <p className="text-sm font-semibold text-fg">{selfName}</p>
              <p className="text-xs text-fg-muted">{joinLink ? 'Hosting' : 'Joined'}</p>
            </div>
            <div className="h-px bg-white/[0.06] my-1" />
            {joinLink && (
              <MenuItem
                icon={copied ? <CheckIcon /> : <LinkIcon />}
                label={copied ? 'Copied' : 'Invite link'}
                onClick={() => void copyLink()}
              />
            )}
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
