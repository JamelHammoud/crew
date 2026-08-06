import { useCallback, useEffect, useRef, useState } from 'react'
import type { RepoActionResult, RepoCommand, RepoWork } from '../../../../shared/repository'

const EVERY_MS = 3000

const EMPTY: RepoWork = {
  status: { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0, stashes: 0 },
  changes: [],
  stashes: [],
  branches: []
}

export interface RepoWorkState {
  work: RepoWork
  loading: boolean
  // Which action is in flight, so the button that was pressed is the one that
  // says so and nothing else on the panel has to be turned off.
  busy: RepoCommand['do'] | null
  refresh: () => void
  run: (command: RepoCommand) => Promise<RepoActionResult | null>
}

export function useRepoWork(): RepoWorkState {
  const [work, setWork] = useState<RepoWork>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<RepoCommand['do'] | null>(null)
  const alive = useRef(true)
  const running = useRef(false)
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  const read = useCallback(async () => {
    const repoWork = window.crew?.repoWork
    if (!repoWork) {
      if (alive.current) setLoading(false)
      return
    }
    try {
      const next = await repoWork()
      if (alive.current) setWork({ ...EMPTY, ...next, branches: next.branches ?? [] })
    } catch {
      if (alive.current) setWork(EMPTY)
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void read()
    // A pass never lands on top of an action, or a stage that is still running
    // is drawn away again by the answer to a question asked before it.
    const timer = window.setInterval(() => {
      if (!running.current) void read()
    }, EVERY_MS)
    return () => {
      alive.current = false
      window.clearInterval(timer)
    }
  }, [read])

  // Actions queue rather than drop. Staging three files is three presses in a
  // breath, and the host takes one at a time, so a second press arriving while
  // the first is still going has to wait its turn rather than be lost.
  const run = useCallback(
    (command: RepoCommand): Promise<RepoActionResult | null> => {
      const next = chain.current.then(async () => {
        const runRepo = window.crew?.runRepo
        if (!runRepo) return null
        running.current = true
        setBusy(command.do)
        try {
          const result = await runRepo(command)
          await read()
          return result
        } catch {
          return null
        } finally {
          running.current = false
          if (alive.current) setBusy(null)
        }
      })
      chain.current = next.catch(() => undefined)
      return next
    },
    [read]
  )

  return { work, loading, busy, refresh: () => void read(), run }
}
