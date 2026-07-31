import { usePrefs } from '../state/prefs'
import { formatCost, formatElapsed, formatTokens } from './time'

export default function RunFigures({ ms, tokens, cost }: { ms: number; tokens: number; cost?: number }) {
  const prefs = usePrefs()

  return (
    <>
      <span className="text-fg-faint tabular-nums">{formatElapsed(ms)}</span>
      {prefs.tokens && tokens > 0 && (
        <span className="text-fg-faint tabular-nums">{formatTokens(tokens)} tokens</span>
      )}
      {prefs.cost && cost !== undefined && cost > 0 && (
        <span className="text-fg-faint tabular-nums">{formatCost(cost)}</span>
      )}
    </>
  )
}
