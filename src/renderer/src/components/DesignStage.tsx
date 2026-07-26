import { useCallback, useState } from 'react'
import type { Editor, TLShape } from 'tldraw'
import DesignAskBar from './DesignAskBar'
import DesignCanvas from './DesignCanvas'
import DesignContextMenu, { useContextMenu } from './DesignContextMenu'
import DesignToolbar from './DesignToolbar'

export default function DesignStage({
  boardId,
  editor,
  onEditor,
  onRename,
  onAsked
}: {
  boardId: string
  editor: Editor | null
  onEditor: (editor: Editor | null) => void
  onRename: (shape: TLShape) => void
  onAsked: () => void
}) {
  const [asking, setAsking] = useState(false)
  const { spot, close } = useContextMenu(editor)

  const ask = useCallback(() => setAsking(true), [])
  const stopAsking = useCallback(() => setAsking(false), [])

  return (
    <div className="flex-1 min-w-0 relative">
      <DesignCanvas key={boardId} boardId={boardId} onEditor={onEditor} />
      {editor && (
        <>
          <DesignToolbar onAsk={ask} onRename={onRename} />
          <DesignContextMenu spot={spot} onClose={close} onAsk={ask} onRename={onRename} />
          <DesignAskBar boardId={boardId} open={asking} onClose={stopAsking} onSent={onAsked} />
        </>
      )}
    </div>
  )
}
