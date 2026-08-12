import { useState, type MouseEvent } from 'react'
import type { RepoChange, RepoChangeKind } from '../../../../shared/repository'
import { CheckGlyph, CopyGlyph, DocGlyph, MinusGlyph, PlusGlyph, UndoGlyph } from '../../icons'
import { useBrowser } from '../../state/browser'
import { toast } from '../../state/toast'
import Counts from '../Counts'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { keyOf } from './walk'

// The letter git itself puts in front of a path, which is where `git status`
// puts it and where every client that reads like a terminal puts it. It is the
// same on most rows and that is the point of it: read as a column it is a place
// to look rather than a thing to read, and the whole of its worth is the row
// where it differs. Only the two the row cannot otherwise carry are coloured.
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

export const markOf = (change: RepoChange): { letter: string; word: string; tone: string } =>
  change.kind === 'added' && !change.staged ? UNTRACKED : LETTERS[change.kind]

export const nameOf = (path: string): string => path.split('/').pop() ?? path
export const folderOf = (path: string): string => path.slice(0, path.length - nameOf(path).length).replace(/\/$/, '')

// A conflict is settled by staging it, and taking it back to what the index
// holds would throw away both sides of it rather than one edit. Nothing here
// offers to do that, the same as everywhere else this feels like.
export const mayDiscard = (change: RepoChange): boolean => !change.staged && change.kind !== 'conflict'

const action =
  'flex h-6 w-6 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90'

type At = { x: number; y: number }

export default function ChangeRow({
  change,
  reading,
  viewed,
  onOpen,
  onViewed,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  reading: boolean
  viewed: boolean
  onOpen: () => void
  onViewed: (viewed: boolean) => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const [menu, setMenu] = useState<At | null>(null)
  const openFile = useBrowser(s => s.openFile)
  const mark = markOf(change)
  const name = nameOf(change.path)
  const folder = folderOf(change.path)
  const discards = mayDiscard(change)
  const shut = () => setMenu(null)
  const held = (event: MouseEvent) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  return (
    <div
      data-row={keyOf(change)}
      onContextMenu={held}
      className={`group relative flex h-7 items-center rounded-xl pl-1.5 pr-1 transition-colors ${
        reading ? 'bg-fg/[0.09]' : 'hover:bg-fg/[0.04]'
      }`}
    >
      <button
        onClick={onOpen}
        className={`flex h-full min-w-0 flex-1 items-center gap-2 text-left transition-opacity duration-150 ${
          viewed && !reading ? 'opacity-40' : ''
        }`}
      >
        <Tooltip label={change.previousPath ? `${mark.word} from ${change.previousPath}` : mark.word}>
          <span className={`w-3.5 shrink-0 text-center font-mono text-[11px] font-semibold ${mark.tone}`}>
            {mark.letter}
          </span>
        </Tooltip>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          <span
            className={`${reading ? 'text-fg' : 'text-fg-secondary'} ${change.kind === 'deleted' ? 'line-through' : ''}`}
          >
            {name}
          </span>
          {folder && <span className="ml-1.5 text-xs text-fg-faint">{folder}</span>}
        </span>
      </button>
      {/* Both slots are held whether or not the pointer is there, so nothing on
          the row travels as it is reached for and the counts down the list line
          up on one right edge however wide each one is. */}
      <span
        className={`w-[62px] shrink-0 text-right transition-opacity duration-150 ${viewed && !reading ? 'opacity-40' : ''}`}
      >
        <Counts added={change.added} removed={change.removed} />
      </span>
      <span className="flex w-[72px] shrink-0 items-center justify-end">
        <span className="flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {discards && (
            <Tooltip label="Discard changes">
              <button aria-label={`Discard changes in ${name}`} onClick={onDiscard} className={action}>
                <UndoGlyph className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip label={change.staged ? 'Unstage changes' : 'Stage changes'}>
            <button
              aria-label={change.staged ? `Unstage ${name}` : `Stage ${name}`}
              onClick={change.staged ? onUnstage : onStage}
              className={action}
            >
              {change.staged ? <MinusGlyph className="w-3.5 h-3.5" /> : <PlusGlyph className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        </span>
        {/* Viewed is a state before it is a button, and the row going quiet is
            what really says it, so the mark is the quietest thing on the row
            rather than the loudest. White is the one action colour and this is
            not the action. Not viewed, there is nothing at all until the pointer
            is there: a column of empty circles down a list of files is a column
            asking to be dealt with, and most of them never are. */}
        <Tooltip label={viewed ? 'Mark as not viewed' : 'Mark as viewed'}>
          <button
            aria-label={viewed ? `Mark ${name} as not viewed` : `Mark ${name} as viewed`}
            aria-pressed={viewed}
            onClick={() => onViewed(!viewed)}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-150 hover:bg-fg/10 hover:text-fg ${
              viewed ? 'text-fg-muted' : 'text-transparent group-hover:text-fg-faint'
            }`}
          >
            <CheckGlyph className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </span>
      <Popover open={menu !== null} onClose={shut} at={menu ?? undefined}>
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
        <MenuDivider />
        <MenuItem
          icon={<CheckGlyph className="w-4 h-4" />}
          label={viewed ? 'Mark as not viewed' : 'Mark as viewed'}
          onClick={() => {
            shut()
            onViewed(!viewed)
          }}
        />
        <MenuItem
          icon={change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
          label={change.staged ? 'Unstage changes' : 'Stage changes'}
          onClick={() => {
            shut()
            if (change.staged) onUnstage()
            else onStage()
          }}
        />
        {discards && (
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
  )
}
