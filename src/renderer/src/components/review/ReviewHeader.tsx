import { useState } from 'react'
import type { RepoBranch, RepoCommand, RepoStatus } from '../../../../shared/repository'
import { ArchiveGlyph, ArrowDownGlyph, ArrowUpGlyph, MoreGlyph, RefreshGlyph, UndoGlyph } from '../../icons'
import Counts from '../Counts'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import BranchMenu from './BranchMenu'
import { Progress } from './parts'

const act =
  'flex h-7 items-center gap-1 rounded-full px-1.5 text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-30'

// One row for where the work is and what to do with the whole of it, and a line
// under it for how far through the reading somebody is. It was three rows
// before: the branch, then a summary, then the first heading, which is a
// hundred pixels of chrome standing over the one thing anybody came here for.
export default function ReviewHeader({
  status,
  branches,
  busy,
  added,
  removed,
  seen,
  total,
  onRun,
  onRefresh,
  onForget
}: {
  status: RepoStatus
  branches: RepoBranch[]
  busy: RepoCommand['do'] | null
  added: number
  removed: number
  seen: number
  total: number
  onRun: (command: RepoCommand, said?: string) => void
  onRefresh: () => void
  onForget: () => void
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div className="shrink-0">
      <div className="flex h-9 items-center gap-2 pl-2 pr-1.5">
        <BranchGlyph className="w-4 h-4 shrink-0 text-fg-faint" />
        <span className="min-w-0 truncate text-[13px] text-fg-secondary">{status.branch || 'Project'}</span>
        <Counts added={added} removed={removed} />
        <span className="flex-1" />
        <Tooltip label={status.behind > 0 ? `Pull ${status.behind}` : 'Pull'}>
          <button
            aria-label="Pull"
            onClick={() => onRun({ do: 'pull' }, 'Pulled')}
            disabled={!status.remote || busy !== null}
            className={act}
          >
            {busy === 'pull' ? <Spinner size={13} /> : <ArrowDownGlyph className="w-4 h-4" />}
            {status.behind > 0 && <span className="text-xs tabular-nums">{status.behind}</span>}
          </button>
        </Tooltip>
        <Tooltip label={status.ahead > 0 ? `Push ${status.ahead}` : 'Push'}>
          <button
            aria-label="Push"
            onClick={() => onRun({ do: 'push' }, 'Pushed')}
            disabled={!status.remote || busy !== null}
            className={act}
          >
            {busy === 'push' ? <Spinner size={13} /> : <ArrowUpGlyph className="w-4 h-4" />}
            {status.ahead > 0 && <span className="text-xs tabular-nums">{status.ahead}</span>}
          </button>
        </Tooltip>
        <div className="relative">
          <Tooltip label="More" disabled={menu}>
            <button
              aria-label="More"
              onClick={() => setMenu(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90"
            >
              <MoreGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <Popover open={menu} onClose={() => setMenu(false)} align="end">
            {total > 0 && (
              <MenuItem
                icon={<ArchiveGlyph className="w-4 h-4" />}
                label="Stash changes"
                onClick={() => {
                  setMenu(false)
                  onRun({ do: 'stash' }, 'Stashed')
                }}
              />
            )}
            {seen > 0 && (
              <MenuItem
                icon={<UndoGlyph className="w-4 h-4" />}
                label="Mark all as not viewed"
                onClick={() => {
                  setMenu(false)
                  onForget()
                }}
              />
            )}
            {(total > 0 || seen > 0) && <MenuDivider />}
            <MenuItem
              icon={<RefreshGlyph className="w-4 h-4" />}
              label="Refresh"
              onClick={() => {
                setMenu(false)
                onRefresh()
              }}
            />
          </Popover>
        </div>
      </div>
      <Progress seen={seen} of={total} />
    </div>
  )
}
