import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownGlyph, DocGlyph } from '../icons'
import Counts from './Counts'

// What floats over the composer while a thread is scrolled up: the way back to
// the foot of it, and what the run has changed by the time you get there. Both
// stand on glass, so nothing on either is set in a solid grey.
const pill =
  'glass absolute -top-14 z-20 pointer-events-auto flex items-center h-9 rounded-full text-sm font-medium text-fg/70 transition-all duration-150 hover:text-fg active:scale-95 animate-pop'

export const JumpToBottom = forwardRef<HTMLButtonElement, { onClick: () => void }>(function JumpToBottom(
  { onClick },
  ref
) {
  return (
    <button ref={ref} onClick={onClick} className={`${pill} left-1/2 -translate-x-1/2 gap-1.5 pl-3 pr-4`}>
      <ArrowDownGlyph className="w-4 h-4" />
      Jump to bottom
    </button>
  )
})

// The counts move while the run does, so this says what the card at the foot of
// the thread says without having to be down there reading it.
export const FilesJump = forwardRef<
  HTMLButtonElement,
  {
    files: number
    added: number
    removed: number
    onClick: () => void
    hidden?: boolean
  }
>(function FilesJump({ files, added, removed, onClick, hidden = false }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`${pill} right-0 gap-2 px-3.5 ${hidden ? 'invisible' : ''}`}
    >
      <DocGlyph className="w-4 h-4" />
      {files} {files === 1 ? 'file' : 'files'}
      <Counts added={added} removed={removed} />
    </button>
  )
})

const CONTROL_GAP = 8

export function filesJumpFits(rowWidth: number, jumpWidth: number, filesWidth: number): boolean {
  if (rowWidth <= 0 || jumpWidth <= 0 || filesWidth <= 0) return true
  return rowWidth - filesWidth - CONTROL_GAP >= rowWidth / 2 + jumpWidth / 2
}

export function ThreadJumps({
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
  const rowRef = useRef<HTMLDivElement>(null)
  const jumpRef = useRef<HTMLButtonElement>(null)
  const filesRef = useRef<HTMLButtonElement>(null)
  const [showFiles, setShowFiles] = useState(true)

  useLayoutEffect(() => {
    const row = rowRef.current
    const jump = jumpRef.current
    const changed = filesRef.current
    if (!row || !jump || !changed) return

    const measure = () => setShowFiles(filesJumpFits(row.clientWidth, jump.offsetWidth, changed.offsetWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    observer.observe(jump)
    observer.observe(changed)
    return () => observer.disconnect()
  }, [added, files, removed])

  return (
    <div ref={rowRef} className="absolute inset-x-0 top-0 h-0 pointer-events-none">
      <JumpToBottom ref={jumpRef} onClick={onClick} />
      <FilesJump
        ref={filesRef}
        files={files}
        added={added}
        removed={removed}
        onClick={onClick}
        hidden={!showFiles}
      />
    </div>
  )
}
