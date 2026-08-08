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

export default function CommandChip({ name, onRemove }: { name: CommandName; onRemove: () => void }) {
  const Mark = COMMAND_MARKS[name]
  const label = COMMAND_LABELS[name]

  return (
    <ComposerChip
      mark={<Mark className="w-4 h-4 shrink-0" />}
      label={label}
      removeLabel={`Remove ${label}`}
      onRemove={onRemove}
    />
  )
}
