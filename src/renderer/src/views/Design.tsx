import { PencilIcon, PlusIcon, RectangleGroupIcon, TrashIcon } from '@heroicons/react/16/solid'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import DesignCanvas from '../components/DesignCanvas'
import DesignChat from '../components/DesignChat'
import { MenuItem, Popover } from '../components/Popover'
import Tooltip from '../components/Tooltip'
import { useCrew } from '../state/store'

export default function Design() {
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const renameBoard = useCrew(s => s.renameBoard)
  const deleteBoard = useCrew(s => s.deleteBoard)
  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const renameRef = useRef<HTMLInputElement>(null)

  const current = selected && boards.some(b => b.id === selected) ? selected : (boards[0]?.id ?? null)

  useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        renameRef.current?.focus()
        renameRef.current?.select()
      })
    }
  }, [renaming])

  const startCreate = () => {
    const id = createBoard('Untitled')
    setSelected(id)
    setRenaming(id)
    setDraft('Untitled')
  }

  const startRename = (id: string) => {
    setRenaming(id)
    setDraft(boards.find(b => b.id === id)?.name ?? '')
  }

  const commitRename = () => {
    if (renaming) {
      const clean = draft.trim()
      if (clean && clean !== boards.find(b => b.id === renaming)?.name) renameBoard(renaming, clean)
    }
    setRenaming(null)
  }

  return (
    <div className="h-full flex">
      <aside className="w-56 shrink-0 flex flex-col min-h-0 pt-24 pb-6 pl-6 pr-2">
        <span className="text-sm font-semibold text-fg-muted px-3.5 mb-2">Boards</span>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {boards.map(board => {
            const active = board.id === current
            return (
              <div
                key={board.id}
                onContextMenu={e => {
                  e.preventDefault()
                  setMenu({ id: board.id, x: e.clientX, y: e.clientY })
                }}
                className={`flex items-center rounded-full transition-all duration-150 ${
                  active ? 'bg-ink-800' : 'hover:bg-fg/[0.04]'
                }`}
              >
                {renaming === board.id ? (
                  <input
                    ref={renameRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className="flex-1 min-w-0 bg-transparent px-3.5 py-1.5 text-sm font-semibold text-fg outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setSelected(board.id)}
                    onDoubleClick={() => startRename(board.id)}
                    className={`flex-1 min-w-0 flex items-center gap-1.5 text-left px-3.5 py-1.5 text-sm font-semibold ${
                      active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
                    }`}
                  >
                    <RectangleGroupIcon className="w-4 h-4 shrink-0 opacity-60" />
                    <span className="truncate">{board.name}</span>
                  </button>
                )}
              </div>
            )
          })}
          <div className="h-10" />
        </div>
        <button
          onClick={startCreate}
          className="mt-1 w-full flex items-center gap-2 text-left px-3.5 py-2 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary hover:bg-fg/[0.04]"
        >
          <PlusIcon className="w-4 h-4 shrink-0" />
          New board
        </button>
        <Popover open={menu !== null} onClose={() => setMenu(null)} at={menu ?? undefined} align="start">
          <MenuItem
            icon={<PencilIcon />}
            label="Rename board"
            onClick={() => {
              if (menu) startRename(menu.id)
              setMenu(null)
            }}
          />
          <MenuItem
            icon={<TrashIcon />}
            label="Delete board"
            danger
            onClick={() => {
              if (menu) deleteBoard(menu.id)
              setMenu(null)
            }}
          />
        </Popover>
      </aside>
      <div className="flex-1 min-w-0 relative">
        {current ? (
          <div className="absolute inset-x-0 bottom-0 top-[70px]">
            <DesignCanvas key={current} boardId={current} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-base text-fg-muted max-w-sm">
              Sketch screens and diagrams together. Agents you mention in board chat draw here too, cursors and
              all.
            </p>
            <button
              onClick={startCreate}
              className="h-10 px-5 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
            >
              New board
            </button>
          </div>
        )}
        {current && !chatOpen && (
          <Tooltip label="Board chat">
            <button
              onClick={() => setChatOpen(true)}
              aria-label="Board chat"
              className="absolute bottom-6 right-6 w-11 h-11 rounded-full glass text-fg flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" strokeWidth={1.8} />
            </button>
          </Tooltip>
        )}
      </div>
      {current && chatOpen && <DesignChat key={current} boardId={current} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
