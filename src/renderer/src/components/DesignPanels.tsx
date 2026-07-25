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
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useCanRedo, useCanUndo, useEditor, useValue } from 'tldraw'
import { useCrew } from '../state/store'
import { MenuDivider, Popover } from './Popover'
import Tooltip from './Tooltip'

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
        className="h-8 w-44 bg-transparent px-3 text-sm font-semibold text-fg outline-none"
      />
    )
  }

  return (
    <span className="app-no-drag">
      <button
        onClick={() => setOpen(value => !value)}
        onDoubleClick={() => startRename(board.id, board.name)}
        className="h-8 rounded-full pl-3 pr-2.5 flex items-center gap-1.5 text-sm font-semibold text-fg transition-colors hover:bg-fg/[0.06]"
      >
        <span className="truncate max-w-40">{board.name}</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-fg-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
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
          <button
            onClick={startCreate}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-fg-secondary transition-colors hover:text-fg hover:bg-fg/5"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            New board
          </button>
        </div>
      </Popover>
    </span>
  )
}

function RoundButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted transition-all enabled:hover:text-fg enabled:hover:bg-fg/[0.06] enabled:active:scale-95 disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4]

export function DesignZoom() {
  const editor = useEditor()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const zoom = useValue('design zoom', () => editor.getZoomLevel(), [editor])
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-0.5 app-no-drag">
      <RoundButton label="Undo" disabled={!canUndo} onClick={() => editor.undo()}>
        <ArrowUturnLeftIcon className="w-4 h-4" />
      </RoundButton>
      <RoundButton label="Redo" disabled={!canRedo} onClick={() => editor.redo()}>
        <ArrowUturnRightIcon className="w-4 h-4" />
      </RoundButton>
      <span className="w-px h-4 bg-fg/10 mx-1 shrink-0" />
      <RoundButton label="Zoom out" onClick={() => editor.zoomOut()}>
        <MinusIcon className="w-4 h-4" />
      </RoundButton>
      <button
        onClick={() => setOpen(value => !value)}
        aria-label="Zoom"
        className="h-8 min-w-12 px-1 rounded-full text-xs font-semibold tabular-nums text-fg-secondary transition-colors hover:text-fg hover:bg-fg/[0.06]"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <div className="w-48">
          <ZoomItem label="Zoom to fit" hint="Shift 1" onClick={() => editor.zoomToFit()} onDone={() => setOpen(false)} />
          <ZoomItem
            label="Zoom to selection"
            hint="Shift 2"
            onClick={() => editor.zoomToSelection()}
            onDone={() => setOpen(false)}
          />
          <MenuDivider />
          {ZOOM_STEPS.map(step => (
            <ZoomItem
              key={step}
              label={`${step * 100}%`}
              onClick={() => editor.setCamera({ ...editor.getCamera(), z: step }, { immediate: true })}
              onDone={() => setOpen(false)}
            />
          ))}
        </div>
      </Popover>
      <RoundButton label="Zoom in" onClick={() => editor.zoomIn()}>
        <PlusIcon className="w-4 h-4" />
      </RoundButton>
    </div>
  )
}

function ZoomItem({
  label,
  hint,
  onClick,
  onDone
}: {
  label: string
  hint?: string
  onClick: () => void
  onDone: () => void
}) {
  return (
    <button
      onClick={() => {
        onClick()
        onDone()
      }}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left text-fg-secondary transition-colors hover:text-fg hover:bg-fg/5"
    >
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-fg-faint">{hint}</span>}
    </button>
  )
}
