import { usePrefs } from '../state/prefs'
import { formatCost, formatElapsed, formatTokens } from './time'

export default function RunFigures({
  ms,
  tokens,
  cost,
  tone = 'text-fg-faint'
}: {
  ms: number
  tokens: number
  cost?: number
  // Quiet against the page it stands on, which is a different grey on a raised
  // surface than it is on the page itself.
  tone?: string
}) {
  const prefs = usePrefs()

  return (
    <>
      <span className={`${tone} tabular-nums`}>{formatElapsed(ms)}</span>
      {prefs.tokens && tokens > 0 && <span className={`${tone} tabular-nums`}>{formatTokens(tokens)} tokens</span>}
      {prefs.cost && cost !== undefined && cost > 0 && (
        <span className={`${tone} tabular-nums`}>{formatCost(cost)}</span>
      )}
    </>
  )
}
