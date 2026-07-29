import { WarningGlyph } from '../../icons'
import Spinner from '../Spinner'
import SubagentMark from '../SubagentMark'
import type { SubagentRun } from '../thread'
import { formatSpan } from '../time'
import { useRunState, useSubagentRuns } from './runs'

function Row({ run, onOpen }: { run: SubagentRun; onOpen: (threadId: string) => void }) {
  const state = useRunState(run.threadId)
  return (
    <button
      type="button"
      onClick={() => onOpen(run.threadId)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fg/[0.04] active:scale-[0.995]"
    >
      <SubagentMark seed={run.roleId} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg truncate">{run.subject}</span>
        <span className="block text-xs text-fg-faint truncate">{run.roleName}</span>
      </span>
      {state === 'working' ? (
        <Spinner size={14} className="text-fg-muted shrink-0" />
      ) : state === 'failed' ? (
        <WarningGlyph className="w-4 h-4 shrink-0 text-danger" />
      ) : (
        <span className="text-xs text-fg-faint shrink-0">{run.ms ? formatSpan(run.ms) : ''}</span>
      )}
    </button>
  )
}

export default function SubagentList({
  parentThreadId,
  onOpen
}: {
  parentThreadId: string
  onOpen: (threadId: string) => void
}) {
  const runs = useSubagentRuns(parentThreadId)

  if (runs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-10">
        <p className="text-sm text-fg-muted text-center">Work sent out from this thread shows up here.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      {runs.map(run => (
        <Row key={run.threadId} run={run} onOpen={onOpen} />
      ))}
    </div>
  )
}
