import { ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useMemo, useRef, useState } from 'react'
import Emoji from './Emoji'
import { EMOJI_CATEGORIES, lookupEmoji, searchEmoji, type EmojiEntry } from './emoji'
import { recentEmoji } from './emojiRecents'
import Tooltip from './Tooltip'

const COLUMNS = 9
const CELL = 34
const HEADER = 28
const OVERSCAN = 320

interface Section {
  id: string
  label: string
  icon: string | null
  entries: EmojiEntry[]
  top: number
  height: number
}

const sectionHeight = (count: number) => HEADER + Math.ceil(count / COLUMNS) * CELL

export default function EmojiPicker({
  selected,
  onPick
}: {
  selected: Set<string>
  onPick: (char: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [active, setActive] = useState('recent')
  const [preview, setPreview] = useState<EmojiEntry | null>(null)

  const sections = useMemo<Section[]>(() => {
    const recents = recentEmoji()
      .map(char => lookupEmoji(char))
      .filter((entry): entry is EmojiEntry => Boolean(entry))
    const all = [
      { id: 'recent', label: 'Frequently used', icon: null, entries: recents },
      ...EMOJI_CATEGORIES.map(category => ({ ...category, icon: category.icon as string | null }))
    ]
    let top = 0
    return all.map(section => {
      const height = sectionHeight(section.entries.length)
      const placed = { ...section, top, height }
      top += height
      return placed
    })
  }, [])

  const results = useMemo(() => searchEmoji(query), [query])
  const searching = query.trim().length > 0

  const viewport = scrollRef.current?.clientHeight ?? 300

  const jump = (id: string) => {
    const section = sections.find(item => item.id === id)
    if (!section || !scrollRef.current) return
    setActive(id)
    scrollRef.current.scrollTo({ top: section.top })
  }

  const onScroll = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    setScrollTop(scroller.scrollTop)
    let current = sections[0].id
    for (const section of sections) {
      if (section.top <= scroller.scrollTop + 12) current = section.id
    }
    setActive(current)
  }

  const cell = (entry: EmojiEntry) => (
    <button
      key={entry.char}
      type="button"
      aria-label={`React with ${entry.char}`}
      aria-pressed={selected.has(entry.char)}
      onClick={() => onPick(entry.char)}
      onMouseEnter={() => setPreview(entry)}
      onFocus={() => setPreview(entry)}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-xl transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-fg/10 active:scale-90 ${
        selected.has(entry.char) ? 'bg-fg/12' : ''
      }`}
    >
      <Emoji char={entry.char} size={22} />
    </button>
  )

  return (
    <div className="flex h-[400px] w-[368px] flex-col" onMouseLeave={() => setPreview(null)}>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && results[0]) onPick(results[0].char)
            }}
            placeholder="Search emoji"
            className="h-9 w-full rounded-full bg-fg/6 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-muted focus:bg-fg/10"
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-1 [scrollbar-width:none]">
          {sections.map(section => (
            <Tooltip key={section.id} label={section.label}>
              <button
                type="button"
                aria-label={section.label}
                aria-pressed={!searching && active === section.id}
                onClick={() => jump(section.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color] duration-150 ${
                  !searching && active === section.id
                    ? 'bg-fg/12 text-fg'
                    : 'text-fg-muted hover:bg-fg/6 hover:text-fg-secondary'
                }`}
              >
                {section.icon ? <Emoji char={section.icon} size={18} /> : <ClockIcon className="h-4 w-4" />}
              </button>
            </Tooltip>
          ))}
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {searching ? (
            <div className="px-1 pb-2">
              <p className="flex h-7 items-center px-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {results.length > 0 ? 'Results' : 'No emoji found'}
              </p>
              <div className="grid grid-cols-9">{results.map(cell)}</div>
            </div>
          ) : (
            sections.map(section => {
              const near =
                section.top < scrollTop + viewport + OVERSCAN && section.top + section.height > scrollTop - OVERSCAN
              return (
                <div key={section.id} style={{ height: section.height }} className="px-1">
                  {near && (
                    <>
                      <p className="sticky top-0 z-10 flex h-7 items-center bg-ink-850/85 px-2 text-xs font-semibold uppercase tracking-wide text-fg-muted backdrop-blur-xl">
                        {section.label}
                      </p>
                      <div className="grid grid-cols-9">{section.entries.map(cell)}</div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
      <div className="flex h-12 items-center gap-2.5 border-t border-fg/8 px-4">
        {preview ? (
          <>
            <Emoji char={preview.char} size={24} />
            <span className="truncate text-sm font-medium text-fg-secondary">:{preview.shortName}:</span>
          </>
        ) : (
          <span className="text-sm text-fg-muted">Pick a reaction</span>
        )}
      </div>
    </div>
  )
}
