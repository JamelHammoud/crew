import { EllipsisHorizontalIcon, FaceSmileIcon, TrashIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { REACTION_EMOJIS, type ReactionEmoji } from '../../../shared/reactions'
import { useCrew } from '../state/store'
import { MenuItem, Popover } from './Popover'
import type { ReactionGroup } from './reactionGroups'
import Tooltip from './Tooltip'

const QUICK_REACTIONS = REACTION_EMOJIS.slice(0, 4)

const reactionLabel = (names: string[]) => {
  if (names.length === 1) return `${names[0]} reacted`
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} reacted`
}

export default function MessageReactions({
  targetId,
  reactions = [],
  deletable,
  onDelete
}: {
  targetId: string
  reactions?: ReactionGroup[]
  deletable: boolean
  onDelete: () => void
}) {
  const reactToMessage = useCrew(state => state.reactToMessage)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const menuOpen = pickerOpen || actionsOpen
  const selected = new Set(reactions.filter(reaction => reaction.self).map(reaction => reaction.emoji))

  const react = (emoji: ReactionEmoji) => {
    reactToMessage(targetId, emoji)
    setPickerOpen(false)
  }

  return (
    <>
      <div
        className={`absolute right-0 -top-5 z-10 flex items-center gap-0.5 rounded-full border border-ink-700 bg-ink-800 p-1 shadow-[0_10px_30px_rgb(0_0_0/0.28)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0 group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100'
        }`}
      >
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            aria-pressed={selected.has(emoji)}
            onClick={() => react(emoji)}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[17px] leading-none transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-90 ${
              selected.has(emoji) ? 'bg-fg/12' : 'hover:bg-fg/8'
            }`}
          >
            {emoji}
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-ink-600" />
        <span className="relative">
          <Tooltip label="More reactions">
            <button
              type="button"
              aria-label="More reactions"
              aria-expanded={pickerOpen}
              onClick={() => {
                setActionsOpen(false)
                setPickerOpen(open => !open)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
            >
              <FaceSmileIcon className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
          <Popover open={pickerOpen} onClose={() => setPickerOpen(false)} side="top" className="flex !rounded-full !p-1">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                aria-pressed={selected.has(emoji)}
                onClick={() => react(emoji)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[18px] leading-none transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-90 ${
                  selected.has(emoji) ? 'bg-fg/12' : 'hover:bg-fg/8'
                }`}
              >
                {emoji}
              </button>
            ))}
          </Popover>
        </span>
        {deletable && (
          <span className="relative">
            <Tooltip label="Message actions">
              <button
                type="button"
                aria-label="Message actions"
                aria-expanded={actionsOpen}
                onClick={() => {
                  setPickerOpen(false)
                  setActionsOpen(open => !open)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-fg/8 hover:text-fg active:scale-90"
              >
                <EllipsisHorizontalIcon className="h-5 w-5" />
              </button>
            </Tooltip>
            <Popover open={actionsOpen} onClose={() => setActionsOpen(false)} side="top">
              <MenuItem
                icon={<TrashIcon />}
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
            <Tooltip key={reaction.emoji} label={reactionLabel(reaction.names)}>
              <button
                type="button"
                aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}`}
                aria-pressed={reaction.self}
                onClick={() => react(reaction.emoji)}
                className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-sm transition-[transform,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:scale-95 ${
                  reaction.self
                    ? 'border-fg/35 bg-fg/10 text-fg'
                    : 'border-ink-700 bg-ink-800 text-fg-secondary hover:border-ink-600 hover:text-fg'
                }`}
              >
                <span className="text-[15px] leading-none">{reaction.emoji}</span>
                <span className="text-xs font-semibold tabular-nums">{reaction.count}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </>
  )
}
