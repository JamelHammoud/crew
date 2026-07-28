import { useLayoutEffect, useRef, useState } from 'react'
import { PencilGlyph, TrashGlyph } from '../icons'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import Markdown from './Markdown'
import { MemberName, MentionText } from './Mention'
import MessageReactions from './MessageReactions'
import Pill from './Pill'
import { MenuItem, Popover } from './Popover'
import { usePresence } from './presence'
import { jumpToMessage, replyTargetLabel } from './reply'
import ReplyQuote from './ReplyQuote'
import Tooltip from './Tooltip'
import MessageImages from './MessageImages'
import type { ThreadItem } from './thread'
import { formatFullTime, formatTime } from './time'

const QUOTE_ROW = 'mt-1.5 flex w-fit max-w-full min-w-0 items-center rounded-full bg-fg/[0.05] py-1 pl-2.5 pr-3.5'

export default function ChatMessage({
  item,
  editable = false,
  linked = false,
  onReply
}: {
  item: ThreadItem
  editable?: boolean
  // The line before it came from the same person a moment ago, so this one is
  // the same person still talking: no face, no name, and the time in the gutter
  // for whoever goes looking for it.
  linked?: boolean
  onReply?: (item: ThreadItem) => void
}) {
  const presence = usePresence(item.author, item.authorId)
  const selfId = useCrew(s => s.selfId)
  const agentSeed = useCrew(s => {
    if (item.self) return undefined
    const agent = s.agents.find(a => (item.authorId ? a.id === item.authorId : a.label === item.author))
    return agent?.id
  })
  const deleteMessage = useCrew(s => s.deleteMessage)
  const editMessage = useCrew(s => s.editMessage)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const deletable = item.kind === 'message' && item.self
  const canEdit = deletable && editable
  const editing = draft !== null

  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  const commit = () => {
    const text = (draft ?? '').trim()
    if (text && text !== item.text) editMessage(item.key, text)
    setDraft(null)
  }

  if (item.kind === 'note') {
    return <p className="text-xs text-fg-muted text-center animate-rise">{item.text}</p>
  }
  const quote = item.replyTo && (
    <ReplyQuote
      targetId={item.replyTo.targetId}
      authorId={item.replyTo.authorId}
      authorName={item.replyTo.authorName}
      label={replyTargetLabel(item.replyTo.authorName, item.replyTo.authorId === selfId, item.self)}
      text={item.replyTo.text}
      strong={item.replyTo.authorId === selfId && !item.self}
      deleted={item.replyTo.deleted}
    />
  )
  return (
    <div
      data-message={item.reactionTargetId}
      className={`group/message msg-row relative flex items-start gap-4 rounded-card animate-rise ${
        linked ? 'msg-run' : ''
      }`}
      onContextMenu={
        deletable && !editing
          ? event => {
              event.preventDefault()
              setMenuAt({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      {linked ? (
        <div className="w-10 shrink-0 pt-0.5 flex justify-end">
          <Tooltip label={formatFullTime(item.ts)}>
            <span className="text-xs leading-[22px] tabular-nums whitespace-nowrap text-fg-faint cursor-default opacity-0 transition-opacity group-hover/message:opacity-100">
              {formatTime(item.ts)}
            </span>
          </Tooltip>
        </div>
      ) : agentSeed ? (
        <AgentIcon seed={agentSeed} presence={presence} />
      ) : (
        <Avatar name={item.author} presence={presence} />
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        {!linked && (
          <div className="flex items-baseline gap-2.5">
            <MemberName id={item.authorId} name={item.author}>
              <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
                {item.author}
              </span>
            </MemberName>
            {item.self && <Pill>You</Pill>}
            <div className="flex items-baseline gap-1.5">
              <Tooltip label={formatFullTime(item.ts)}>
                <span className="text-sm text-fg-faint cursor-default">{formatTime(item.ts)}</span>
              </Tooltip>
              {item.editedTs !== undefined && (
                <Tooltip label={`Edited ${formatFullTime(item.editedTs)}`}>
                  <span className="text-sm text-fg-faint cursor-default">(edited)</span>
                </Tooltip>
              )}
            </div>
            {item.voice && <Pill>Spoken</Pill>}
          </div>
        )}
        {item.replyTo &&
          (item.replyTo.deleted ? (
            <div className={`${QUOTE_ROW} cursor-default`}>{quote}</div>
          ) : (
            <button
              type="button"
              aria-label="Go to the message this replies to"
              onClick={() => jumpToMessage(item.replyTo!.targetId)}
              className={`${QUOTE_ROW} text-left transition-colors hover:bg-fg/[0.1] active:scale-[0.99]`}
            >
              {quote}
            </button>
          ))}
        {editing ? (
          <div className="mt-1.5">
            <textarea
              ref={input}
              value={draft ?? ''}
              rows={1}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commit()
                }
                if (e.key === 'Escape') setDraft(null)
              }}
              autoFocus
              className="w-full resize-none bg-ink-800 border border-ink-700 rounded-card px-4 py-3 text-base text-fg leading-[22px] outline-none transition-colors focus:border-ink-500"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={commit}
                className="h-8 px-4 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-transform active:scale-95"
              >
                Save
              </button>
              <button
                onClick={() => setDraft(null)}
                className="h-8 px-4 rounded-full text-sm text-fg-muted hover:text-fg hover:bg-fg/[0.06] transition-colors active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : item.kind === 'reply' ? (
          <div className={item.error ? 'text-base text-danger mt-1.5' : 'mt-1.5'}>
            {item.error ? item.text : <Markdown text={item.text || '…'} stream={item.streaming} />}
          </div>
        ) : (
          item.text && (
            <p className="text-base text-fg leading-[22px] whitespace-pre-wrap mt-1">
              <MentionText
                text={item.text}
                mentionRefs={item.mentionRefs}
                docMentions={item.docMentions}
                boardMentions={item.boardMentions}
              />
            </p>
          )
        )}
        {item.attachments && <MessageImages attachments={item.attachments} />}
        {item.reactionTargetId && !editing && (
          <MessageReactions
            targetId={item.reactionTargetId}
            reactions={item.reactions}
            deletable={deletable}
            onDelete={() => deleteMessage(item.key)}
            onEdit={canEdit ? () => setDraft(item.text) : undefined}
            onReply={onReply ? () => onReply(item) : undefined}
          />
        )}
      </div>
      {deletable && (
        <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
          {canEdit && (
            <MenuItem
              icon={<PencilGlyph />}
              label="Edit message"
              onClick={() => {
                setMenuAt(null)
                setDraft(item.text)
              }}
            />
          )}
          <MenuItem
            icon={<TrashGlyph />}
            label="Delete message"
            danger
            onClick={() => {
              setMenuAt(null)
              deleteMessage(item.key)
            }}
          />
        </Popover>
      )}
    </div>
  )
}
