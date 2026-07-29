import type { AgentStep } from '../../../shared/llm'
import Spinner from './Spinner'
import { usePrefs } from '../state/prefs'
import { describeStep } from './thread'
import { formatCost, formatElapsed, formatTokens } from './time'
import { useNow } from './useNow'

export default function RunStatus({
  startedAt,
  tokens,
  cost,
  steps
}: {
  startedAt: number
  tokens: number
  cost?: number
  steps: AgentStep[]
}) {
  const now = useNow(true)
  const prefs = usePrefs()
  const last = steps[steps.length - 1]

  return (
    <div className="flex items-center gap-2.5 text-sm pl-14 animate-rise">
      <span className="flex items-center justify-center shrink-0 w-4 h-4">
        <Spinner size={13} className="text-fg-secondary" />
      </span>
      <span className="text-fg-secondary">{describeStep(last)}</span>
      <span className="text-fg-faint tabular-nums">{formatElapsed(now - startedAt)}</span>
      {prefs.tokens && tokens > 0 && (
        <span className="text-fg-faint tabular-nums">{formatTokens(tokens)} tokens</span>
      )}
      {prefs.cost && cost !== undefined && cost > 0 && (
        <span className="text-fg-faint tabular-nums">{formatCost(cost)}</span>
      )}
    </div>
  )
}
