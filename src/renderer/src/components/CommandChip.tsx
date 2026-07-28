import type { CommandName } from '../../../shared/commands'
import { ChecklistGlyph, GhostGlyph, XGlyph } from '../icons'
import Pill from './Pill'

export const COMMAND_MARKS: Record<CommandName, typeof ChecklistGlyph> = {
  plan: ChecklistGlyph,
  ghost: GhostGlyph
}

export const COMMAND_LABELS: Record<CommandName, string> = {
  plan: 'Plan',
  ghost: 'Ghost'
}

export default function CommandChip({ name, onRemove }: { name: CommandName; onRemove?: () => void }) {
  const Mark = COMMAND_MARKS[name]
  const label = COMMAND_LABELS[name]
  return (
    <Pill>
      <span className="flex items-center gap-1.5">
        <Mark className="w-3.5 h-3.5 shrink-0" />
        {label}
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="text-fg-muted transition-colors cursor-pointer hover:text-fg active:scale-95"
          >
            <XGlyph className="w-3 h-3" />
          </button>
        )}
      </span>
    </Pill>
  )
}
