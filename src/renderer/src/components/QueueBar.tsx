import { useState } from 'react'
import { attachmentUrl, isImageType, type Attachment } from '../../../shared/attachments'
import type { MessageReply } from '../../../shared/events'
import { ChevronDownGlyph, MoreGlyph, PencilGlyph, SendGlyph, TrashGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import { EmojiText } from './Emoji'
import HoverCard from './HoverCard'
import Pill from './Pill'
import { MenuItem, Popover } from './Popover'
import ReplyQuote from './ReplyQuote'
import Tooltip from './Tooltip'
import { useReorder } from './useReorder'

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
              onPointerDown={event => event.stopPropagation()}
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
  take,
  onEdit,
  onRemove,
  onSend
}: {
  item: QueuedMessage
  take: (event: React.PointerEvent) => void
  onEdit: () => void
  onRemove: () => void
  onSend: () => void
}) {
  const [menu, setMenu] = useState<'button' | { x: number; y: number } | null>(null)
  const line = item.text.replace(/\s+/g, ' ').trim()
  const preview = (
    <div className="max-h-[min(26rem,calc(100vh-4rem))] overflow-y-auto overscroll-contain select-text">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-fg/70">{item.author}</span>
        {item.agentLabel && <Pill>{item.agentLabel}</Pill>}
      </div>
      {item.replyTo && (
        <div className="mb-2">
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
      <div className="whitespace-pre-wrap break-words text-sm leading-5 text-fg/80">
        {item.text ? <EmojiText text={item.text} /> : 'Attachments'}
      </div>
      {item.attachments && item.attachments.length > 0 && (
        <div className="mt-2">
          <QueueAttachments attachments={item.attachments} />
        </div>
      )}
    </div>
  )

  return (
    <HoverCard content={preview} width={360} className="!block min-w-0">
      <div
        onPointerDown={item.self ? take : undefined}
        onContextMenu={
          item.self
            ? event => {
                event.preventDefault()
                setMenu({ x: event.clientX, y: event.clientY })
              }
            : undefined
        }
        className={`group flex min-w-0 items-center gap-2 rounded-xl bg-ink-800 px-3 py-2 transition-colors hover:bg-ink-700/70 ${
          item.self ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <span className="max-w-20 shrink-0 truncate text-sm font-semibold text-fg-muted">{item.author}</span>
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
              {line ? <EmojiText text={line} /> : 'Attachments'}
            </span>
            {item.attachments && item.attachments.length > 0 && <QueueAttachments attachments={item.attachments} />}
          </div>
        </div>
        {item.agentLabel && <Pill>{item.agentLabel}</Pill>}
        {item.self && (
          <span className="relative flex h-7 w-7 shrink-0" onPointerDown={event => event.stopPropagation()}>
            <Tooltip label="More" disabled={menu !== null}>
              <button
                type="button"
                onClick={() => setMenu(open => (open === 'button' ? null : 'button'))}
                aria-label="More for queued message"
                aria-expanded={menu !== null}
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted opacity-0 transition-[color,background-color,opacity] hover:bg-fg/[0.08] hover:text-fg group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <MoreGlyph className="h-4 w-4" />
              </button>
            </Tooltip>
            <Popover
              open={menu !== null}
              onClose={() => setMenu(null)}
              at={typeof menu === 'object' ? menu : undefined}
              side="top"
              className="min-w-44"
            >
              <MenuItem
                icon={<PencilGlyph />}
                label="Edit in composer"
                onClick={() => {
                  setMenu(null)
                  onEdit()
                }}
              />
              {item.sendable && (
                <MenuItem
                  icon={<SendGlyph />}
                  label="Send now"
                  onClick={() => {
                    setMenu(null)
                    onSend()
                  }}
                />
              )}
              <MenuItem
                icon={<TrashGlyph />}
                label="Remove from queue"
                danger
                onClick={() => {
                  setMenu(null)
                  onRemove()
                }}
              />
            </Popover>
          </span>
        )}
      </div>
    </HoverCard>
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
  const order = useReorder(onMove, {
    axis: 'vertical',
    carry: promptId => {
      const item = items.find(one => one.promptId === promptId)
      if (!item) return null
      const line = item.text.replace(/\s+/g, ' ').trim() || 'Attachments'
      return (
        <>
          <span className="max-w-20 shrink-0 truncate font-semibold">{item.author}</span>
          <span className="max-w-44 truncate">{line}</span>
        </>
      )
    }
  })
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
        <div ref={order.ref} className="relative max-h-52 space-y-1.5 overflow-y-auto pb-2 pt-1 pr-0.5">
          {order.view}
          {items.map((item, index) => (
            <div key={item.promptId} data-reorder={item.promptId}>
              <QueueRow
                item={item}
                take={order.take(item.promptId)}
                onEdit={() => onEdit(item.promptId)}
                onRemove={() => onRemove(item.promptId)}
                onSend={() => onSend(item.promptId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
