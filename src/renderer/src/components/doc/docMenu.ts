import { useBlockNoteEditor } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import { bringInto } from '../scrollInto'

export function useDocMenu<T>(
  items: T[],
  selectedIndex: number | undefined,
  onItemClick: ((item: T) => void) | undefined
) {
  const editor = useBlockNoteEditor()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = listRef.current?.querySelector('[data-selected="true"]')
    if (row instanceof HTMLElement) bringInto(row, listRef.current)
  }, [selectedIndex])

  useEffect(() => {
    const dom = editor?.domElement
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

  return listRef
}
