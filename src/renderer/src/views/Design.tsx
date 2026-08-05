import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContext, type Editor, type TLShape } from '../canvas'
import DesignHeader from '../components/DesignHeader'
import DesignLeftPanel from '../components/DesignLeftPanel'
import { DesignBoardContext, DesignRenameContext } from '../components/DesignPanels'
import DesignRightPanel from '../components/DesignRightPanel'
import DesignStage from '../components/DesignStage'
import { firstBoard } from '../design/firstBoard'
import { lastBoard, lastPanels, rememberBoard, rememberPanels } from '../design/viewMemory'
import { useCrew } from '../state/store'

export default function Design() {
  const boards = useCrew(s => s.boards)
  const connection = useCrew(s => s.connection)
  const createBoard = useCrew(s => s.createBoard)
  const designTarget = useCrew(s => s.designTarget)
  const clearDesignTarget = useCrew(s => s.clearDesignTarget)
  const [selected, setSelected] = useState<string | null>(designTarget ?? lastBoard)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [panels, setPanels] = useState(lastPanels)
  const [renaming, setRenaming] = useState<string | null>(null)
  const asked = useRef(false)

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
    const next = firstBoard(connection, boards.length, asked.current)
    if (next === 'have') asked.current = false
    if (next !== 'make') return
    asked.current = true
    setSelected(createBoard('Untitled'))
  }, [connection, boards.length, createBoard])

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

  if (!current) return null

  return (
    <DesignBoardContext.Provider value={boardContext}>
      <DesignRenameContext.Provider value={renameContext}>
        <EditorContext.Provider value={editor}>
          <div className="h-full flex flex-col">
            <DesignHeader editor={editor} panels={panels} />
            <div className="flex-1 min-h-0 flex">
              {panels.left && editor && <DesignLeftPanel onClose={() => setPanels(value => ({ ...value, left: false }))} />}
              <DesignStage
                boardId={current}
                editor={editor}
                onEditor={setEditor}
                onRename={askRename}
                onAsked={showChat}
                panels={panels}
                onPanels={setPanels}
              />
              {panels.right && editor && (
                <DesignRightPanel
                  boardId={current}
                  onClose={() => setPanels(value => ({ ...value, right: false }))}
                />
              )}
            </div>
          </div>
        </EditorContext.Provider>
      </DesignRenameContext.Provider>
    </DesignBoardContext.Provider>
  )
}
