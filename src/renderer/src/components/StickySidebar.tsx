import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { Sticky, StickyColor } from '../../../shared/stickies'
import { STICKY_COLORS } from '../../../shared/stickies'
import { CloseGlyph, PanelLeftGlyph, PinGlyph, PlusGlyph, PopOutGlyph, SearchGlyph, StickyGlyph, TrashGlyph } from '../icons'
import { usePrefs } from '../state/prefs'
import { deleteSticky, updateSticky } from '../state/stickies'
import { useFullScreen } from '../state/windowShape'
import { MenuDivider, MenuItem, Popover } from './Popover'
import ScrollFade from './ScrollFade'
import SwipeActionRow from './SwipeActionRow'
import Tooltip from './Tooltip'
import { formatShortDay } from './time'
import useScrollEdges from './useScrollEdges'

const COLOR_VALUES = ['#e9c46a', '#ef8f8f', '#78aee8', '#6fc7ad', '#d394df']

export function stickyColorValue(color: StickyColor): string {
  const at = STICKY_COLORS.indexOf(color)
  return COLOR_VALUES[at < 0 ? 0 : at % COLOR_VALUES.length]
}

export function stickyEditorBackground(color: StickyColor): string {
  return `color-mix(in srgb, var(--color-ink-900) 94%, ${stickyColorValue(color)})`
}

export function stickyLabel(sticky: Sticky): string {
  const title = sticky.title?.trim() ?? ''
  if (title) return title
  const line = sticky.body
    .split('\n')
    .map(part => part.replace(/^\s*(?:#{1,6}|[-*+]>?|\d+\.)\s*/, '').replace(/[*_`~[\]]/g, '').trim())
    .find(Boolean)
  return line || 'New sticky'
}

export function stickyPreview(sticky: Sticky): string {
  return sticky.body
    .split('\n')
    .map(part => part.replace(/^\s*(?:#{1,6}|[-*+]>?|\d+\.)\s*/, '').replace(/[*_`~[\]]/g, '').trim())
    .filter(Boolean)
    .slice(sticky.title?.trim() ? 0 : 1)
    .join(' ')
}

function ColorMark({ color }: { color: StickyColor }) {
  return (
    <span
      className="block w-3.5 h-3.5 rounded-full ring-1 ring-inset ring-fg/10"
      style={{ backgroundColor: stickyColorValue(color) }}
    />
  )
}

function StickyMenu({ sticky, close }: { sticky: Sticky; close: () => void }) {
  const take = (action: () => void) => {
    close()
    action()
  }

  return (
    <>
      <MenuItem
        icon={<PopOutGlyph />}
        label="Open in window"
        onClick={() => take(() => void window.crew.openSticky(sticky.id))}
      />
      <MenuItem
        icon={<PinGlyph />}
        label={sticky.pinned ? 'Unpin' : 'Pin'}
        onClick={() => take(() => void updateSticky(sticky.id, { pinned: !sticky.pinned }))}
      />
      <MenuDivider />
      {STICKY_COLORS.map(color => (
        <MenuItem
          key={color}
          icon={<ColorMark color={color} />}
          label={color[0].toUpperCase() + color.slice(1)}
          checked={sticky.color === color}
          onClick={() => take(() => void updateSticky(sticky.id, { color }))}
        />
      ))}
      <MenuDivider />
      <MenuItem
        icon={<TrashGlyph />}
        label="Delete sticky"
        danger
        onClick={() => take(() => void deleteSticky(sticky.id))}
      />
    </>
  )
}

function StickyRow({ sticky, active, onOpen }: { sticky: Sticky; active: boolean; onOpen: () => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const label = stickyLabel(sticky)
  const preview = stickyPreview(sticky)
  const compact = !sticky.title?.trim()

  return (
    <SwipeActionRow className="-ml-3 w-[calc(100%+24px)]" onDelete={() => void deleteSticky(sticky.id)}>
      <div
        onContextMenu={event => {
          event.preventDefault()
          setAt({ x: event.clientX, y: event.clientY })
        }}
        style={{ paddingRight: 'var(--swipe-inset)' }}
        className="relative pl-3"
      >
        <button
          onClick={onOpen}
          aria-current={active ? 'page' : undefined}
          className={`w-full rounded-[15px] px-3 flex gap-3 text-left transition-colors duration-150 ${
            compact ? 'min-h-14 py-2 items-center' : 'min-h-[72px] py-2.5 items-start'
          } ${
            active ? 'bg-fg/[0.09]' : 'hover:bg-fg/[0.05]'
          }`}
        >
          <span className={`${compact ? '' : 'mt-1'} shrink-0`}>
            <ColorMark color={sticky.color} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-medium truncate ${active ? 'text-fg' : 'text-fg/80'}`}>{label}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-fg/40">
              <span className="shrink-0">{formatShortDay(sticky.updatedAt)}</span>
              {preview && <span className="truncate">{preview}</span>}
            </span>
          </span>
          {sticky.pinned && (
            <PinGlyph className={`w-3.5 h-3.5 shrink-0 text-fg/35 ${compact ? '' : 'mt-0.5'}`} />
          )}
        </button>
        <Popover open={at !== null} onClose={() => setAt(null)} at={at ?? undefined} className="min-w-52">
          <StickyMenu sticky={sticky} close={() => setAt(null)} />
        </Popover>
      </div>
    </SwipeActionRow>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-2 mb-1.5 text-xs font-semibold text-fg/45">{label}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

export default function StickySidebar({
  stickies,
  active,
  collapsed,
  onOpen,
  onNew,
  onCollapse
}: {
  stickies: Sticky[]
  active: string | null
  collapsed: boolean
  onOpen: (id: string) => void
  onNew: () => void
  onCollapse: () => void
}) {
  const [query, setQuery] = useState('')
  const glass = usePrefs().glassSidebar
  const full = useFullScreen()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)
  const ordered = useMemo(() => {
    const searched = query.trim().toLowerCase()
    return [...stickies]
      .filter(sticky => {
        if (!searched) return true
        return `${sticky.title ?? ''}\n${sticky.body}\n${stickyLabel(sticky)}`.toLowerCase().includes(searched)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [query, stickies])
  const pinned = ordered.filter(sticky => sticky.pinned)
  const others = ordered.filter(sticky => !sticky.pinned)

  return (
    <aside
      data-sticky-sidebar
      aria-hidden={collapsed}
      className={`shrink-0 overflow-hidden transition-[width,border-color] duration-200 ${
        collapsed
          ? 'w-0'
          : glass
            ? 'w-[300px] sidebar-pinned bg-ink-800 border-r border-[var(--glass-line)]'
            : 'w-[300px] bg-ink-900 border-r border-ink-700'
      }`}
    >
      <div className={`w-[300px] h-full flex flex-col ${collapsed ? 'hidden' : ''}`}>
        <header
          className={`group/header app-drag h-[70px] shrink-0 pl-4 pr-3 flex items-center gap-1 ${
            full ? '' : 'mac:pl-[100px]'
          }`}
        >
          <h1 className="flex-1 text-lg font-bold text-fg">Stickies</h1>
          <Tooltip label="Hide sticky list">
            <button
              onClick={onCollapse}
              aria-label="Hide sticky list"
              className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center opacity-0 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 group-hover/header:opacity-100 focus-visible:opacity-100 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
            >
              <PanelLeftGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip label="New sticky">
            <button
              onClick={() => {
                setQuery('')
                onNew()
              }}
              aria-label="New sticky"
              className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-[color,background-color,transform] duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
            >
              <PlusGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </header>
        <div className="px-3 pb-4">
          <div className="h-10 rounded-full bg-ink-700 flex items-center gap-2 px-3 transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.10)] light:focus-within:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]">
            <SearchGlyph className="w-4 h-4 shrink-0 text-fg/35" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search stickies"
              aria-label="Search stickies"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg/35"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="w-7 h-7 rounded-full flex items-center justify-center text-fg/35 transition-colors hover:text-fg"
              >
                <CloseGlyph className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="relative flex-1 min-h-0">
          <div ref={scrollRef} data-sticky-sidebar-scroll className="h-full overflow-y-auto px-3 pb-6">
            <div className="space-y-6">
              {pinned.length > 0 && (
                <Section label="Pinned">
                  {pinned.map(sticky => (
                    <StickyRow
                      key={sticky.id}
                      sticky={sticky}
                      active={sticky.id === active}
                      onOpen={() => onOpen(sticky.id)}
                    />
                  ))}
                </Section>
              )}
              {others.length > 0 && (
                <Section label={pinned.length ? 'Stickies' : 'Recent'}>
                  {others.map(sticky => (
                    <StickyRow
                      key={sticky.id}
                      sticky={sticky}
                      active={sticky.id === active}
                      onOpen={() => onOpen(sticky.id)}
                    />
                  ))}
                </Section>
              )}
            </div>
            {ordered.length === 0 && (
              <div className="mt-20 flex flex-col items-center gap-4 text-center">
                <span className="w-11 h-11 rounded-card bg-ink-800 flex items-center justify-center text-fg/45">
                  {query ? <SearchGlyph className="w-5 h-5" /> : <StickyGlyph className="w-5 h-5" />}
                </span>
                <p className="text-sm text-fg-muted">{query ? 'No stickies found.' : 'No stickies yet.'}</p>
              </div>
            )}
          </div>
          <ScrollFade edges={edges} />
        </div>
      </div>
    </aside>
  )
}
