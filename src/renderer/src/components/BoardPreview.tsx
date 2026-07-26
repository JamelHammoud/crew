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
    <div
      data-board-preview={boardId}
      className="-mx-3 -mb-3 mt-2.5 aspect-[16/9] overflow-hidden rounded-b-2xl border-t border-fg/[0.06] bg-ink-950 light:bg-ink-800"
    >
      {document && (
        <Suspense fallback={null}>
          <BoardImage document={document} />
        </Suspense>
      )}
    </div>
  )
}
