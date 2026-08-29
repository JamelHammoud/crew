import { useCallback, useEffect, useMemo, useState } from 'react'
import { attachmentBytes, attachmentMbLabel, isImageType } from '../../../shared/attachments'
import type { Editor, TLShape } from '../canvas'
import { commandForKey, runCommand, type CommandContext } from '../design/commands'
import { keyIsTheBoards } from '../design/designKeys'
import { pasteImages } from '../design/pasteImages'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import DesignAskBar from './DesignAskBar'
import DesignCanvas from './DesignCanvas'
import DesignContextMenu, { useContextMenu } from './DesignContextMenu'
import DesignToolbar from './DesignToolbar'
import type { DesignPanelsOpen } from './designPanelsOpen'

export default function DesignStage({
  boardId,
  editor,
  onEditor,
  onRename,
  onAsked,
  panels,
  onPanels
}: {
  boardId: string
  editor: Editor | null
  onEditor: (editor: Editor | null) => void
  onRename: (shape: TLShape) => void
  onAsked: () => void
  panels: DesignPanelsOpen
  onPanels: (next: (value: DesignPanelsOpen) => DesignPanelsOpen) => void
}) {
  const [asking, setAsking] = useState(false)
  const { spot, close } = useContextMenu(editor)
  const httpBase = useCrew(state => state.httpBase)
  const attachmentMb = useCrew(state => state.attachmentMb)

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
      if (command.id === 'paste') return
      event.preventDefault()
      event.stopPropagation()
      command.run(ctx)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [ctx])

  useEffect(() => {
    if (!ctx) return
    const onPaste = (event: ClipboardEvent) => {
      if (!keyIsTheBoards(event.target) || ctx.editor.getEditingShapeId()) return
      const images = [...(event.clipboardData?.files ?? [])].filter(file => isImageType(file.type))
      if (images.length === 0) {
        runCommand('paste', ctx)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const limit = attachmentBytes(attachmentMb)
      const accepted = images.filter(file => file.size <= limit)
      if (accepted.length !== images.length) {
        toast.fail(`Images can be up to ${attachmentMbLabel(attachmentMb)}`, { key: 'design-image-size' })
      }
      if (accepted.length === 0) return
      void pasteImages(ctx.editor, accepted, httpBase).catch(() => {
        toast.fail('Crew could not paste that image', { key: 'design-image-paste' })
      })
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  }, [ctx, httpBase, attachmentMb])

  useEffect(() => setAsking(false), [boardId])

  return (
    <div className="flex-1 min-w-0 relative">
      <DesignCanvas key={boardId} boardId={boardId} asking={asking} onEditor={onEditor} />
      <div data-design-scrim className="design design-scrim absolute inset-x-0 top-0 z-10 pointer-events-none" />
      {editor && (
        <>
          <DesignToolbar boardId={boardId} onAsk={ask} onRename={onRename} panels={panels} onPanels={onPanels} />
          <DesignContextMenu spot={spot} onClose={close} onAsk={ask} onRename={onRename} />
          <DesignAskBar boardId={boardId} open={asking} onClose={stopAsking} onSent={onAsked} />
        </>
      )}
    </div>
  )
}
