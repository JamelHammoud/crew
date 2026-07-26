import type { AgentStep } from '../../../shared/llm'
import Spinner from './Spinner'
import { describeStep } from './thread'
import { formatElapsed, formatTokens } from './time'
import { useNow } from './useNow'

export default function RunStatus({
  startedAt,
  tokens,
  steps
}: {
  startedAt: number
  tokens: number
  steps: AgentStep[]
}) {
  const now = useNow(true)
  const last = steps[steps.length - 1]

  return (
    <div className="flex items-center gap-2.5 text-sm pl-14 animate-rise">
      <span className="flex items-center justify-center shrink-0 w-[22px] h-[22px]">
        <Spinner size={14} className="text-fg-secondary" />
      </span>
      <span className="text-fg-secondary">{describeStep(last)}</span>
      <span className="text-fg-faint tabular-nums">{formatElapsed(now - startedAt)}</span>
      {tokens > 0 && <span className="text-fg-faint tabular-nums">{formatTokens(tokens)} tokens</span>}
    </div>
  )
}
