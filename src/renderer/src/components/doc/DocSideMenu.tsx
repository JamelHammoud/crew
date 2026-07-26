import { SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import { useBlockNoteEditor, useExtension, useExtensionState } from '@blocknote/react'
import { useLayoutEffect, useState, type DragEvent } from 'react'
import {
  ArrowDownGlyph,
  ArrowUpGlyph,
  DuplicateGlyph,
  HandleGlyph,
  PlusGlyph,
  TrashGlyph
} from '../../icons'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import { blockHandleOffset } from './blockAnchor'

export default function DocSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>()
  const sideMenu = useExtension(SideMenuExtension)
  const suggestions = useExtension(SuggestionMenu)
  const block = useExtensionState(SideMenuExtension, { selector: state => state?.block })
  const [menu, setMenu] = useState(false)
  const [offset, setOffset] = useState(0)
  const id = block?.id

  useLayoutEffect(() => {
    const node = id ? editor.domElement?.querySelector(`[data-id="${CSS.escape(id)}"]`) : null
    if (!node) return
    const measure = () => setOffset(blockHandleOffset(node))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(node)
    return () => watch.disconnect()
  }, [editor, id])

  if (!block) return null

  const add = () => {
    const empty = Array.isArray(block.content) && block.content.length === 0
    const target = empty ? block : editor.insertBlocks([{ type: 'paragraph' }], block, 'after')[0]
    editor.setTextCursorPosition(target)
    suggestions.openSuggestionMenu('/')
  }

  const close = () => {
    setMenu(false)
    sideMenu.unfreezeMenu()
  }

  const duplicate = () => {
    const { id, ...copy } = block
    editor.insertBlocks([copy], block, 'after')
  }

  return (
    <div className="flex items-start gap-0.5 pr-1" style={{ paddingTop: offset }}>
      <button
        onClick={add}
        aria-label="Add a block below"
        className="w-6 h-6 rounded-lg grid place-items-center text-fg-faint hover:text-fg-secondary hover:bg-fg/[0.06] transition-colors"
      >
        <PlusGlyph className="w-4 h-4" />
      </button>
      <span className="relative flex items-center">
        <button
          draggable
          onDragStart={(event: DragEvent<HTMLButtonElement>) => sideMenu.blockDragStart(event, block)}
          onDragEnd={() => sideMenu.blockDragEnd()}
          onClick={() => {
            setMenu(true)
            sideMenu.freezeMenu()
          }}
          aria-label="Block menu"
          className="w-6 h-6 rounded-lg grid place-items-center text-fg-faint hover:text-fg-secondary hover:bg-fg/[0.06] transition-colors cursor-grab active:cursor-grabbing"
        >
          <HandleGlyph className="w-4 h-4" />
        </button>
        <Popover open={menu} onClose={close} align="start" className="min-w-44">
          <MenuItem
            icon={<DuplicateGlyph />}
            label="Duplicate"
            onClick={() => {
              duplicate()
              close()
            }}
          />
          <MenuItem
            icon={<ArrowUpGlyph />}
            label="Move up"
            onClick={() => {
              editor.moveBlocksUp(block)
              close()
            }}
          />
          <MenuItem
            icon={<ArrowDownGlyph />}
            label="Move down"
            onClick={() => {
              editor.moveBlocksDown(block)
              close()
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<TrashGlyph />}
            label="Delete"
            danger
            onClick={() => {
              editor.removeBlocks([block])
              close()
            }}
          />
        </Popover>
      </span>
    </div>
  )
}
