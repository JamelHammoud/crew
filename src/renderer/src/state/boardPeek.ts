import { useEffect, useState } from 'react'
import type { DesignDocument } from '../../../shared/design'
import { onDesign, useCrew } from './store'

const seen = new Map<string, DesignDocument | null>()

onDesign(msg => {
  if (msg.type === 'design.changes') seen.delete(msg.boardId)
})

export function forgetBoardPeeks(): void {
  seen.clear()
}

export function useBoardPeek(boardId: string): DesignDocument | null | undefined {
  const peekDesign = useCrew(s => s.peekDesign)
  const [document, setDocument] = useState<DesignDocument | null | undefined>(() => seen.get(boardId))
  useEffect(() => {
    setDocument(seen.get(boardId))
    const stop = onDesign(msg => {
      if (msg.boardId !== boardId) return
      if (msg.type === 'design.preview') {
        seen.set(boardId, msg.document)
        setDocument(msg.document)
      }
      if (msg.type === 'design.changes') peekDesign(boardId)
    })
    if (!seen.has(boardId)) peekDesign(boardId)
    return stop
  }, [boardId, peekDesign])
  return document
}
