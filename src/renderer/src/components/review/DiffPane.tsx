import { useEffect, useMemo, useRef, useState } from 'react'
import type { RepoChange } from '../../../../shared/repository'
import { CheckGlyph, CopyGlyph, CloseGlyph, DocGlyph, MinusGlyph, MoreGlyph, PlusGlyph, UndoGlyph } from '../../icons'
import { useBrowser } from '../../state/browser'
import { toast } from '../../state/toast'
import Counts from '../Counts'
import DiffLines from '../DiffLines'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { folderOf, markOf, mayDiscard, nameOf } from './ChangeRow'
import { reviewRows } from './reviewRows'

const act =
  'flex h-6 w-6 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90'

// The file being read, under the list it was picked from. It is the whole width
// of the panel and most of its height, which is the only shape a line of code
// can really be judged in here.
export default function DiffPane({
  change,
  viewed,
  onViewed,
  onClose,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  viewed: boolean
  onViewed: () => void
  onClose: () => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const [menu, setMenu] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const openFile = useBrowser(s => s.openFile)
  const rows = useMemo(() => reviewRows(change.diff), [change.diff])
  const mark = markOf(change)
  const name = nameOf(change.path)
  const folder = folderOf(change.path)
  const discards = mayDiscard(change)
  const shut = () => setMenu(false)

  // A file arrived at by walking the list is read from the top of itself, or
  // the second file lands wherever the first one was left standing.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
  }, [change.path, change.staged])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 pl-2.5 pr-1">
        <Tooltip label={change.previousPath ? `${mark.word} from ${change.previousPath}` : mark.word}>
          <span className={`shrink-0 font-mono text-[11px] font-semibold ${mark.tone}`}>{mark.letter}</span>
        </Tooltip>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          <span className={`text-fg ${change.kind === 'deleted' ? 'line-through' : ''}`}>{name}</span>
          {folder && <span className="ml-1.5 text-xs text-fg-faint">{folder}</span>}
        </span>
        <Counts added={change.added} removed={change.removed} />
        {/* Done reading is the press this screen is really for, so it says the
            word rather than wearing a mark somebody has to learn. Marking it
            takes you to the next file, because that is the whole of what a
            review is made of and doing it in two presses is doing it twice. */}
        <button
          onClick={onViewed}
          aria-pressed={viewed}
          className={`flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-colors active:scale-95 ${
            viewed ? 'bg-fg/15 text-fg' : 'text-fg-muted hover:bg-fg/10 hover:text-fg'
          }`}
        >
          <CheckGlyph className="w-3.5 h-3.5" />
          Viewed
        </button>
        <div className="relative shrink-0">
          <Tooltip label="More" disabled={menu}>
            <button aria-label={`More for ${name}`} onClick={() => setMenu(true)} className={act}>
              <MoreGlyph className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Popover open={menu} onClose={shut} align="end">
            <MenuItem
              icon={change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
              label={change.staged ? 'Unstage changes' : 'Stage changes'}
              onClick={() => {
                shut()
                if (change.staged) onUnstage()
                else onStage()
              }}
            />
            <MenuItem
              icon={<DocGlyph className="w-4 h-4" />}
              label="Open file"
              onClick={() => {
                shut()
                openFile(change.path)
              }}
            />
            <MenuItem
              icon={<CopyGlyph className="w-4 h-4" />}
              label="Copy path"
              onClick={() => {
                shut()
                void navigator.clipboard?.writeText(change.path)
                toast.done('Path copied', { key: 'repo' })
              }}
            />
            {discards && (
              <>
                <MenuDivider />
                <MenuItem
                  icon={<UndoGlyph className="w-4 h-4" />}
                  label="Discard changes"
                  danger
                  onClick={() => {
                    shut()
                    onDiscard()
                  }}
                />
              </>
            )}
          </Popover>
        </div>
        <Tooltip label="Close">
          <button aria-label={`Close ${name}`} onClick={onClose} className={act}>
            <CloseGlyph className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-ink-850">
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
                <p className="px-3 pt-2 text-xs text-fg-faint">
                  The rest is too long to show. Open the file to read it.
                </p>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
