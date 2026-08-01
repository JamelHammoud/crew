import { useCrew } from '../state/store'
import ThreadView from '../views/ThreadView'

export const COLUMN_MIN = 400

export default function ThreadColumns({ ids }: { ids: string[] }) {
  const focused = useCrew(s => s.openThreadId)
  const focusThread = useCrew(s => s.focusThread)
  const many = ids.length > 1

  return (
    <div className="h-full flex overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
