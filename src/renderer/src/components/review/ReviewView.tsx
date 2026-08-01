import { useMemo, useRef, useState } from 'react'
import type { RepoChange, RepoCommand } from '../../../../shared/repository'
import { ArchiveGlyph, ArrowDownGlyph, ArrowUpGlyph, BranchGlyph, MinusGlyph, MoreGlyph, PlusGlyph, RefreshGlyph, UndoGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import { digestOf, rowKey, useReviewed } from '../../state/reviewed'
import { toast } from '../../state/toast'
import Counts from '../Counts'
import Modal from '../Modal'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import ScrollFade from '../ScrollFade'
import Skeleton from '../Skeleton'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import useScrollEdges from '../useScrollEdges'
import ChangeRow from './ChangeRow'
import CommitBar from './CommitBar'
import CommitDialog from './CommitDialog'
import { Section, SectionAction } from './parts'
import StashRow from './StashRow'
import { useRepoWork } from './useRepoWork'

type Ask = { kind: 'discard'; paths: string[]; what: string } | { kind: 'drop'; ref: string }

const keyOf = (change: RepoChange): string => rowKey(change.path, change.staged)

export default function ReviewView() {
  const { work, loading, busy, refresh, run } = useRepoWork()
  const place = useCrew(s => s.place)
  const held = useReviewed(s => s.read)
  const markRead = useReviewed(s => s.markRead)
  const markUnread = useReviewed(s => s.markUnread)
  const forgetRead = useReviewed(s => s.forget)
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState<string[]>([])
  const [shut, setShut] = useState<string[]>([])
  const [menu, setMenu] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)

  // A conflict is neither staged nor unstaged until somebody has settled it, so
  // it stands in a group of its own at the head of the list. It is the one thing
  // on this screen that has to be dealt with by hand, and it read as an ordinary
  // edit with a mark on it when it sat in among them.
  const clashing = useMemo(() => work.changes.filter(change => change.kind === 'conflict'), [work.changes])
  const staged = useMemo(() => work.changes.filter(change => change.staged), [work.changes])
  const loose = useMemo(
    () => work.changes.filter(change => !change.staged && change.kind !== 'conflict'),
    [work.changes]
  )
  const { status, stashes } = work

  // What was viewed is that version of it, so the digest is what the mark is
  // held against and a file an agent has written to again comes back unviewed.
  const digests = useMemo(() => {
    const of: Record<string, string> = {}
    for (const change of work.changes) of[keyOf(change)] = digestOf(change.diff)
    return of
  }, [work.changes])

  const mine = held[place]
  const isViewed = (change: RepoChange): boolean => mine?.[keyOf(change)] === digests[keyOf(change)]
  const seen = work.changes.filter(isViewed).length
  const totals = work.changes.reduce(
    (sum, change) => ({ added: sum.added + change.added, removed: sum.removed + change.removed }),
    { added: 0, removed: 0 }
  )
  const files = new Set(work.changes.map(change => change.path)).size

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
    if (result.ok) {
      setMessage('')
      setCommitting(false)
      setOpen([])
    } else toast.fail(result.message, { key: 'repo' })
  }

  const settle = async () => {
    if (!ask) return
    const command: RepoCommand = ask.kind === 'discard' ? { do: 'discard', paths: ask.paths } : { do: 'drop', ref: ask.ref }
    setAsk(null)
    await send(command)
  }

  const folded = (title: string) => ({
    open: !shut.includes(title),
    onToggle: () => setShut(now => (now.includes(title) ? now.filter(one => one !== title) : [...now, title]))
  })

  const row = (change: RepoChange) => {
    const key = keyOf(change)
    return (
      <ChangeRow
        key={key}
        change={change}
        // Reading a change is reading several files, so opening one never puts
        // away the one already open.
        open={open.includes(key)}
        viewed={isViewed(change)}
        onToggle={() => setOpen(now => (now.includes(key) ? now.filter(one => one !== key) : [...now, key]))}
        onViewed={seenNow => (seenNow ? markRead(place, key, digests[key]) : markUnread(place, key))}
        onStage={() => void send({ do: 'stage', paths: [change.path] })}
        onUnstage={() => void send({ do: 'unstage', paths: [change.path] })}
        onDiscard={() => setAsk({ kind: 'discard', paths: [change.path], what: change.path })}
      />
    )
  }

  if (!loading && !status.available) {
    return (
      <div className="flex h-full items-center justify-center px-10 text-center text-sm text-fg-muted">
        This project is not kept in git.
      </div>
    )
  }

  const nothing = work.changes.length === 0 && stashes.length === 0

  return (
    <div className="relative h-full">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div className={`space-y-4 p-3 ${staged.length > 0 ? 'pb-24' : 'pb-6'}`}>
          <div className="space-y-1.5">
            <div className="flex h-8 items-center gap-2 px-1">
              <BranchGlyph className="w-4 h-4 shrink-0 text-fg-faint" />
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
                    aria-label="More"
                    onClick={() => setMenu(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90"
                  >
                    <MoreGlyph className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Popover open={menu} onClose={() => setMenu(false)} align="end">
                  {work.changes.length > 0 && (
                    <MenuItem
                      icon={<ArchiveGlyph className="w-4 h-4" />}
                      label="Stash changes"
                      onClick={() => {
                        setMenu(false)
                        void send({ do: 'stash' }, 'Stashed')
                      }}
                    />
                  )}
                  {seen > 0 && (
                    <MenuItem
                      icon={<UndoGlyph className="w-4 h-4" />}
                      label="Mark all as not viewed"
                      onClick={() => {
                        setMenu(false)
                        forgetRead(place)
                      }}
                    />
                  )}
                  {(work.changes.length > 0 || seen > 0) && <MenuDivider />}
                  <MenuItem
                    icon={<RefreshGlyph className="w-4 h-4" />}
                    label="Refresh"
                    onClick={() => {
                      setMenu(false)
                      refresh()
                    }}
                  />
                </Popover>
              </div>
            </div>
            {/* How much there is to get through. The groups say how many files
                are in each, and nothing else on the screen says how big the
                whole of it is or how far through it somebody already is. */}
            {work.changes.length > 0 && (
              <div className="flex items-center gap-2 px-1 text-xs">
                <span className="text-fg-muted">
                  {files} {files === 1 ? 'file' : 'files'}
                </span>
                <Counts added={totals.added} removed={totals.removed} />
                <span className="flex-1" />
                {seen > 0 && (
                  <span className="text-fg-faint">
                    {seen} of {work.changes.length} viewed
                  </span>
                )}
              </div>
            )}
          </div>

          {loading && work.changes.length === 0 ? (
            <div className="space-y-1.5 pt-2">
              <Skeleton className="h-10 w-full rounded-card" />
              <Skeleton className="h-10 w-full rounded-card" />
              <Skeleton className="h-10 w-full rounded-card" />
            </div>
          ) : nothing ? (
            <p className="px-1 pt-6 text-center text-sm text-fg-muted">Nothing has changed since the last commit.</p>
          ) : (
            <div className="space-y-4">
              {clashing.length > 0 && (
                <Section
                  title="Merge Changes"
                  count={clashing.length}
                  {...folded('Merge Changes')}
                  actions={
                    <SectionAction
                      label="Stage all merge changes"
                      icon={<PlusGlyph className="w-3.5 h-3.5" />}
                      onClick={() => void send({ do: 'stage', paths: clashing.map(one => one.path) })}
                    />
                  }
                >
                  {clashing.map(row)}
                </Section>
              )}

              {staged.length > 0 && (
                <Section
                  title="Staged Changes"
                  count={staged.length}
                  {...folded('Staged Changes')}
                  actions={
                    <SectionAction
                      label="Unstage all changes"
                      icon={<MinusGlyph className="w-3.5 h-3.5" />}
                      onClick={() => void send({ do: 'unstage', paths: staged.map(one => one.path) })}
                    />
                  }
                >
                  {staged.map(row)}
                </Section>
              )}

              {loose.length > 0 && (
                <Section
                  title="Changes"
                  count={loose.length}
                  {...folded('Changes')}
                  actions={
                    <>
                      <SectionAction
                        label="Discard all changes"
                        icon={<UndoGlyph className="w-3.5 h-3.5" />}
                        danger
                        onClick={() =>
                          setAsk({
                            kind: 'discard',
                            paths: loose.map(one => one.path),
                            what: `${loose.length} ${loose.length === 1 ? 'file' : 'files'}`
                          })
                        }
                      />
                      <SectionAction
                        label="Stage all changes"
                        icon={<PlusGlyph className="w-3.5 h-3.5" />}
                        onClick={() => void send({ do: 'stage', paths: loose.map(one => one.path) })}
                      />
                    </>
                  }
                >
                  {loose.map(row)}
                </Section>
              )}

              {stashes.length > 0 && (
                <Section title="Stashes" count={stashes.length} {...folded('Stashes')}>
                  {stashes.map(stash => (
                    <StashRow
                      key={stash.ref}
                      stash={stash}
                      onApply={() => void send({ do: 'apply', ref: stash.ref }, 'Stash applied')}
                      onDrop={() => setAsk({ kind: 'drop', ref: stash.ref })}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
      <ScrollFade edges={edges} />
      <CommitBar staged={staged.length} onOpen={() => setCommitting(true)} />

      <CommitDialog
        open={committing}
        staged={staged.length}
        message={message}
        busy={busy === 'commit'}
        onMessage={setMessage}
        onClose={() => setCommitting(false)}
        onCommit={() => void commit()}
      />

      <Modal open={ask !== null} onClose={() => setAsk(null)} title={ask?.kind === 'drop' ? 'Drop stash' : 'Discard changes'}>
        <p className="mt-3 text-sm text-fg/45">
          {ask?.kind === 'drop'
            ? 'What is in this stash goes for good.'
            : `The changes in ${ask?.kind === 'discard' ? ask.what : ''} go for good.`}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => setAsk(null)}
            className="h-10 rounded-full px-4 text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => void settle()}
            className="h-10 rounded-full bg-danger px-5 text-sm font-semibold text-fg transition-all duration-150 hover:scale-[1.03] active:scale-95"
          >
            {ask?.kind === 'drop' ? 'Drop stash' : 'Discard changes'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
