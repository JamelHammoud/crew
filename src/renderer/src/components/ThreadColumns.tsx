import { useCrew } from '../state/store'
import ThreadView from '../views/ThreadView'

// A column never goes narrower than this. It holds a composer, a diff and a
// terminal card, and the row scrolls sideways rather than squeezing them: a
// column too narrow to read is a column nobody opened on purpose. It is half
// the width the window itself may be, so two columns fit in the smallest window
// there is and the row only ever scrolls once there is really nowhere to put
// the next one.
export const COLUMN_MIN = 400

export default function ThreadColumns({ ids }: { ids: string[] }) {
  const focused = useCrew(s => s.openThreadId)
  const focusThread = useCrew(s => s.focusThread)
  const many = ids.length > 1

  return (
    // The bar down the bottom of the row is off. It is 10 pixels of real
    // height, so the frame a row starts scrolling on is the frame every column
    // shortens and every composer jumps up the screen, and what says there is
    // more to the right is already there: the column at the edge, cut off.
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
