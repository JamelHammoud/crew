import { useEffect, useRef, useState } from 'react'
import { QUICK_REACTIONS, type ReactionEmoji } from '../../../shared/reactions'
import { MoreGlyph, PencilGlyph, TrashGlyph, UndoGlyph } from '../icons'
import { useCrew } from '../state/store'
import Emoji from './Emoji'
import { rememberEmoji } from './emojiRecents'
import { MenuItem, Popover } from './Popover'
import type { ReactionGroup } from './reactionGroups'
import ReactionPickerButton from './ReactionPickerButton'
import ReactionTip from './ReactionTip'
import Tooltip from './Tooltip'

const PILL = 'flex h-7 items-center rounded-full transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95'

export default function MessageReactions({
  targetId,
  reactions = [],
  deletable,
  onDelete,
  onEdit,
  onReply
}: {
  targetId: string
  reactions?: ReactionGroup[]
  deletable: boolean
  onDelete: () => void
  onEdit?: () => void
  onReply?: () => void
}) {
  const reactToMessage = useCrew(state => state.reactToMessage)
  const tray = useRef<HTMLDivElement>(null)
  const [picker, setPicker] = useState<'tray' | 'row' | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const menuOpen = picker === 'tray' || actionsOpen
  const selected = new Set(reactions.filter(reaction => reaction.self).map(reaction => reaction.emoji))

  useEffect(() => {
    if (!dismissed) return
    const message = tray.current?.closest('[data-message]') ?? tray.current?.parentElement
    if (!message) return
    const restore = () => setDismissed(false)
    message.addEventListener('mouseenter', restore)
    return () => message.removeEventListener('mouseenter', restore)
  }, [dismissed])

  const react = (emoji: ReactionEmoji) => {
    reactToMessage(targetId, emoji)
    rememberEmoji(emoji)
  }

  const reactFromMenu = (emoji: ReactionEmoji, byPointer = true) => {
    react(emoji)
    setPicker(null)
    setActionsOpen(false)
    if (byPointer) setDismissed(true)
  }

  return (
    <>
      <div
        ref={tray}
        onFocus={() => setDismissed(false)}
        className={`absolute right-0 -top-4 z-10 flex items-center gap-px rounded-full border border-ink-700 bg-ink-800 p-0.5 shadow-[0_8px_24px_rgb(0_0_0/0.24)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen
            ? 'translate-y-0 opacity-100'
            : dismissed
              ? 'pointer-events-none translate-y-1 opacity-0'
              : 'pointer-events-none translate-y-1 opacity-0 group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100'
        }`}
      >
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            aria-pressed={selected.has(emoji)}
            onClick={event => reactFromMenu(emoji, event.detail > 0)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-90 ${
              selected.has(emoji) ? 'bg-fg/12' : 'hover:bg-fg/8'
            }`}
          >
            <Emoji char={emoji} size={17} />
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-ink-600" />
        {onReply && (
          <Tooltip label="Reply">
            <button
              type="button"
              aria-label="Reply"
              onClick={onReply}
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
            >
              <UndoGlyph className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        <span className="relative">
          <Tooltip label="More reactions" disabled={pickerOpen}>
            <button
              type="button"
              aria-label="More reactions"
              aria-expanded={pickerOpen}
              onClick={() => {
                setActionsOpen(false)
                setPickerOpen(open => !open)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
            >
              <SmileGlyph className="h-4 w-4" />
            </button>
          </Tooltip>
          <Popover
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            side="top"
            flush
            className="overflow-hidden !rounded-card"
          >
            <EmojiPicker selected={selected} onPick={reactFromMenu} />
          </Popover>
        </span>
        {deletable && (
          <span className="relative">
            <Tooltip label="Message actions" disabled={actionsOpen}>
              <button
                type="button"
                aria-label="Message actions"
                aria-expanded={actionsOpen}
                onClick={() => {
                  setPickerOpen(false)
                  setActionsOpen(open => !open)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
              >
                <MoreGlyph className="h-4 w-4" />
              </button>
            </Tooltip>
            <Popover open={actionsOpen} onClose={() => setActionsOpen(false)} side="top">
              {onEdit && (
                <MenuItem
                  icon={<PencilGlyph />}
                  label="Edit message"
                  onClick={() => {
                    setActionsOpen(false)
                    onEdit()
                  }}
                />
              )}
              <MenuItem
                icon={<TrashGlyph />}
                label="Delete message"
                danger
                onClick={() => {
                  setActionsOpen(false)
                  onDelete()
                }}
              />
            </Popover>
          </span>
        )}
      </div>
      {reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reactions.map(reaction => (
            <Tooltip key={reaction.emoji} label={<ReactionTip reaction={reaction} />}>
              <button
                type="button"
                aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}`}
                aria-pressed={reaction.self}
                onClick={() => react(reaction.emoji)}
                className={`flex h-7 items-center gap-1.5 rounded-full px-2 transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 ${
                  reaction.self
                    ? 'bg-fg/15 text-fg hover:bg-fg/20'
                    : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
                }`}
              >
                <Emoji char={reaction.emoji} size={16} />
                <span className="text-xs font-semibold tabular-nums">{reaction.count}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </>
  )
}
