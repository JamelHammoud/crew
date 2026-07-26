import { SideMenuExtension, SuggestionMenu } from '@blocknote/core/extensions'
import { useBlockNoteEditor, useExtension, useExtensionState } from '@blocknote/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars2Icon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/16/solid'
import { useState, type DragEvent } from 'react'
import { MenuDivider, MenuItem, Popover } from '../Popover'

export default function DocSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>()
  const sideMenu = useExtension(SideMenuExtension)
  const suggestions = useExtension(SuggestionMenu)
  const block = useExtensionState(SideMenuExtension, { selector: state => state?.block })
  const [menu, setMenu] = useState(false)

  if (!block) return null

  const heading = block.type === 'heading' ? String((block.props as { level?: number }).level ?? 1) : undefined

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
    <div className="doc-side flex items-start gap-0.5 pr-1" data-block-type={block.type} data-level={heading}>
      <button
        onClick={add}
        aria-label="Add a block below"
        className="w-6 h-6 rounded-lg grid place-items-center text-fg-faint hover:text-fg-secondary hover:bg-fg/[0.06] transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
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
          <Bars2Icon className="w-4 h-4" />
        </button>
        <Popover open={menu} onClose={close} align="start" className="min-w-44">
          <MenuItem
            icon={<DocumentDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              duplicate()
              close()
            }}
          />
          <MenuItem
            icon={<ArrowUpIcon />}
            label="Move up"
            onClick={() => {
              editor.moveBlocksUp(block)
              close()
            }}
          />
          <MenuItem
            icon={<ArrowDownIcon />}
            label="Move down"
            onClick={() => {
              editor.moveBlocksDown(block)
              close()
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<TrashIcon />}
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
