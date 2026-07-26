import type { BlockNoteEditor } from '@blocknote/core'
import type { SuggestionMenuProps } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import Emoji from '../Emoji'
import { searchEmoji, type EmojiEntry } from '../emojiData'
import { rememberEmoji } from '../emojiRecents'

const MATCHES = 9

export interface DocEmojiItem {
  title: string
  entry: EmojiEntry
  onItemClick: () => void
}

export function docEmojiItems(editor: BlockNoteEditor, query: string): DocEmojiItem[] {
  return searchEmoji(query, MATCHES).map(entry => ({
    title: entry.shortName,
    entry,
    onItemClick: () => {
      rememberEmoji(entry.char)
      editor.insertInlineContent(entry.char)
    }
  }))
}

export function DocEmojiMenu({ items, selectedIndex, onItemClick }: SuggestionMenuProps<DocEmojiItem>) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) return null
  return (
    <div ref={listRef} className="glass doc-float min-w-60 overflow-y-auto rounded-2xl p-1.5 animate-pop">
      {items.map((item, index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={item.entry.char}
            data-selected={selected}
            onClick={() => onItemClick?.(item)}
            aria-label={`:${item.title}:`}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
              selected ? 'bg-fg/[0.08] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
            }`}
          >
            <Emoji char={item.entry.char} size={18} />
            <span className="flex-1 truncate">:{item.title}:</span>
          </button>
        )
      })}
    </div>
  )
}
