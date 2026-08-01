import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { RepoChange, RepoCommand } from '../../../../shared/repository'
import { useCrew } from '../../state/store'
import { digestOf, useReviewed } from '../../state/reviewed'
import { toast } from '../../state/toast'
import Modal from '../Modal'
import ScrollFade from '../ScrollFade'
import Skeleton from '../Skeleton'
import useScrollEdges from '../useScrollEdges'
import ChangeList from './ChangeList'
import CommitBar from './CommitBar'
import CommitDialog from './CommitDialog'
import DiffPane from './DiffPane'
import ReviewHeader from './ReviewHeader'
import { clampSplit, defaultSplit, loadSplit, saveSplit } from './split'
import SplitGrip from './SplitGrip'
import { useRepoWork } from './useRepoWork'
import { groupsOf, keyOf, readingAt, reviewWalk, stepTo } from './walk'

type Ask = { kind: 'discard'; paths: string[]; what: string } | { kind: 'drop'; ref: string }

export default function ReviewView() {
  const { work, loading, busy, refresh, run } = useRepoWork()
  const place = useCrew(s => s.place)
  const held = useReviewed(s => s.read)
  const markRead = useReviewed(s => s.markRead)
  const markUnread = useReviewed(s => s.markUnread)
  const forgetRead = useReviewed(s => s.forget)
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState<string | null>(null)
  const [shut, setShut] = useState<string[]>([])
  const [committing, setCommitting] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [room, setRoom] = useState(0)
  const [split, setSplit] = useState<number | null>(loadSplit)
  const box = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)

  const groups = useMemo(() => groupsOf(work.changes), [work.changes])
  const walk = useMemo(() => reviewWalk(work.changes), [work.changes])
  const open = readingAt(walk, reading)
  const { status, stashes } = work

  // What was viewed is that version of it, so the digest is what the mark is
  // held against and a file an agent has written to again comes back unviewed.
  const digests = useMemo(() => {
    const of: Record<string, string> = {}
    for (const change of work.changes) of[keyOf(change)] = digestOf(change.diff)
    return of
  }, [work.changes])

  const mine = held[place]
  const isViewed = useCallback(
    (change: RepoChange): boolean => mine?.[keyOf(change)] === digests[keyOf(change)],
    [mine, digests]
  )
  const seen = work.changes.filter(isViewed).length
  const totals = work.changes.reduce(
    (sum, change) => ({ added: sum.added + change.added, removed: sum.removed + change.removed }),
    { added: 0, removed: 0 }
  )

  // The two panes are measured against the room they really have, so a panel
  // dragged narrower or a window made shorter never leaves the list holding
  // more than there is.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setRoom(el.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watching = new ResizeObserver(measure)
    watching.observe(el)
    return () => watching.disconnect()
  }, [])

  const listHeight = room === 0 ? 0 : clampSplit(split ?? defaultSplit(room), room)

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
      setReading(null)
    } else toast.fail(result.message, { key: 'repo' })
  }

  const settle = async () => {
    if (!ask) return
    const command: RepoCommand = ask.kind === 'discard' ? { do: 'discard', paths: ask.paths } : { do: 'drop', ref: ask.ref }
    setAsk(null)
    await send(command)
  }

  // The row that is open is kept in view when the keys are what moved it, or
  // walking a long list reads as the diff changing under a list standing still.
  const goTo = (change: RepoChange | null) => {
    if (!change) return
    const key = keyOf(change)
    setReading(key)
    requestAnimationFrame(() =>
      scrollRef.current?.querySelector(`[data-row="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' })
    )
  }

  const openRow = (change: RepoChange) => {
    setReading(keyOf(change))
    scrollRef.current?.focus({ preventScroll: true })
  }

  const setViewed = (change: RepoChange, viewed: boolean) => {
    const key = keyOf(change)
    if (viewed) markRead(place, key, digests[key] ?? '')
    else markUnread(place, key)
  }

  // Marking a file read and moving to the next one is one press, because that
  // is the whole of what a review is made of and doing it in two is doing it
  // twice. The last file has nowhere to move on to and stands where it is.
  const done = () => {
    if (!open) return
    setViewed(open, true)
    goTo(stepTo(walk, keyOf(open), 1))
  }

  // The arrows walk the list and the file under them opens as they go, which is
  // how every client does this and why none of them needs a key of its own for
  // the next file. They are read off the list rather than off the window, so
  // nothing here reaches a composer somebody is typing in.
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey || walk.length === 0) return
    const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (by !== 0) {
      event.preventDefault()
      goTo(open ? stepTo(walk, keyOf(open), by) : (walk[0] ?? null))
      return
    }
    if (event.key === 'v' && open) {
      event.preventDefault()
      done()
    }
  }

  if (!loading && !status.available) {
    return (
      <div className="flex h-full items-center justify-center px-10 text-center text-sm text-fg-muted">
        This project is not kept in git.
      </div>
    )
  }

  const nothing = work.changes.length === 0 && stashes.length === 0
  const bar = groups.staged.length > 0

  return (
    <div className="flex h-full flex-col">
      <ReviewHeader
        status={status}
        busy={busy}
        added={totals.added}
        removed={totals.removed}
        seen={seen}
        total={work.changes.length}
        onRun={(command, said) => void send(command, said)}
        onRefresh={refresh}
        onForget={() => forgetRead(place)}
      />

      <div ref={box} className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="relative min-h-0"
          style={open ? { height: listHeight, flex: '0 0 auto' } : { flex: '1 1 auto' }}
        >
          <div
            ref={scrollRef}
            tabIndex={-1}
            onKeyDown={keys}
            className={`h-full overflow-y-auto focus:outline-none ${bar && !open ? 'pb-14' : ''}`}
          >
            {loading && work.changes.length === 0 ? (
              <div className="space-y-1 p-2 pt-3">
                <Skeleton className="h-7 w-full rounded-xl" />
                <Skeleton className="h-7 w-full rounded-xl" />
                <Skeleton className="h-7 w-full rounded-xl" />
              </div>
            ) : nothing ? (
              <p className="px-6 pt-8 text-center text-sm text-fg-muted">Nothing has changed since the last commit.</p>
            ) : (
              <ChangeList
                groups={groups}
                stashes={stashes}
                shut={shut}
                onFold={title => setShut(now => (now.includes(title) ? now.filter(one => one !== title) : [...now, title]))}
                rows={{
                  isViewed,
                  reading: open ? keyOf(open) : null,
                  onOpen: openRow,
                  onViewed: setViewed,
                  onStage: paths => void send({ do: 'stage', paths }),
                  onUnstage: paths => void send({ do: 'unstage', paths }),
                  onDiscard: (paths, what) => setAsk({ kind: 'discard', paths, what })
                }}
                onApplyStash={ref => void send({ do: 'apply', ref }, 'Stash applied')}
                onDropStash={ref => setAsk({ kind: 'drop', ref })}
              />
            )}
          </div>
          <ScrollFade edges={edges} />
        </div>

        {open && (
          <>
            <SplitGrip height={listHeight} total={room} onHeight={setSplit} onSettle={saveSplit} />
            <DiffPane
              change={open}
              viewed={isViewed(open)}
              room={bar}
              onViewed={done}
              onClose={() => setReading(null)}
              onStage={() => void send({ do: 'stage', paths: [open.path] })}
              onUnstage={() => void send({ do: 'unstage', paths: [open.path] })}
              onDiscard={() => setAsk({ kind: 'discard', paths: [open.path], what: open.path })}
            />
          </>
        )}

        <CommitBar staged={groups.staged.length} onOpen={() => setCommitting(true)} />
      </div>

      <CommitDialog
        open={committing}
        staged={groups.staged.length}
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
