import { useMemo, useState, type MouseEvent } from 'react'
import type { RepoChange, RepoChangeKind } from '../../../../shared/repository'
import {
  CheckGlyph,
  ChevronRightGlyph,
  ClipboardGlyph,
  ColumnsGlyph,
  DocGlyph,
  MinusGlyph,
  PlusGlyph,
  UndoGlyph
} from '../../icons'
import { useBrowser } from '../../state/browser'
import { toast } from '../../state/toast'
import Counts from '../Counts'
import DiffLines from '../DiffLines'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { reviewRows } from './reviewRows'

// The letter every git client puts at the end of the row. It is the same on
// most rows and that is the point of it: muted, it is a place to look rather
// than a thing to read, and the whole of its worth is the row where it differs.
// Only the two the tone cannot carry are colored, since a file added and a file
// deleted are the two moves worth seeing before the name is read.
const LETTERS: Record<RepoChangeKind, { letter: string; word: string; tone: string }> = {
  modified: { letter: 'M', word: 'Modified', tone: 'text-fg-faint' },
  added: { letter: 'A', word: 'Added', tone: 'text-positive' },
  deleted: { letter: 'D', word: 'Deleted', tone: 'text-danger' },
  renamed: { letter: 'R', word: 'Renamed', tone: 'text-fg-faint' },
  copied: { letter: 'C', word: 'Copied', tone: 'text-fg-faint' },
  conflict: { letter: '!', word: 'Conflict', tone: 'text-danger' }
}

// A file git has never been told about comes back as an add that is not staged,
// since nothing can stage itself. That is the one kind the record does not name
// on its own, and it is worth naming: a file nobody has added yet is a file that
// commits by nobody's decision.
const UNTRACKED = { letter: 'U', word: 'Untracked', tone: 'text-positive' }

const action =
  'flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90'

type At = { x: number; y: number }

export default function ChangeRow({
  change,
  open,
  viewed,
  onToggle,
  onViewed,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  open: boolean
  viewed: boolean
  onToggle: () => void
  onViewed: (viewed: boolean) => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const [menu, setMenu] = useState<At | null>(null)
  const openFile = useBrowser(s => s.openFile)
  const rows = useMemo(() => (open ? reviewRows(change.diff) : []), [open, change.diff])
  const mark = change.kind === 'added' && !change.staged ? UNTRACKED : LETTERS[change.kind]
  const name = change.path.split('/').pop() ?? change.path
  const folder = change.path.slice(0, change.path.length - name.length).replace(/\/$/, '')

  const shut = () => setMenu(null)
  const held = (event: MouseEvent) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  return (
    <div className="group rounded-card overflow-hidden bg-ink-800">
      <div className="flex items-center" onContextMenu={held}>
        <button
          onClick={onToggle}
          aria-expanded={open}
          className={`flex h-10 min-w-0 flex-1 items-center gap-2 pl-2.5 text-left transition-opacity duration-150 ${
            viewed && !open ? 'opacity-45' : ''
          }`}
        >
          <ChevronRightGlyph
            className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="text-fg-secondary">{name}</span>
            {folder && <span className="ml-1.5 text-xs text-fg-faint">{folder}</span>}
          </span>
          <Counts added={change.added} removed={change.removed} />
        </button>
        <div className="flex shrink-0 items-center pr-2">
          {/* The slot is held whether or not the pointer is there, so nothing
              on the row travels as it is reached for, and a staged row with one
              move in it lines up with an unstaged row that has two. */}
          <span className="flex w-14 items-center justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
            {!change.staged && (
              <Tooltip label="Discard changes">
                <button aria-label={`Discard changes in ${name}`} onClick={onDiscard} className={action}>
                  <UndoGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label={change.staged ? 'Unstage changes' : 'Stage changes'}>
              <button
                aria-label={change.staged ? `Unstage ${name}` : `Stage ${name}`}
                onClick={change.staged ? onUnstage : onStage}
                className={action}
              >
                {change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
              </button>
            </Tooltip>
          </span>
          {/* Viewed is a state before it is a button, and the row going quiet is
              what really says it, so the mark is the quietest thing on the row
              rather than the loudest. White is the one action color and this is
              not the action. Not viewed, it is nothing at all until the pointer
              is there: a column of empty circles down a list of files is a
              column asking to be dealt with, and most of them never are. */}
          <Tooltip label={viewed ? 'Mark as not viewed' : 'Mark as viewed'}>
            <button
              aria-label={viewed ? `Mark ${name} as not viewed` : `Mark ${name} as viewed`}
              aria-pressed={viewed}
              onClick={() => onViewed(!viewed)}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg ${
                viewed ? 'text-fg-muted' : 'text-transparent group-hover:text-fg-faint'
              }`}
            >
              <CheckGlyph className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip label={change.previousPath ? `${mark.word} from ${change.previousPath}` : mark.word}>
            <span className={`w-4 shrink-0 text-center font-mono text-xs ${mark.tone}`}>{mark.letter}</span>
          </Tooltip>
        </div>
        <Popover open={menu !== null} onClose={shut} at={menu ?? undefined}>
          <MenuItem
            icon={<ColumnsGlyph className="w-4 h-4" />}
            label="Open changes"
            onClick={() => {
              shut()
              openFile(change.path, null, change.diff)
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
            icon={<ClipboardGlyph className="w-4 h-4" />}
            label="Copy path"
            onClick={() => {
              shut()
              void navigator.clipboard?.writeText(change.path)
              toast.done('Path copied', { key: 'repo' })
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
            label={change.staged ? 'Unstage changes' : 'Stage changes'}
            onClick={() => {
              shut()
              if (change.staged) onUnstage()
              else onStage()
            }}
          />
          {!change.staged && (
            <MenuItem
              icon={<UndoGlyph className="w-4 h-4" />}
              label="Discard changes"
              danger
              onClick={() => {
                shut()
                onDiscard()
              }}
            />
          )}
        </Popover>
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
                  onViewed(true)
                  onToggle()
                }}
                className="flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-95"
              >
                <CheckGlyph className="w-3.5 h-3.5" />
                Mark as viewed
              </button>
            </div>
          </>
        ))}
    </div>
  )
}
