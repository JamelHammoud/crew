import { ChatBubbleLeftRightIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { EditorContext, type Editor } from 'tldraw'
import DesignCanvas from '../components/DesignCanvas'
import DesignLeftPanel from '../components/DesignLeftPanel'
import { BoardSwitcher, DesignBoardContext, DesignZoom } from '../components/DesignPanels'
import DesignRightPanel from '../components/DesignRightPanel'
import DesignToolbar from '../components/DesignToolbar'
import Tooltip from '../components/Tooltip'
import { TOP_BAR_H } from '../components/TopBar'
import { useCrew } from '../state/store'

export default function Design() {
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  const current = selected && boards.some(b => b.id === selected) ? selected : (boards[0]?.id ?? null)
  const boardContext = useMemo(() => ({ current: current ?? '', select: setSelected }), [current])

  if (!current) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-base text-fg-muted max-w-sm">
          Sketch screens and diagrams together. Agents you mention in board chat draw here too, cursors and all.
        </p>
        <button
          onClick={() => setSelected(createBoard('Untitled'))}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
        >
          New board
        </button>
      </div>
    )
  }

  return (
    <DesignBoardContext.Provider value={boardContext}>
      <EditorContext.Provider value={editor}>
        <div className="h-full flex flex-col" style={{ paddingTop: TOP_BAR_H }}>
          <div className="h-11 shrink-0 flex items-center gap-1 px-2 border-b border-ink-700">
            <PanelToggle
              label="Layers"
              open={leftOpen}
              onClick={() => setLeftOpen(value => !value)}
              icon={<Squares2X2Icon className="w-4 h-4" strokeWidth={1.8} />}
            />
            <BoardSwitcher />
            <div className="ml-auto flex items-center gap-1">
              {editor && <DesignZoom />}
              <PanelToggle
                label="Board panel"
                open={rightOpen}
                onClick={() => setRightOpen(value => !value)}
                icon={<ChatBubbleLeftRightIcon className="w-4 h-4" strokeWidth={1.8} />}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 flex">
            {leftOpen && editor && <DesignLeftPanel />}
            <div className="flex-1 min-w-0 relative">
              <DesignCanvas key={current} boardId={current} onEditor={setEditor} />
              {editor && <DesignToolbar />}
            </div>
            {rightOpen && editor && <DesignRightPanel boardId={current} onClose={() => setRightOpen(false)} />}
          </div>
        </div>
      </EditorContext.Provider>
    </DesignBoardContext.Provider>
  )
}

function PanelToggle({
  label,
  open,
  onClick,
  icon
}: {
  label: string
  open: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <Tooltip label={open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={open}
        className={`app-no-drag w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 ${
          open ? 'text-fg bg-fg/[0.08]' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
        }`}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
