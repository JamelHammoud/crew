import type { CommandName } from '../../../shared/commands'
import type { ThreadMeta } from '../state/store'
import { COMMAND_LABELS, COMMAND_MARKS } from './CommandChip'
import { StrandPill } from './ThreadStrand'

// What was asked for, beside the thread it was asked of: a plan says so until
// it is built, and a ghost says so for as long as it is nobody else's to see.
export function chipsOf(thread: ThreadMeta): CommandName[] {
  const chips: CommandName[] = []
  if (thread.mode === 'plan') chips.push('plan')
  if (thread.ghost) chips.push('ghost')
  if (thread.voice) chips.push('voice')
  if (thread.forkedFrom) chips.push('fork')
  return chips
}

export default function ThreadChips({ thread }: { thread: ThreadMeta }) {
  const chips = chipsOf(thread)
  if (chips.length === 0) return null
  return (
    <>
      {chips.map(name => (
        <CommandChip key={name} name={name} />
      ))}
    </>
  )
}
