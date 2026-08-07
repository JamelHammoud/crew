import { TableHandlesExtension } from '@blocknote/core/extensions'
import {
  ExtendButton,
  TableHandlesController,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
  type ExtendButtonProps,
  type TableHandleProps
} from '@blocknote/react'
import { useState, type DragEvent } from 'react'
import { ArrowDownGlyph, ArrowLeftGlyph, ArrowRightGlyph, ArrowUpGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import { TableHeaderGlyph } from './docGlyphs'

function DocTableHandle({ orientation, hideOtherElements }: TableHandleProps) {
  const editor = useBlockNoteEditor<any, any, any>()
  const handles = useExtension(TableHandlesExtension)
  const state = useExtensionState(TableHandlesExtension)
  const [menu, setMenu] = useState(false)
  const row = orientation === 'row'
  const index = row ? state?.rowIndex : state?.colIndex
  const block = state?.block

  if (!block || index === undefined) return null

  const open = () => {
    setMenu(true)
    handles.freezeHandles()
    hideOtherElements(true)
  }

  const close = () => {
    setMenu(false)
    handles.unfreezeHandles()
    hideOtherElements(false)
  }

  const addRow = (side: 'above' | 'below') => {
    handles.addRowOrColumn(index, { orientation: 'row', side })
    close()
  }

  const addColumn = (side: 'left' | 'right') => {
    handles.addRowOrColumn(index, { orientation: 'column', side })
    close()
  }

  const header = !!block.content.headerRows

  return (
    <span className="relative flex items-center justify-center w-5 h-6">
      <button
        draggable
        onDragStart={(event: DragEvent<HTMLButtonElement>) =>
          row ? handles.rowDragStart(event) : handles.colDragStart(event)
        }
        onDragEnd={() => handles.dragEnd()}
        onClick={open}
        aria-label={row ? 'Row actions' : 'Column actions'}
        className="group grid place-items-center w-5 h-6 cursor-grab active:cursor-grabbing"
      >
        <span
          data-lit={menu ? '' : undefined}
          className={`rounded-full bg-fg/25 group-hover:bg-fg/50 data-lit:bg-fg/50 transition-colors ${
            row ? 'w-1 h-4' : 'w-4 h-1'
          }`}
        />
      </button>
      <Popover open={menu} onClose={close} align="start" className="min-w-40">
        <MenuItem
          icon={row ? <ArrowUpGlyph /> : <ArrowLeftGlyph />}
          label={row ? 'Add above' : 'Add left'}
          onClick={() => (row ? addRow('above') : addColumn('left'))}
        />
        <MenuItem
          icon={row ? <ArrowDownGlyph /> : <ArrowRightGlyph />}
          label={row ? 'Add below' : 'Add right'}
          onClick={() => add(row ? 'below' : 'right')}
        />
        {row && index === 0 && (
          <>
            <MenuDivider />
            <MenuItem
              icon={<TableHeaderGlyph />}
              label="Header row"
              checked={header}
              onClick={() => {
                editor.updateBlock(block, {
                  ...block,
                  content: { ...block.content, headerRows: header ? undefined : 1 }
                })
                close()
              }}
            />
          </>
        )}
        <MenuDivider />
        <MenuItem
          icon={<TrashGlyph />}
          label={row ? 'Delete row' : 'Delete column'}
          danger
          onClick={() => {
            handles.removeRowOrColumn(index, row ? 'row' : 'column')
            close()
          }}
        />
      </Popover>
    </span>
  )
}

function DocExtendButton(props: ExtendButtonProps) {
  return (
    <ExtendButton {...props}>
      <PlusGlyph className="w-3.5 h-3.5" />
    </ExtendButton>
  )
}

export default function DocTableHandles() {
  return <TableHandlesController tableHandle={DocTableHandle} extendButton={DocExtendButton} />
}
