import { useState } from 'react'
import { MAX_QUICK_REACTIONS, QUICK_REACTIONS } from '../../../../shared/reactions'
import { CloseGlyph, PlusGlyph } from '../../icons'
import {
  addQuickReaction,
  removeQuickReaction,
  replaceQuickReaction,
  setQuickReactions,
  useQuickReactions
} from '../../state/quickReactions'
import Emoji from '../Emoji'
import EmojiPicker from '../EmojiPicker'
import { Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { Page, Quiet, Section } from './parts'

// The row shown as the row it really is, in the order it is drawn in. It is
// yours alone, the way the volume and the theme are, so nothing on this page is
// ever sent and the crew each get whatever they have chosen.

const TILE = 'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-95'

const CARD = 'overflow-hidden !rounded-card'

// One reaction. Pressing it opens the picker on what is already chosen, and
// whatever is picked stands in its place rather than going to the end of the
// row. Taking it off is the badge on the corner, the way a file in the composer
// tray is dropped.
function Tile({ emoji, chosen }: { emoji: string; chosen: Set<string> }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="group relative flex">
      <Tooltip label="Change" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label={`Change ${emoji}`}
          aria-expanded={open}
          className={`${TILE} bg-fg/[0.06] hover:bg-fg/[0.11]`}
        >
          <Emoji char={emoji} size={24} />
        </button>
      </Tooltip>
      <Tooltip label="Remove" className="absolute -top-1.5 -right-1.5">
        <button
          onClick={() => removeQuickReaction(emoji)}
          aria-label={`Remove ${emoji}`}
          className="glass h-5 w-5 rounded-full flex items-center justify-center text-fg/70 opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
        >
          <CloseGlyph className="w-3 h-3" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} align="start" flush className={CARD}>
        <EmojiPicker
          selected={chosen}
          purpose="Use"
          onPick={next => {
            replaceQuickReaction(emoji, next)
            setOpen(false)
          }}
        />
      </Popover>
    </span>
  )
}

// The way to add one stands at the end of the row, so a row of none is this and
// nothing else.
function AddTile({ chosen }: { chosen: Set<string> }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative flex">
      <Tooltip label="Add a reaction" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Add a reaction"
          aria-expanded={open}
          className={`${TILE} border border-dashed border-fg/15 text-fg/45 hover:border-fg/30 hover:bg-fg/[0.04] hover:text-fg`}
        >
          <PlusGlyph className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} align="start" flush className={CARD}>
        <EmojiPicker
          selected={chosen}
          purpose="Use"
          onPick={next => {
            addQuickReaction(next)
            setOpen(false)
          }}
        />
      </Popover>
    </span>
  )
}

export default function Reactions() {
  const list = useQuickReactions()
  const chosen = new Set(list)
  // A row nobody has touched has nothing to reset.
  const shipped = list.join(' ') === QUICK_REACTIONS.join(' ')

  return (
    <Page title="Reactions">
      <Section
        title="On a message"
        action={shipped ? undefined : <Quiet label="Reset" onClick={() => setQuickReactions([...QUICK_REACTIONS])} />}
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {list.map(emoji => (
            <Tile key={emoji} emoji={emoji} chosen={chosen} />
          ))}
          {list.length < MAX_QUICK_REACTIONS && <AddTile chosen={chosen} />}
        </div>
      </Section>
    </Page>
  )
}
