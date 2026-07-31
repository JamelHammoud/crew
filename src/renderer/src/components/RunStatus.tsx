import type { AgentStep } from '../../../shared/llm'
import RunFigures from './RunFigures'
import Spinner from './Spinner'
import { describeStep } from './thread'
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
  const last = steps[steps.length - 1]

  return (
    <div className="flex items-center gap-2.5 text-sm pl-14 animate-rise select-none">
      <span className="flex items-center justify-center shrink-0 w-4 h-4">
        <Spinner size={13} className="text-fg-secondary" />
      </span>
      <span className="text-fg-secondary">{describeStep(last)}</span>
      <RunFigures ms={now - startedAt} tokens={tokens} cost={cost} />
    </div>
  )
}
