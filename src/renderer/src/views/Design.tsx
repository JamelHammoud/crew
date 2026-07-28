import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContext, type Editor, type TLShape } from 'tldraw'
import { HeaderButton } from '../components/DesignControls'
import DesignLeftPanel from '../components/DesignLeftPanel'
import { BoardSwitcher, DesignBoardContext, DesignRenameContext, DesignZoom } from '../components/DesignPanels'
import DesignRightPanel from '../components/DesignRightPanel'
import DesignStage from '../components/DesignStage'
import { PanelLeftGlyph, PanelRightGlyph } from '../design/glyphs'
import { lastBoard, lastPanels, rememberBoard, rememberPanels } from '../design/viewMemory'
import { TOP_BAR_H } from '../components/TopBar'
import { useCrew } from '../state/store'

const HEADER_LIFT = 10
const GLYPH = 'w-[18px] h-[18px] transition-transform duration-200'

export default function Design() {
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const designTarget = useCrew(s => s.designTarget)
  const clearDesignTarget = useCrew(s => s.clearDesignTarget)
  const [selected, setSelected] = useState<string | null>(designTarget ?? lastBoard)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [panels, setPanels] = useState(lastPanels)
  const [renaming, setRenaming] = useState<string | null>(null)

  const current = selected && boards.some(b => b.id === selected) ? selected : (boards[0]?.id ?? null)
  const boardContext = useMemo(() => ({ current: current ?? '', select: setSelected }), [current])
  const renameContext = useMemo(() => ({ requested: renaming, request: setRenaming }), [renaming])

  const askRename = useCallback((shape: TLShape) => {
    setPanels(value => (value.left ? value : { ...value, left: true }))
    setRenaming(shape.id)
  }, [])

  const showChat = useCallback(() => {
    setPanels(value => (value.right ? value : { ...value, right: true }))
  }, [])

  useEffect(() => {
    if (current) rememberBoard(current)
  }, [current])

  useEffect(() => {
    if (!designTarget) return
    setSelected(designTarget)
    clearDesignTarget()
  }, [designTarget, clearDesignTarget])

  useEffect(() => {
    rememberPanels(panels)
  }, [panels])

  if (!current) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-8"
        style={{ paddingTop: TOP_BAR_H }}
      >
        <button
          onClick={() => setSelected(createBoard('Untitled'))}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95"
        >
          New board
        </button>
      </div>
    )
  }

  return (
    <DesignBoardContext.Provider value={boardContext}>
      <DesignRenameContext.Provider value={renameContext}>
        <EditorContext.Provider value={editor}>
          <div className="h-full flex flex-col" style={{ paddingTop: TOP_BAR_H - HEADER_LIFT }}>
            <div className="app-drag relative z-50 h-10 shrink-0 flex items-center gap-1 px-2">
              <HeaderButton
                label={panels.left ? 'Hide layers' : 'Show layers'}
                pressed={panels.left}
                onClick={() => setPanels(value => ({ ...value, left: !value.left }))}
              >
                <PanelLeftGlyph className={`${GLYPH} ${panels.left ? '' : 'scale-x-[-1]'}`} />
              </HeaderButton>
              <BoardSwitcher />
              <div className="ml-auto flex items-center gap-1">
                {editor && <DesignZoom />}
                <HeaderButton
                  label={panels.right ? 'Hide board panel' : 'Show board panel'}
                  pressed={panels.right}
                  onClick={() => setPanels(value => ({ ...value, right: !value.right }))}
                >
                  <PanelRightGlyph className={`${GLYPH} ${panels.right ? '' : 'scale-x-[-1]'}`} />
                </HeaderButton>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex">
              {panels.left && editor && <DesignLeftPanel />}
              <DesignStage
                boardId={current}
                editor={editor}
                onEditor={setEditor}
                onRename={askRename}
                onAsked={showChat}
              />
              {panels.right && editor && <DesignRightPanel boardId={current} />}
            </div>
          </div>
        </EditorContext.Provider>
      </DesignRenameContext.Provider>
    </DesignBoardContext.Provider>
  )
}
