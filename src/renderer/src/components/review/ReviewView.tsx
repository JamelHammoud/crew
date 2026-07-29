import { useMemo, useState } from 'react'
import type { RepoChange, RepoCommand } from '../../../../shared/repository'
import { ArchiveGlyph, ArrowDownGlyph, ArrowUpGlyph, MoreGlyph, RefreshGlyph } from '../../icons'
import { toast } from '../../state/toast'
import Modal from '../Modal'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Skeleton from '../Skeleton'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import ChangeRow from './ChangeRow'
import CommitBox from './CommitBox'
import { Section, SectionAction } from './parts'
import StashRow from './StashRow'
import { useRepoWork } from './useRepoWork'

type Ask = { kind: 'discard'; paths: string[]; what: string } | { kind: 'drop'; ref: string }

const keyOf = (change: RepoChange): string => `${change.staged ? 'in' : 'out'}:${change.path}`

export default function ReviewView() {
  const { work, loading, busy, refresh, run } = useRepoWork()
  const [message, setMessage] = useState('')
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)

  const staged = useMemo(() => work.changes.filter(change => change.staged), [work.changes])
  const loose = useMemo(() => work.changes.filter(change => !change.staged), [work.changes])
  const { status, stashes } = work

  const send = async (command: RepoCommand, said?: string) => {
    const result = await run(command)
    if (!result) return
    if (!result.ok) toast.fail(result.message, { key: 'repo' })
    else if (said) toast.done(said, { key: 'repo' })
  }

  const commit = async () => {
    const text = message.trim()
    if (!text) return
    const result = await run({ do: 'commit', message: text })
    if (!result) return
    if (result.ok) setMessage('')
    else toast.fail(result.message, { key: 'repo' })
  }

  const settle = async () => {
    if (!ask) return
    const command: RepoCommand = ask.kind === 'discard' ? { do: 'discard', paths: ask.paths } : { do: 'drop', ref: ask.ref }
    setAsk(null)
    await send(command)
  }

  if (!loading && !status.available) {
    return (
      <div className="flex h-full items-center justify-center px-10 text-center text-sm text-fg-muted">
        This project is not kept in git, so there is nothing to review.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-3">
        <div className="flex h-8 items-center gap-2 px-1">
          <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">{status.branch || 'Project'}</span>
          <Tooltip label={status.behind > 0 ? `Pull ${status.behind}` : 'Pull'}>
            <button
              onClick={() => void send({ do: 'pull' }, 'Pulled')}
              disabled={!status.remote || busy !== null}
              className="flex h-7 items-center gap-1.5 rounded-full px-2 text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-35"
            >
              {busy === 'pull' ? <Spinner size={13} /> : <ArrowDownGlyph className="w-4 h-4" />}
              {status.behind > 0 && <span className="text-xs">{status.behind}</span>}
            </button>
          </Tooltip>
          <Tooltip label={status.ahead > 0 ? `Push ${status.ahead}` : 'Push'}>
            <button
              onClick={() => void send({ do: 'push' }, 'Pushed')}
              disabled={!status.remote || busy !== null}
              className="flex h-7 items-center gap-1.5 rounded-full px-2 text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-35"
            >
              {busy === 'push' ? <Spinner size={13} /> : <ArrowUpGlyph className="w-4 h-4" />}
              {status.ahead > 0 && <span className="text-xs">{status.ahead}</span>}
            </button>
          </Tooltip>
          <div className="relative">
            <Tooltip label="More" disabled={menu}>
              <button
                onClick={() => setMenu(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90"
              >
                <MoreGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
            <Popover open={menu} onClose={() => setMenu(false)} align="end">
              <MenuItem
                icon={<ArchiveGlyph className="w-4 h-4" />}
                label="Put the changes aside"
                onClick={() => {
                  setMenu(false)
                  void send({ do: 'stash', message: message.trim() || undefined }, 'Put aside')
                }}
              />
              <MenuDivider />
              <MenuItem
                icon={<RefreshGlyph className="w-4 h-4" />}
                label="Look again"
                onClick={() => {
                  setMenu(false)
                  refresh()
                }}
              />
            </Popover>
          </div>
        </div>

        <CommitBox
          message={message}
          onMessage={setMessage}
          staged={staged.length}
          busy={busy === 'commit'}
          onCommit={() => void commit()}
        />

        {loading && work.changes.length === 0 ? (
          <div className="space-y-1.5 pt-2">
            <Skeleton className="h-10 w-full rounded-card" />
            <Skeleton className="h-10 w-full rounded-card" />
            <Skeleton className="h-10 w-full rounded-card" />
          </div>
        ) : work.changes.length === 0 && stashes.length === 0 ? (
          <p className="px-1 pt-6 text-center text-sm text-fg-muted">Nothing has changed since the last commit.</p>
        ) : (
          <div className="space-y-4">
            {staged.length > 0 && (
              <div className="space-y-1.5">
                <Section title="Staged" count={staged.length}>
                  <SectionAction
                    label="Unstage all"
                    onClick={() => void send({ do: 'unstage', paths: staged.map(one => one.path) })}
                  />
                </Section>
                {staged.map(change => (
                  <ChangeRow
                    key={keyOf(change)}
                    change={change}
                    open={openRow === keyOf(change)}
                    onToggle={() => setOpenRow(openRow === keyOf(change) ? null : keyOf(change))}
                    onStage={() => void send({ do: 'stage', paths: [change.path] })}
                    onUnstage={() => void send({ do: 'unstage', paths: [change.path] })}
                    onDiscard={() => setAsk({ kind: 'discard', paths: [change.path], what: change.path })}
                  />
                ))}
              </div>
            )}

            {loose.length > 0 && (
              <div className="space-y-1.5">
                <Section title="Changed" count={loose.length}>
                  <SectionAction
                    label="Stage all"
                    onClick={() => void send({ do: 'stage', paths: loose.map(one => one.path) })}
                  />
                  <SectionAction
                    label="Discard all"
                    danger
                    onClick={() =>
                      setAsk({
                        kind: 'discard',
                        paths: loose.map(one => one.path),
                        what: `${loose.length} ${loose.length === 1 ? 'file' : 'files'}`
                      })
                    }
                  />
                </Section>
                {loose.map(change => (
                  <ChangeRow
                    key={keyOf(change)}
                    change={change}
                    open={openRow === keyOf(change)}
                    onToggle={() => setOpenRow(openRow === keyOf(change) ? null : keyOf(change))}
                    onStage={() => void send({ do: 'stage', paths: [change.path] })}
                    onUnstage={() => void send({ do: 'unstage', paths: [change.path] })}
                    onDiscard={() => setAsk({ kind: 'discard', paths: [change.path], what: change.path })}
                  />
                ))}
              </div>
            )}

            {stashes.length > 0 && (
              <div className="space-y-1.5">
                <Section title="Put aside" count={stashes.length}>
                  <span />
                </Section>
                {stashes.map(stash => (
                  <StashRow
                    key={stash.ref}
                    stash={stash}
                    onApply={() => void send({ do: 'apply', ref: stash.ref }, 'Put back')}
                    onDrop={() => setAsk({ kind: 'drop', ref: stash.ref })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask?.kind === 'drop' ? 'Throw this away' : 'Discard these edits'}
      >
        <p className="mt-3 text-sm text-fg/45">
          {ask?.kind === 'drop'
            ? 'What was put aside here goes for good.'
            : `The edits to ${ask?.kind === 'discard' ? ask.what : ''} go for good.`}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => setAsk(null)}
            className="h-10 rounded-full px-4 text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Keep them
          </button>
          <button
            onClick={() => void settle()}
            className="h-10 rounded-full bg-danger px-5 text-sm font-semibold text-fg transition-all duration-150 hover:scale-[1.03] active:scale-95"
          >
            {ask?.kind === 'drop' ? 'Throw away' : 'Discard'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
