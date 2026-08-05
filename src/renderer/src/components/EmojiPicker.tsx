import { useMemo, useRef, useState } from 'react'
import { customEmojiRef, type CustomEmoji } from '../../../shared/customEmoji'
import { ClockGlyph, SearchGlyph } from '../icons'
import { customEmojiSheet, lookupCustomEmojiRef, searchCustomEmoji } from './customEmojiSheet'
import Emoji from './Emoji'
import { EMOJI_CATEGORIES, lookupEmoji, searchEmoji, type EmojiEntry } from './emojiData'
import { recentEmoji } from './emojiRecents'
import Tooltip from './Tooltip'
import { useAutoFocus } from './useAutoFocus'

const CELL = 34
const HEADER = 28
const OVERSCAN = 320

// A cell is the value it hands back and the name it says, so one grid holds the
// crew's own pictures and the sheet's squares without knowing which it is
// drawing: `Emoji` already reads a `:name:` as a picture.
interface Choice {
  value: string
  name: string
}

interface Section {
  id: string
  label: string
  icon: string | null
  choices: Choice[]
  top: number
  height: number
}

const sheetChoice = (entry: EmojiEntry): Choice => ({ value: entry.char, name: entry.shortName })

const crewChoice = (emoji: CustomEmoji): Choice => ({
  value: customEmojiRef(emoji.name),
  name: emoji.name
})

// What is in the frequently used row is whatever has been picked, which is a
// character or one of the crew's own.
function choiceFor(value: string): Choice | null {
  const entry = lookupEmoji(value)
  if (entry) return sheetChoice(entry)
  const picture = lookupCustomEmojiRef(value)
  return picture ? crewChoice(picture.emoji) : null
}

// What the picker is for changes with where it stands: the same grid reacts to
// a message and marks a tool, so the words and the width it is given are the
// caller's, and the rows it holds are worked out from the columns it was asked
// for rather than from a number of its own.
export default function EmojiPicker({
  selected,
  onPick,
  columns = 9,
  className = 'h-[400px] w-[380px]',
  purpose = 'React with',
  hint = 'Pick a reaction'
}: {
  selected: Set<string>
  onPick: (char: string) => void
  columns?: number
  className?: string
  purpose?: string
  hint?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useAutoFocus<HTMLInputElement>()
  // The crew's own are read once, as the picker opens, so one arriving while
  // somebody is looking does not move the grid under the pointer. Newest first,
  // and the newest is the mark the rail wears.
  const crew = useMemo(() => [...customEmojiSheet()].sort((a, b) => b.ts - a.ts), [])
  const [query, setQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [active, setActive] = useState(crew.length > 0 ? 'crew' : 'recent')
  const [preview, setPreview] = useState<Choice | null>(null)

  const sectionHeight = (count: number) => HEADER + Math.ceil(count / columns) * CELL

  const sections = useMemo<Section[]>(() => {
    const recents = recentEmoji()
      .map(choiceFor)
      .filter((choice): choice is Choice => choice !== null)
    const all = [
      // A crew with none of its own gets no section at all, rather than a
      // heading standing over an empty row saying there is nothing there.
      ...(crew.length > 0
        ? [
            {
              id: 'crew',
              label: 'Crew',
              icon: crewChoice(crew[0]).value as string | null,
              choices: crew.map(crewChoice)
            }
          ]
        : []),
      { id: 'recent', label: 'Frequently used', icon: null, choices: recents },
      ...EMOJI_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        icon: category.icon as string | null,
        choices: category.entries.map(sheetChoice)
      }))
    ]
    let top = 0
    return all.map(section => {
      const height = sectionHeight(section.choices.length)
      const placed = { ...section, top, height }
      top += height
      return placed
    })
  }, [columns, crew])

  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  // A name somebody here made up is more likely what they are reaching for than
  // a match off the sheet, so the crew's own stand at the head of the results.
  const results = useMemo(
    () => [...searchCustomEmoji(query).map(crewChoice), ...searchEmoji(query).map(sheetChoice)],
    [query]
  )
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

  const cell = (choice: Choice) => (
    <button
      key={choice.value}
      type="button"
      aria-label={`${purpose} :${choice.name}:`}
      aria-pressed={selected.has(choice.value)}
      onClick={() => onPick(choice.value)}
      onMouseEnter={() => setPreview(choice)}
      onFocus={() => setPreview(choice)}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-xl transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-fg/10 active:scale-90 ${
        selected.has(choice.value) ? 'bg-fg/12' : ''
      }`}
    >
      <Emoji char={choice.value} size={22} />
    </button>
  )

  return (
    <div className={`flex flex-col ${className}`} onMouseLeave={() => setPreview(null)}>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <SearchGlyph className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/45" />
          <input
            ref={searchRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && results[0]) onPick(results[0].value)
            }}
            placeholder="Search emoji"
            className="h-9 w-full rounded-full bg-fg/6 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus:bg-fg/10"
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-1 no-scrollbar">
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
                    : 'text-fg/45 hover:bg-fg/6 hover:text-fg/70'
                }`}
              >
                {section.icon ? <Emoji char={section.icon} size={18} /> : <ClockGlyph className="h-4 w-4" />}
              </button>
            </Tooltip>
          ))}
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pr-1">
          {searching ? (
            <div className="px-1 pb-2">
              <p className="flex h-7 items-center px-2 text-xs font-medium uppercase tracking-wide text-fg/45">
                {results.length > 0 ? 'Results' : 'No emoji found'}
              </p>
              <div className="grid" style={grid}>
                {results.map(cell)}
              </div>
            </div>
          ) : (
            sections.map(section => {
              const near =
                section.top < scrollTop + viewport + OVERSCAN && section.top + section.height > scrollTop - OVERSCAN
              return (
                <div key={section.id} style={{ height: section.height }} className="px-1">
                  {near && (
                    <>
                      <p className="flex h-7 items-center px-2 text-xs font-medium uppercase tracking-wide text-fg/45">
                        {section.label}
                      </p>
                      <div className="grid" style={grid}>
                        {section.choices.map(cell)}
                      </div>
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
            <Emoji char={preview.value} size={24} />
            <span className="truncate text-sm font-medium text-fg/70">:{preview.name}:</span>
          </>
        ) : (
          <span className="text-sm text-fg/45">{hint}</span>
        )}
      </div>
    </div>
  )
}
