import { useMemo, useState } from 'react'
import type { RepoChange, RepoChangeKind } from '../../../../shared/repository'
import {
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
import { rowsOf } from '../unifiedRows'

const KINDS: Record<RepoChangeKind, { letter: string; word: string; tone: string }> = {
  added: { letter: 'A', word: 'Added', tone: 'text-positive' },
  modified: { letter: 'M', word: 'Changed', tone: 'text-fg-muted' },
  deleted: { letter: 'D', word: 'Deleted', tone: 'text-danger' },
  renamed: { letter: 'R', word: 'Renamed', tone: 'text-fg-muted' },
  copied: { letter: 'C', word: 'Copied', tone: 'text-fg-muted' },
  conflict: { letter: '!', word: 'Conflicting', tone: 'text-danger' }
}

export default function ChangeRow({
  change,
  open,
  onToggle,
  onStage,
  onUnstage,
  onDiscard
}: {
  change: RepoChange
  open: boolean
  onToggle: () => void
  onStage: () => void
  onUnstage: () => void
  onDiscard: () => void
}) {
  const [menu, setMenu] = useState(false)
  const openFile = useBrowser(s => s.openFile)
  const rows = useMemo(() => (open ? rowsOf(change.diff) : []), [open, change.diff])
  const kind = KINDS[change.kind]
  const name = change.path.split('/').pop() ?? change.path
  const folder = change.path.slice(0, change.path.length - name.length).replace(/\/$/, '')

  return (
    <div className="rounded-card overflow-hidden bg-ink-800">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="group flex h-10 min-w-0 flex-1 items-center gap-2 pl-2.5 text-left"
        >
          <ChevronRightGlyph
            className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="text-fg-secondary">{name}</span>
            {folder && <span className="ml-1.5 text-xs text-fg-faint">{folder}</span>}
          </span>
          <Counts added={change.added} removed={change.removed} />
          <Tooltip label={change.previousPath ? `${kind.word} from ${change.previousPath}` : kind.word}>
            <span className={`w-4 shrink-0 text-center font-mono text-xs ${kind.tone}`}>{kind.letter}</span>
          </Tooltip>
        </button>
        <div className="flex shrink-0 items-center pr-1.5">
          <Tooltip label={change.staged ? 'Unstage' : 'Stage'}>
            <button
              aria-label={change.staged ? 'Unstage' : 'Stage'}
              onClick={change.staged ? onUnstage : onStage}
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90"
            >
              {change.staged ? <MinusGlyph className="w-4 h-4" /> : <PlusGlyph className="w-4 h-4" />}
            </button>
          </Tooltip>
          <div className="relative">
            <Tooltip label="More" disabled={menu}>
              <button
                aria-label={`More for ${name}`}
                onClick={() => setMenu(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90"
              >
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
            </Popover>
          </div>
        </div>
      </div>
      {open &&
        (change.binary ? (
          <p className="px-4 pb-3 text-xs text-fg-muted">This one is not text, so there is nothing to read here.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-3 text-xs text-fg-muted">Nothing in the file itself changed.</p>
        ) : (
          <>
            <DiffLines path={change.path} rows={rows} />
            {change.truncated && (
              <p className="border-t border-ink-700 px-4 py-2 text-xs text-fg-faint">
                The rest is too long to show. Open the file to read it.
              </p>
            )}
          </>
        ))}
    </div>
  )
}
