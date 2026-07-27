import { useState } from 'react'
import { SearchGlyph } from '../../icons'
import Tooltip from '../Tooltip'
import { roundButton } from './buttons'

// Searching is a mark until it is asked for. A field standing open across the
// top of the panel is the loudest thing on a page that is mostly covers, and
// most of the time there is nothing being looked for.
export default function MusicSearch({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  const [open, setOpen] = useState(false)

  const shut = () => {
    setOpen(false)
    onQuery('')
  }

  if (!open) {
    return (
      <div className="flex flex-1 justify-end">
        <Tooltip label="Search">
          <button onClick={() => setOpen(true)} aria-label="Search music" className={`${roundButton} w-8 h-8`}>
            <SearchGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 min-w-0">
      <SearchGlyph className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint pointer-events-none" />
      <input
        autoFocus
        value={query}
        onChange={event => onQuery(event.target.value)}
        onBlur={() => {
          if (!query.trim()) shut()
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') shut()
        }}
        placeholder="Search"
        aria-label="Search music"
        spellCheck={false}
        className="w-full h-8 pl-8 pr-3 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
      />
    </div>
  )
}
