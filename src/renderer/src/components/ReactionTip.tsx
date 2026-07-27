import Emoji from './Emoji'
import { lookupEmoji } from './emojiData'
import type { ReactionGroup } from './reactionGroups'

const SHOWN = 3

export function reactionName(emoji: string): string {
  const entry = lookupEmoji(emoji)
  return entry ? `:${entry.shortName}:` : emoji
}

// Whoever is reading it is named first, so the line opens on You the way a
// sentence about yourself does. A crew of any size ends on a count rather than
// on a list nobody reads to the end of, and a list one name short of the cap
// keeps that name, since "and 1 other" is longer than the name it stands for.
export function reactorLine({ names, self }: Pick<ReactionGroup, 'names' | 'self'>): string {
  const people = self ? ['You', ...names.slice(1)] : names
  if (people.length === 0) return ''
  if (people.length === 1) return people[0]
  if (people.length <= SHOWN + 1) return `${people.slice(0, -1).join(', ')} and ${people.at(-1)}`
  return `${people.slice(0, SHOWN).join(', ')} and ${people.length - SHOWN} others`
}

export default function ReactionTip({ reaction }: { reaction: ReactionGroup }) {
  return (
    <span className="flex items-center gap-2.5">
      <Emoji char={reaction.emoji} size={30} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg/85 break-words">{reactorLine(reaction)}</span>
        <span className="text-xs text-fg/45">reacted with {reactionName(reaction.emoji)}</span>
      </span>
    </span>
  )
}
