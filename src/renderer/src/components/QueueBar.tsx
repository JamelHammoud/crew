import { useState } from 'react'
import type { Attachment } from '../../../shared/attachments'
import type { MessageReply } from '../../../shared/events'
import {
  ChevronDownGlyph,
  ChevronUpGlyph,
  PencilGlyph,
  TrashGlyph
} from '../icons'
import MessageAttachments from './MessageAttachments'
import Pill from './Pill'
import ReplyQuote from './ReplyQuote'
import Tooltip from './Tooltip'

export interface QueuedMessage {
  promptId: string
  author: string
  self: boolean
  text: string
  agentLabel?: string
  attachments?: Attachment[]
  replyTo?: MessageReply
}

function QueueRow({
  item,
  first,
  last,
  onEdit,
  onRemove,
  onMove
}: {
  item: QueuedMessage
  first: boolean
  last: boolean
  onEdit: () => void
  onRemove: () => void
  onMove: (offset: number) => void
}) {
  return (
    <div className="group rounded-xl bg-ink-800 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold text-fg-muted">{item.author}</span>
        {item.agentLabel && <Pill>{item.agentLabel}</Pill>}
        {item.self && (
          <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Tooltip label="Move earlier">
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={first}
                aria-label="Move queued message earlier"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.08] hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
              >
                <ChevronUpGlyph className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Move later">
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={last}
                aria-label="Move queued message later"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.08] hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
              >
                <ChevronDownGlyph className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Edit in composer">
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit queued message"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.08] hover:text-fg"
              >
                <PencilGlyph className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Remove from queue">
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove from queue"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <TrashGlyph className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {item.replyTo && (
        <div className="mt-2 flex w-fit max-w-full items-center rounded-full bg-fg/[0.05] py-1 pl-2.5 pr-3.5">
          <ReplyQuote
            targetId={item.replyTo.targetId}
            authorId={item.replyTo.authorId}
            authorName={item.replyTo.authorName}
            label={`Replying to ${item.replyTo.authorName}`}
            text={item.replyTo.text}
            deleted={item.replyTo.deleted}
          />
        </div>
      )}
      {item.text && (
        <p className="mt-1 whitespace-pre-wrap break-words text-base leading-[22px] text-fg select-text">{item.text}</p>
      )}
      {item.attachments && <MessageAttachments attachments={item.attachments} />}
    </div>
  )
}

export default function QueueBar({
  items,
  onEdit,
  onRemove,
  onMove
}: {
  items: QueuedMessage[]
  onEdit: (promptId: string) => void
  onRemove: (promptId: string) => void
  onMove: (promptId: string, to: number) => void
}) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="-mb-10 rounded-t-[30px] border border-b-0 border-ink-700 bg-ink-900 px-5 pb-12 pt-1.5">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="group flex h-8 w-full items-center gap-2 text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary"
      >
        {items.length === 1 ? '1 message queued' : `${items.length} messages queued`}
        <ChevronDownGlyph
          className={`ml-auto h-4 w-4 text-fg-muted transition-transform duration-200 group-hover:text-fg-secondary ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="space-y-2 pb-2 pt-1">
          {items.map((item, index) => (
            <QueueRow
              key={item.promptId}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              onEdit={() => onEdit(item.promptId)}
              onRemove={() => onRemove(item.promptId)}
              onMove={offset => onMove(item.promptId, index + offset)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
