import { useEffect, useRef, useState } from 'react'
import type { ReactionEmoji } from '../../../shared/reactions'
import { MoreGlyph, PencilGlyph, TrashGlyph, UndoGlyph } from '../icons'
import { useQuickReactions } from '../state/quickReactions'
import { useCrew } from '../state/store'
import Emoji from './Emoji'
import { emojiName } from './emojiData'
import { rememberEmoji } from './emojiRecents'
import { MenuItem, Popover } from './Popover'
import type { ReactionGroup } from './reactionGroups'
import ReactionPickerButton from './ReactionPickerButton'
import ReactionTip from './ReactionTip'
import Tooltip from './Tooltip'

const PILL = 'flex h-7 items-center rounded-full transition-[transform,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95'

export const REACTING_ROW = 'relative group/message'

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
  deletable?: boolean
  onDelete?: () => void
  onEdit?: () => void
  onReply?: () => void
}) {
  const reactToMessage = useCrew(state => state.reactToMessage)
  const quick = useQuickReactions()
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
      {/* The row is as long as somebody has made it, and a row of ten is wider
          than a message in the side panel, so the tray wraps onto a second line
          rather than hanging off the left edge of the message it is pinned to.
          Nothing in it gives up its own width for that: a button squashed to fit
          is a smaller thing to aim at than the one beside it.
          It is pinned by its bottom edge and grows upward, the way the ask bar on
          a board grows away from what it is asking about. Anchored at the top, a
          second line reaches down over the message the tray is about, which takes
          away the one thing on screen it refers to. */}
      <div
        ref={tray}
        onFocus={() => setDismissed(false)}
        className={`absolute right-0 bottom-full -mb-[18px] z-10 flex select-none flex-wrap items-center justify-end gap-px rounded-full border border-ink-700 bg-ink-800 p-0.5 shadow-[0_8px_24px_rgb(0_0_0/0.24)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen
            ? 'translate-y-0 opacity-100'
            : dismissed
              ? 'pointer-events-none translate-y-1 opacity-0'
              : 'pointer-events-none translate-y-1 opacity-0 group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100'
        }`}
      >
        {quick.map(emoji => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emojiName(emoji)}`}
            aria-pressed={selected.has(emoji)}
            onClick={event => reactFromMenu(emoji, event.detail > 0)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-90 ${
              selected.has(emoji) ? 'bg-fg/12' : 'hover:bg-fg/8'
            }`}
          >
            <Emoji char={emoji} size={17} />
          </button>
        ))}
        {/* A rule with nothing on one side of it is a rule standing at the edge
            of the tray, so it waits for something to divide. */}
        {quick.length > 0 && <span className="mx-0.5 h-4 w-px shrink-0 bg-ink-600" />}
        {onReply && (
          <Tooltip label="Reply">
            <button
              type="button"
              aria-label="Reply"
              onClick={onReply}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
            >
              <UndoGlyph className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
        <ReactionPickerButton
          label="More reactions"
          open={picker === 'tray'}
          onToggle={() => {
            setActionsOpen(false)
            setPicker(open => (open === 'tray' ? null : 'tray'))
          }}
          onClose={() => setPicker(null)}
          selected={selected}
          onPick={reactFromMenu}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
        />
        {deletable && onDelete && (
          <span className="relative">
            <Tooltip label="More" disabled={actionsOpen}>
              <button
                type="button"
                aria-label="More"
                aria-expanded={actionsOpen}
                onClick={() => {
                  setPicker(null)
                  setActionsOpen(open => !open)
                }}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90 ${
                  actionsOpen ? '' : 'shift:hidden'
                }`}
              >
                <MoreGlyph className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                aria-label="Delete message"
                onClick={onDelete}
                className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-danger transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-danger/10 active:scale-90 ${
                  actionsOpen ? '' : 'shift:flex'
                }`}
              >
                <TrashGlyph className="h-4 w-4" />
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
        <div className="mt-2 flex select-none flex-wrap items-center gap-1.5">
          {reactions.map(reaction => (
            <Tooltip key={reaction.emoji} label={<ReactionTip reaction={reaction} />}>
              <button
                type="button"
                aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}`}
                aria-pressed={reaction.self}
                onClick={() => react(reaction.emoji)}
                className={`${PILL} gap-1.5 px-2 ${
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
          <ReactionPickerButton
            label="Add reaction"
            align="start"
            open={picker === 'row'}
            onToggle={() => {
              setActionsOpen(false)
              setPicker(open => (open === 'row' ? null : 'row'))
            }}
            onClose={() => setPicker(null)}
            selected={selected}
            onPick={emoji => {
              react(emoji)
              setPicker(null)
            }}
            className={`${PILL} w-8 justify-center bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg ${
              picker === 'row'
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100'
            }`}
          />
        </div>
      )}
    </>
  )
}
