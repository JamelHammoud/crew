import type { BlockNoteEditor } from '@blocknote/core'
import type { SuggestionMenuProps } from '@blocknote/react'
import Emoji from '../Emoji'
import { searchEmoji, type EmojiEntry } from '../emojiData'
import { rememberEmoji } from '../emojiRecents'
import { useDocMenu } from './docMenu'

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
  const editor = useBlockNoteEditor()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = listRef.current?.querySelector('[data-selected="true"]')
    if (row instanceof HTMLElement) bringInto(row, listRef.current)
  }, [selectedIndex])

  // Tab takes the one standing under the pointer, which is the first until
  // somebody moves. It is caught on the way down so the editor never sees it:
  // left to travel, a Tab written inside a list indents the row instead.
  useEffect(() => {
    const dom = editor.domElement
    const take = items[selectedIndex ?? 0]
    if (!dom || !take) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      event.stopPropagation()
      onItemClick?.(take)
    }
    dom.addEventListener('keydown', onKey, true)
    return () => dom.removeEventListener('keydown', onKey, true)
  }, [editor, items, onItemClick, selectedIndex])

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
