import { ArrowDownGlyph, DocGlyph } from '../icons'
import Counts from './Counts'

// What floats over the composer while a thread is scrolled up: the way back to
// the foot of it, and what the run has changed by the time you get there. Both
// stand on glass, so nothing on either is set in a solid grey.
const pill =
  'glass absolute -top-14 z-20 pointer-events-auto flex items-center h-9 rounded-full text-sm font-medium text-fg/70 transition-all duration-150 hover:text-fg active:scale-95 animate-pop'

export function JumpToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${pill} left-1/2 -translate-x-1/2 gap-1.5 pl-3 pr-4`}>
      <ArrowDownGlyph className="w-4 h-4" />
      Jump to bottom
    </button>
  )
}

// The counts move while the run does, so this says what the card at the foot of
// the thread says without having to be down there reading it.
export function FilesJump({
  files,
  added,
  removed,
  onClick
}: {
  files: number
  added: number
  removed: number
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`${pill} right-0 gap-2 px-3.5`}>
      <DocGlyph className="w-4 h-4" />
      {files} {files === 1 ? 'file' : 'files'}
      <Counts added={added} removed={removed} />
    </button>
  )
}
