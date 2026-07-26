import type { BlockNoteEditor } from '@blocknote/core'
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import type { SuggestionMenuProps } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import type { Glyph } from '../glyph'
import { DOC_BLOCKS, shortcutLabel } from './docBlocks'

export interface DocSlashItem {
  title: string
  aliases: string[]
  group: string
  mark: Glyph
  shortcut?: string
  onItemClick: () => void
}

export function docSlashItems(editor: BlockNoteEditor, addImage: () => void): DocSlashItem[] {
  return DOC_BLOCKS.map(kind => ({
    title: kind.title,
    aliases: kind.aliases,
    group: kind.group,
    mark: kind.mark,
    shortcut: kind.shortcut,
    onItemClick: kind.key === 'image' ? addImage : () => insertOrUpdateBlockForSlashMenu(editor, kind.block)
  }))
}

export function DocSlashMenu({ items, selectedIndex, onItemClick }: SuggestionMenuProps<DocSlashItem>) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) return null
  return (
    <div ref={listRef} className="glass doc-float min-w-60 overflow-y-auto rounded-2xl p-1.5 animate-pop">
      {items.map((item, index) => {
        const label = index === 0 || items[index - 1].group !== item.group ? item.group : null
        const selected = index === selectedIndex
        return (
          <div key={item.title}>
            {label && (
              <p className="flex h-7 items-center px-2 text-xs font-medium uppercase tracking-wide text-fg-faint">
                {label}
              </p>
            )}
            <button
              data-selected={selected}
              onClick={() => onItemClick?.(item)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
                selected ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.06] hover:text-fg'
              }`}
            >
              <item.mark className="w-4 h-4 shrink-0 text-fg-muted" />
              <span className="flex-1 truncate">{item.title}</span>
              {item.shortcut && (
                <span className="text-xs text-fg-muted shrink-0">{shortcutLabel(item.shortcut)}</span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
