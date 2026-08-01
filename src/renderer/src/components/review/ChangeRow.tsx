import { useMemo, useState } from 'react'
import type { RepoChange, RepoChangeKind } from '../../../../shared/repository'
import {
  CheckGlyph,
  ChevronRightGlyph,
  DocGlyph,
  MinusGlyph,
  MoreGlyph,
  PlusGlyph,
  UndoGlyph
} from '../../icons'
import { useBrowser } from '../../state/browser'
import Counts from '../Counts'
import DiffLines from '../DiffLines'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { reviewRows } from './reviewRows'

// Only the kinds the counts cannot say stand for themselves. A file with lines
// added and none taken away is a file with lines added, and a letter beside it
// saying so is a column of type that is right on every row and useful on none.
// Gone and new are the two the counts really cannot tell apart, since a file
// deleted and a file cut down to nothing read the same in figures, and a clash
// is worth a mark for being the one thing here somebody has to settle by hand.
const KINDS: Partial<Record<RepoChangeKind, { letter: string; word: string; tone: string }>> = {
  added: { letter: 'A', word: 'New file', tone: 'text-positive' },
  deleted: { letter: 'D', word: 'Deleted', tone: 'text-danger' },
  renamed: { letter: 'R', word: 'Moved', tone: 'text-fg-muted' },
  conflict: { letter: '!', word: 'Clashing', tone: 'text-danger' }
}

const action =
  'flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90'

export default function ChangeRow({
  change,
  open,
  read,
  onToggle,
  onRead,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  open: boolean
  read: boolean
  onToggle: () => void
  onRead: (read: boolean) => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const [menu, setMenu] = useState(false)
  const openFile = useBrowser(s => s.openFile)
  const rows = useMemo(() => (open ? reviewRows(change.diff) : []), [open, change.diff])
  const kind = KINDS[change.kind]
  const name = change.path.split('/').pop() ?? change.path
  const folder = change.path.slice(0, change.path.length - name.length).replace(/\/$/, '')

  return (
    <div className="group rounded-card overflow-hidden bg-ink-800">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className={`flex h-10 min-w-0 flex-1 items-center gap-2 pl-2.5 text-left transition-opacity duration-150 ${
            read && !open ? 'opacity-45' : ''
          }`}
        >
          <ChevronRightGlyph
            className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          {kind && (
            <Tooltip label={change.previousPath ? `${kind.word} from ${change.previousPath}` : kind.word}>
              <span className={`w-3 shrink-0 text-center font-mono text-xs ${kind.tone}`}>{kind.letter}</span>
            </Tooltip>
          )}
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="text-fg-secondary">{name}</span>
            {folder && <span className="ml-1.5 text-xs text-fg-faint">{folder}</span>}
          </span>
          <Counts added={change.added} removed={change.removed} />
        </button>
        <div className="flex shrink-0 items-center pr-1.5">
          {/* The slot is held whether or not the pointer is there, so nothing
              on the row travels as it is reached for. */}
          <span className="flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip label={change.staged ? 'Take it out' : 'Put it in'}>
              <button
                aria-label={change.staged ? 'Take it out' : 'Put it in'}
                onClick={change.staged ? onUnstage : onStage}
                className={action}
              >
                {change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
              </button>
            </Tooltip>
            <div className="relative">
              <Tooltip label="More" disabled={menu}>
                <button aria-label={`More for ${name}`} onClick={() => setMenu(true)} className={action}>
                  <MoreGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
              <Popover open={menu} onClose={() => setMenu(false)} align="end">
                <MenuItem
                  icon={<DocGlyph className="w-4 h-4" />}
                  label="Open the file"
                  onClick={() => {
                    setMenu(false)
                    openFile(change.path, null, change.diff)
                  }}
                />
                {!change.staged && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<UndoGlyph className="w-4 h-4" />}
                      label="Discard"
                      danger
                      onClick={() => {
                        setMenu(false)
                        onDiscard()
                      }}
                    />
                  </>
                )}
              </Popover>
            </div>
          </span>
          {/* Read is a state before it is a button, and the row going quiet is
              what really says it, so the mark is the quietest thing on the row
              rather than the loudest. White is the one action color and this is
              not the action. Unread, it is nothing at all until the pointer is
              there: a slot of empty circles down a list of files is a column
              asking to be dealt with, and most of them never are. */}
          <span className="pl-0.5">
            <Tooltip label={read ? 'Read it again' : 'Mark as read'}>
              <button
                aria-label={read ? 'Read it again' : 'Mark as read'}
                aria-pressed={read}
                onClick={() => onRead(!read)}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg ${
                  read ? 'text-fg-muted' : 'text-transparent group-hover:text-fg-faint'
                }`}
              >
                <CheckGlyph className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </span>
        </div>
      </div>
      {open &&
        (change.binary ? (
          <p className="px-4 pb-3 text-xs text-fg-muted">This one is not text, so there is nothing to read here.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-fg-muted">Nothing in the file itself changed.</p>
        ) : (
          <>
            <DiffLines
              path={change.path}
              rows={rows}
              numbers
              more={
                change.truncated ? (
                  <p className="px-3 pt-2 text-xs text-fg-faint">
                    The rest is too long to show. Open the file to read it.
                  </p>
                ) : undefined
              }
            />
            {/* The end of the reading is where saying so belongs, so finishing
                a file is one press at the place the eye already is. */}
            <div className="flex items-center justify-end border-t border-ink-700 px-2 py-1.5">
              <button
                onClick={() => {
                  onRead(true)
                  onToggle()
                }}
                className="h-7 rounded-full px-3 text-xs font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-95"
              >
                Done
              </button>
            </div>
          </>
        ))}
    </div>
  )
}
