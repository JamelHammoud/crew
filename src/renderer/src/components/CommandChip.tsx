import type { CommandName } from '../../../shared/commands'
import {
  BoltGlyph,
  BranchGlyph,
  CheckCircleGlyph,
  ChecklistGlyph,
  ClockGlyph,
  GhostGlyph,
  HandoffGlyph,
  MicGlyph,
  QuestionGlyph,
  TicketGlyph
} from '../icons'
import ComposerChip from './ComposerChip'
import Pill from './Pill'

export const COMMAND_MARKS: Record<CommandName, typeof ChecklistGlyph> = {
  plan: ChecklistGlyph,
  tickets: TicketGlyph,
  goal: CheckCircleGlyph,
  ghost: GhostGlyph,
  voice: MicGlyph,
  steer: BoltGlyph,
  queue: ClockGlyph,
  btw: QuestionGlyph,
  fork: BranchGlyph,
  fallback: HandoffGlyph
}

export const COMMAND_LABELS: Record<CommandName, string> = {
  plan: 'Plan',
  tickets: 'Tickets',
  goal: 'Goal',
  ghost: 'Ghost',
  voice: 'Voice',
  steer: 'Steer',
  queue: 'Queue',
  btw: 'On the side',
  fork: 'Fork',
  fallback: 'Fallback'
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
    <ComposerChip
      mark={<Mark className="w-4 h-4 shrink-0" />}
      label={label}
      removeLabel={`Remove ${label}`}
      onRemove={onRemove}
    />
  )
}
