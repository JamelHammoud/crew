import type { ReactionEmoji } from '../../../shared/reactions'
import { SmileGlyph } from '../icons'
import EmojiPicker from './EmojiPicker'
import { Popover } from './Popover'
import Tooltip from './Tooltip'

export default function ReactionPickerButton({
  label,
  align = 'end',
  open,
  onToggle,
  onClose,
  selected,
  onPick,
  className
}: {
  label: string
  align?: 'start' | 'center' | 'end'
  open: boolean
  onToggle: () => void
  onClose: () => void
  selected: Set<ReactionEmoji>
  onPick: (emoji: ReactionEmoji, byPointer?: boolean) => void
  className: string
}) {
  return (
    <span className="relative flex">
      <Tooltip label={label} disabled={open}>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={onToggle}
          className={className}
        >
          <SmileGlyph className="h-4 w-4" />
        </button>
      </Tooltip>
      <Popover
        open={open}
        onClose={onClose}
        side="top"
        align={align}
        flush
        className="overflow-hidden !rounded-card"
      >
        <EmojiPicker selected={selected} onPick={onPick} />
      </Popover>
    </span>
  )
}
