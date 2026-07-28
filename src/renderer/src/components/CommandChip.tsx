import type { CommandName } from '../../../shared/commands'
import { ChecklistGlyph, CloseGlyph, GhostGlyph, MicGlyph } from '../icons'
import Pill from './Pill'

export const COMMAND_MARKS: Record<CommandName, typeof ChecklistGlyph> = {
  plan: ChecklistGlyph,
  ghost: GhostGlyph,
  voice: MicGlyph
}

export const COMMAND_LABELS: Record<CommandName, string> = {
  plan: 'Plan',
  ghost: 'Ghost',
  voice: 'Voice'
}

// In the composer a command is a control standing in the row the plus stands in,
// so it is that button's height and wears its outline. On a card it is a label
// on a line of type, so it is a pill. One with a way off it is the first.
export default function CommandChip({ name, onRemove }: { name: CommandName; onRemove?: () => void }) {
  const Mark = COMMAND_MARKS[name]
  const label = COMMAND_LABELS[name]

  if (!onRemove) {
    return (
      <Pill>
        <span className="flex items-center gap-1.5">
          <Mark className="w-3.5 h-3.5 shrink-0" />
          {label}
        </span>
      </Pill>
    )
  }

  return (
    <span className="h-10 pl-4 pr-1.5 rounded-full border border-ink-600 flex items-center gap-2 text-sm text-fg shrink-0">
      <Mark className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="w-7 h-7 -mr-0.5 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 cursor-pointer hover:text-fg hover:bg-fg/[0.06] active:scale-95"
      >
        <CloseGlyph className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}
