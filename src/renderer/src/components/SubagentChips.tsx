import { WarningGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import SubagentMark from './SubagentMark'
import { describeStep, type SubagentRun } from './thread'
import { formatSpan } from './time'

// The helpers a thread sent out, as a row of ways in. A chip reads its own
// thread rather than waiting to be told about it, so the row reports whether or
// not the agent that sent them ever says a word.

const SHOWN = 3

function Chip({ run, threadId }: { run: SubagentRun; threadId: string }) {
  const openSubagent = useBrowser(state => state.openSubagent)
  const promptId = useCrew(state => state.threadPrompts[run.threadId])
  const queued = useCrew(state => state.queues[run.threadId]?.length ?? 0)
  const step = useCrew(state => (promptId ? state.steps[promptId]?.at(-1) : undefined))
  const working = Boolean(promptId) || queued > 0
  const failed = !working && run.ok === false
  // Only RunStatus spins. A working chip lights its mark and pulses it, the way
  // a live step does, or four helpers under one run is a field of spinners.
  const says = working ? describeStep(step) : failed ? 'Stopped' : run.ms ? formatSpan(run.ms) : 'Done'

  return (
    <button
      type="button"
      onClick={() => openSubagent(run.threadId, threadId)}
      className="group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-ink-700 bg-ink-800/60 transition-all active:scale-[0.98] hover:border-ink-600 hover:bg-ink-800"
    >
      <SubagentMark seed={run.threadId} size="xs" className={working ? 'pulse-soft' : ''} />
      <span className="text-sm text-fg-secondary group-hover:text-fg truncate max-w-[16rem]">{run.subject}</span>
      {failed ? (
        <WarningGlyph className="w-3.5 h-3.5 shrink-0 text-danger" />
      ) : (
        <span className={`text-xs shrink-0 ${working ? 'text-fg-muted' : 'text-fg-faint'}`}>{says}</span>
      )}
    </button>
  )
}

export default function SubagentChips({ runs, threadId }: { runs: SubagentRun[]; threadId: string }) {
  const showSubagents = useBrowser(state => state.showSubagents)
  const rest = runs.length - SHOWN

  return (
    // A chip stands in the column the steps stand in, so the mark lines up with
    // theirs: the row is the step row's own pl-14 less the chip's own padding.
    <div className="flex flex-wrap items-center gap-1.5 pl-13 pr-4 py-1 select-none">
      {runs.slice(0, SHOWN).map(run => (
        <Chip key={run.threadId} run={run} threadId={threadId} />
      ))}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => showSubagents(threadId)}
          className="px-3 py-1 rounded-full text-sm text-fg-faint hover:text-fg-secondary transition-colors active:scale-[0.98]"
        >
          and {rest} {rest === 1 ? 'other' : 'others'}
        </button>
      )}
    </div>
  )
}
