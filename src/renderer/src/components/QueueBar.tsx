import { useState } from 'react'
import { attachmentUrl, isImageType, type Attachment } from '../../../shared/attachments'
import type { MessageReply } from '../../../shared/events'
import {
  ChevronDownGlyph,
  ChevronUpGlyph,
  PencilGlyph,
  SendGlyph,
  TrashGlyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import { EmojiText } from './Emoji'
import Pill from './Pill'
import ReplyQuote from './ReplyQuote'
import Tooltip from './Tooltip'

export interface QueuedMessage {
  promptId: string
  author: string
  self: boolean
  sendable: boolean
  text: string
  agentLabel?: string
  attachments?: Attachment[]
  replyTo?: MessageReply
}

function QueueAttachments({ attachments }: { attachments: Attachment[] }) {
  const httpBase = useCrew(state => state.httpBase)
  const shown = attachments.slice(0, 2)
  const left = attachments.length - shown.length
  return (
    <span className="flex shrink-0 items-center gap-1">
      {shown.map(attachment => {
        const Mark = markFor(attachment.mime)
        return (
          <Tooltip key={attachment.id} label={attachment.name}>
            <button
              type="button"
              onClick={() =>
                useBrowser
                  .getState()
                  .openAttachment(
                    attachmentUrl(httpBase, attachment),
                    attachment.name,
                    attachment.mime,
                    attachment.size
                  )
              }
              aria-label={`Open ${attachment.name}`}
              className="flex h-7 max-w-28 items-center gap-1.5 rounded-lg border border-fg/10 px-1.5 text-fg-muted transition-colors hover:border-fg/25 hover:text-fg-secondary active:scale-95"
            >
              {isImageType(attachment.mime) ? (
                <img
                  src={attachmentUrl(httpBase, attachment)}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded object-cover"
                />
              ) : (
                <Mark className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate text-xs">{attachment.name}</span>
            </button>
          </Tooltip>
        )
      })}
      {left > 0 && <span className="text-xs text-fg-faint">+{left}</span>}
    </span>
  )
}

function QueueRow({
  item,
  first,
  last,
  onEdit,
  onRemove,
  onSend,
  onMove
}: {
  item: QueuedMessage
  first: boolean
  last: boolean
  onEdit: () => void
  onRemove: () => void
  onSend: () => void
  onMove: (offset: number) => void
}) {
  return (
    <div className="group flex min-w-0 items-center gap-2 rounded-xl bg-ink-800 px-3 py-2">
      <span className="max-w-24 shrink-0 truncate text-sm font-semibold text-fg-muted">{item.author}</span>
      <div className="min-w-0 flex-1">
        {item.replyTo && (
          <div className="mb-0.5 flex min-w-0 items-center">
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
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
            {item.text ? <EmojiText text={item.text.replace(/\s+/g, ' ').trim()} /> : 'Attachments'}
          </span>
          {item.attachments && item.attachments.length > 0 && <QueueAttachments attachments={item.attachments} />}
        </div>
      </div>
      {item.agentLabel && <Pill>{item.agentLabel}</Pill>}
      {item.self && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {item.sendable && (
              <Tooltip label="Send now">
                <button
                  type="button"
                  onClick={onSend}
                  aria-label="Send queued message now"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.08] hover:text-fg"
                >
                  <SendGlyph className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
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
  )
}

export default function QueueBar({
  items,
  onEdit,
  onRemove,
  onSend,
  onMove
}: {
  items: QueuedMessage[]
  onEdit: (promptId: string) => void
  onRemove: (promptId: string) => void
  onSend: (promptId: string) => void
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
        <div className="max-h-52 space-y-1.5 overflow-y-auto pb-2 pt-1 pr-0.5">
          {items.map((item, index) => (
            <QueueRow
              key={item.promptId}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              onEdit={() => onEdit(item.promptId)}
              onRemove={() => onRemove(item.promptId)}
              onSend={() => onSend(item.promptId)}
              onMove={offset => onMove(item.promptId, index + offset)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
