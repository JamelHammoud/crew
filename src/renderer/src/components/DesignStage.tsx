import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor, TLShape } from 'tldraw'
import { commandForKey, type CommandContext } from '../design/commands'
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

  const ctx: CommandContext | null = useMemo(
    () => (editor ? { editor, point: null, ask, rename: onRename } : null),
    [editor, ask, onRename]
  )

  useEffect(() => {
    if (!ctx) return
    const onKeyDown = (event: KeyboardEvent) => {
      const command = commandForKey(event, ctx)
      if (!command) return
      event.preventDefault()
      event.stopPropagation()
      command.run(ctx)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [ctx])

  useEffect(() => setAsking(false), [boardId])

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
