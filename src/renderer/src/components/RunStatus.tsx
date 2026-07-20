import type { AgentStep } from '../../../shared/llm'
import { describeStep } from './thread'
import { formatElapsed, formatTokens } from './time'
import { useNow } from './useNow'

export default function RunStatus({
  startedAt,
  tokens,
  steps,
  onStop
}: {
  startedAt: number
  tokens: number
  steps: AgentStep[]
  onStop?: () => void
}) {
  const now = useNow(true)
  const last = steps[steps.length - 1]

  return (
    <div className="flex items-center gap-2 text-xs pl-10">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
      <span className="text-zinc-300">{describeStep(last)}</span>
      <span className="text-zinc-600">{formatElapsed(now - startedAt)}</span>
      {tokens > 0 && <span className="text-zinc-600">{formatTokens(tokens)} tokens</span>}
      {onStop && (
        <button onClick={onStop} className="text-zinc-500 hover:text-white">
          Stop
        </button>
      )}
    </div>
  )
}
