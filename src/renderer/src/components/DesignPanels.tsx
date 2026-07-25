import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CheckIcon,
  ChevronDownIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/16/solid'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCanRedo, useCanUndo, useEditor, useValue } from 'tldraw'
import { useCrew } from '../state/store'
import { HeaderButton } from './DesignControls'
import { MenuDivider, MenuItem, Popover } from './Popover'

export const DesignBoardContext = createContext<{ current: string; select: (id: string) => void }>({
  current: '',
  select: () => {}
})

export function BoardSwitcher() {
  const { current, select } = useContext(DesignBoardContext)
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const renameBoard = useCrew(s => s.renameBoard)
  const deleteBoard = useCrew(s => s.deleteBoard)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const board = boards.find(b => b.id === current)

  useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [renaming])

  if (!board) return null

  const startRename = (id: string, name: string) => {
    select(id)
    setDraft(name)
    setRenaming(true)
    setOpen(false)
  }

  const commitRename = () => {
    const clean = draft.trim()
    if (clean && clean !== board.name) renameBoard(board.id, clean)
    setRenaming(false)
  }

  const startCreate = () => {
    const id = createBoard('Untitled')
    startRename(id, 'Untitled')
  }

  if (renaming) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={e => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') setRenaming(false)
        }}
        aria-label="Board name"
        className="app-no-drag h-9 w-52 rounded-full bg-fg/[0.06] px-3.5 text-base font-semibold text-fg outline-none"
      />
    )
  }

  return (
    <span className="app-no-drag min-w-0">
      <button
        onClick={() => setOpen(value => !value)}
        onDoubleClick={() => startRename(board.id, board.name)}
        className="h-9 rounded-full pl-3.5 pr-2.5 flex items-center gap-1.5 text-base font-semibold text-fg transition-colors hover:bg-fg/[0.04]"
      >
        <span className="truncate max-w-52">{board.name}</span>
        <ChevronDownIcon
          className={`w-4 h-4 shrink-0 text-fg-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start">
        <div className="w-56">
          {boards.map(b => (
            <div key={b.id} className="group flex items-center gap-0.5 pr-1 rounded-xl transition-colors hover:bg-fg/5">
              <button
                onClick={() => {
                  select(b.id)
                  setOpen(false)
                }}
                className={`flex-1 min-w-0 flex items-center gap-2 pl-3 pr-1 py-2 text-sm text-left ${
                  b.id === current ? 'text-fg font-semibold' : 'text-fg-secondary'
                }`}
              >
                <span className="truncate flex-1">{b.name}</span>
                {b.id === current && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
              </button>
              <button
                onClick={() => startRename(b.id, b.name)}
                aria-label="Rename board"
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg hover:bg-fg/[0.08]"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteBoard(b.id)}
                aria-label="Delete board"
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger hover:bg-danger/10"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          <MenuDivider />
          <MenuItem icon={<PlusIcon />} label="New board" onClick={startCreate} />
        </div>
      </Popover>
    </span>
  )
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4]

export function DesignZoom() {
  const editor = useEditor()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const zoom = useValue('design zoom', () => editor.getZoomLevel(), [editor])
  const [open, setOpen] = useState(false)

  const jump = (run: () => void) => {
    run()
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-1">
      <HeaderButton label="Undo" disabled={!canUndo} onClick={() => editor.undo()}>
        <ArrowUturnLeftIcon className="w-4 h-4" />
      </HeaderButton>
      <HeaderButton label="Redo" disabled={!canRedo} onClick={() => editor.redo()}>
        <ArrowUturnRightIcon className="w-4 h-4" />
      </HeaderButton>
      <span className="w-px h-5 bg-fg/10 mx-1.5 shrink-0" />
      <HeaderButton label="Zoom out" onClick={() => editor.zoomOut()}>
        <MinusIcon className="w-4 h-4" />
      </HeaderButton>
      <button
        onClick={() => setOpen(value => !value)}
        aria-label="Zoom"
        className="app-no-drag h-9 min-w-14 px-2 rounded-full text-sm font-semibold tabular-nums text-fg-secondary transition-colors hover:text-fg hover:bg-fg/[0.04]"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <div className="w-48">
          <MenuItem label="Zoom to fit" hint="Shift 1" onClick={() => jump(() => editor.zoomToFit())} />
          <MenuItem label="Zoom to selection" hint="Shift 2" onClick={() => jump(() => editor.zoomToSelection())} />
          <MenuDivider />
          {ZOOM_STEPS.map(step => (
            <MenuItem
              key={step}
              label={`${step * 100}%`}
              onClick={() => jump(() => editor.setCamera({ ...editor.getCamera(), z: step }, { immediate: true }))}
            />
          ))}
        </div>
      </Popover>
      <HeaderButton label="Zoom in" onClick={() => editor.zoomIn()}>
        <PlusIcon className="w-4 h-4" />
      </HeaderButton>
    </div>
  )
}
