import { useCrew } from '../state/store'
import ThreadView from '../views/ThreadView'

// A column never goes narrower than this. It holds a composer, a diff and a
// terminal card, and the row scrolls sideways rather than squeezing them: a
// column too narrow to read is a column nobody opened on purpose.
export const COLUMN_MIN = 460

export default function ThreadColumns({ ids }: { ids: string[] }) {
  const focused = useCrew(s => s.openThreadId)
  const focusThread = useCrew(s => s.focusThread)
  const many = ids.length > 1

  return (
    <div className="h-full flex overflow-x-auto overflow-y-hidden">
      {ids.map(id => (
        <div
          key={id}
          onPointerDownCapture={() => focusThread(id)}
          onFocusCapture={() => focusThread(id)}
          style={{ minWidth: COLUMN_MIN }}
          className="h-full flex-1 relative border-l border-ink-700 first:border-l-0"
        >
          <ThreadView threadId={id} many={many} focused={id === focused} />
        </div>
      ))}
    </div>
  )
}
