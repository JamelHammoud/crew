import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { RepoChange } from '../../../../shared/repository'
import { CheckGlyph, ChevronDownGlyph, ChevronLeftGlyph, ChevronUpGlyph, MinusGlyph, PlusGlyph, UndoGlyph } from '../../icons'
import Counts from '../Counts'
import DiffLines from '../DiffLines'
import Tooltip from '../Tooltip'
import { folderOf, markOf, mayDiscard, nameOf } from './ChangeRow'
import { reviewRows } from './reviewRows'

const step =
  'flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-25'

const foot =
  'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-95'

// One file, with the whole panel to be read in. Reading is what this screen is
// for and everything on it is either the code or the way through it: the way
// back, which file of how many, the two ways to walk, and the one press that
// says this one is done and moves on.
export default function FileRead({
  change,
  at,
  of,
  viewed,
  onBack,
  onStep,
  onViewed,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  at: number
  of: number
  viewed: boolean
  onBack: () => void
  onStep: (by: 1 | -1) => void
  onViewed: () => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => reviewRows(change.diff), [change.diff])
  const mark = markOf(change)
  const name = nameOf(change.path)
  const folder = folderOf(change.path)
  const discards = mayDiscard(change)
  const more = at < of
  const less = at > 1

  // A file arrived at by walking is read from the top of itself, or the second
  // file lands wherever the first one was left standing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is what says a different file arrived
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    scroller.current?.focus({ preventScroll: true })
  }, [change.path, change.staged])

  // Done is marking it and moving on, which is the whole of what a review is
  // made of, so it is one press rather than two. A file already viewed has
  // nothing left to say about it, so the press is only the moving on, and the
  // last file has nowhere to move on to but the list.
  const done = () => {
    if (!viewed) onViewed()
    if (more) onStep(1)
    else onBack()
  }

  const says = !viewed ? 'Viewed' : more ? 'Next file' : 'Done'

  // The keys are the reading screen's own and are read off the box the code is
  // in, never off the window, so nothing here reaches a composer somebody is
  // typing in. The arrows are left to the scrolling they already do.
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const hit: Record<string, () => void> = {
      j: () => more && onStep(1),
      k: () => less && onStep(-1),
      v: done,
      Escape: onBack
    }
    const act = hit[event.key]
    if (!act) return
    event.preventDefault()
    act()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-ink-700 pl-1 pr-1.5">
        <Tooltip label="Back to the files">
          <button aria-label="Back to the files" onClick={onBack} className={step}>
            <ChevronLeftGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <Tooltip label={mark.word}>
              <span className={`shrink-0 font-mono text-[11px] font-semibold ${mark.tone}`}>{mark.letter}</span>
            </Tooltip>
            <span
              className={`min-w-0 flex-1 truncate text-[13px] text-fg ${change.kind === 'deleted' ? 'line-through' : ''}`}
            >
              {name}
            </span>
            <Counts added={change.added} removed={change.removed} />
          </div>
          {folder && <p className="truncate text-[11px] text-fg-faint">{folder}</p>}
        </div>
        {/* Which file of how many, with a way either side of it. It is the one
            thing the reading screen cannot say on its own, and it is what makes
            walking the review possible without going back to the list. */}
        <div className="flex shrink-0 items-center">
          <Tooltip label="Previous file">
            <button aria-label="Previous file" onClick={() => onStep(-1)} disabled={!less} className={step}>
              <ChevronUpGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <span className="px-0.5 font-mono text-[11px] tabular-nums text-fg-faint">
            {at}/{of}
          </span>
          <Tooltip label="Next file">
            <button aria-label="Next file" onClick={() => onStep(1)} disabled={!more} className={step}>
              <ChevronDownGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </header>

      <div
        ref={scroller}
        tabIndex={-1}
        onKeyDown={keys}
        className="min-h-0 flex-1 overflow-y-auto bg-ink-850 focus:outline-none"
      >
        {change.binary ? (
          <p className="p-4 text-xs text-fg-muted">This one is not text, so there is nothing to read here.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-xs text-fg-muted">Nothing in the file itself changed.</p>
        ) : (
          <DiffLines
            path={change.path}
            rows={rows}
            numbers
            wrap
            more={
              change.truncated ? (
                <p className="px-3 pt-2 text-xs text-fg-faint">The rest is too long to show. Open the file to read it.</p>
              ) : undefined
            }
          />
        )}
      </div>

      <footer className="flex h-12 shrink-0 items-center gap-1 border-t border-ink-700 px-2">
        <button onClick={change.staged ? onUnstage : onStage} className={foot}>
          {change.staged ? <MinusGlyph className="w-3.5 h-3.5" /> : <PlusGlyph className="w-3.5 h-3.5" />}
          {change.staged ? 'Unstage' : 'Stage'}
        </button>
        {discards && (
          <button onClick={onDiscard} className={`${foot} hover:text-danger`}>
            <UndoGlyph className="w-3.5 h-3.5" />
            Discard
          </button>
        )}
        <span className="flex-1" />
        <button
          onClick={done}
          className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors active:scale-95 ${
            viewed ? 'bg-fg/10 text-fg-secondary hover:bg-fg/15' : 'bg-fg text-ink-900 hover:bg-fg/90'
          }`}
        >
          {!viewed && <CheckGlyph className="w-3.5 h-3.5" />}
          {says}
          {viewed && more && <ChevronDownGlyph className="w-3.5 h-3.5" />}
        </button>
      </footer>
    </div>
  )
}
