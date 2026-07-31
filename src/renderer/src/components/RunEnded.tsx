import type { SessionEvent } from '../../../shared/events'
import RunFigures from './RunFigures'
import { DoneGlyph } from './toolGlyphs'
import { WarningGlyph } from '../icons'

export default function RunEnded({ end }: { end: Extract<SessionEvent, { kind: 'agent.end' }> }) {
  if (end.ms === undefined) return null
  const Mark = end.ok ? DoneGlyph : WarningGlyph

  return (
    <div className="flex items-center gap-2.5 text-sm pl-14 select-none">
      <span className="flex items-center justify-center shrink-0 w-4 h-4">
        <Mark className="w-4 h-4 text-fg-faint" />
      </span>
      <RunFigures ms={end.ms} tokens={end.tokens ?? 0} cost={end.cost} />
    </div>
  )
}
