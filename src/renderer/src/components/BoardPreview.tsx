import { lazy, Suspense } from 'react'
import type { DesignDocument } from '../../../shared/design'
import { useBoardPeek } from '../state/boardPeek'

const BoardImage = lazy(() => import('./BoardImage'))

function drawnOn(document: DesignDocument): boolean {
  return Object.keys(document.store).some(id => id.startsWith('shape:'))
}

export default function BoardPreview({ boardId }: { boardId: string }) {
  const document = useBoardPeek(boardId)
  if (document === null) return null
  if (document && !drawnOn(document)) return null
  return (
    <span
      data-board-preview={boardId}
      className="block -mx-3 -mt-3 mb-2.5 aspect-[16/9] overflow-hidden rounded-t-2xl bg-ink-950 light:bg-ink-800"
    >
      {document && (
        <Suspense fallback={null}>
          <BoardImage document={document} />
        </Suspense>
      )}
    </span>
  )
}
