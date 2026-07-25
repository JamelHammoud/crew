import { PencilIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useLayoutEffect, useRef, useState } from 'react'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import Markdown from './Markdown'
import { MemberName, MentionText } from './Mention'
import MessageReactions from './MessageReactions'
import Pill from './Pill'
import { MenuItem, Popover } from './Popover'
import { usePresence } from './presence'
import Tooltip from './Tooltip'
import MessageImages from './MessageImages'
import type { ThreadItem } from './thread'
import { formatFullTime, formatTime } from './time'

export default function ChatMessage({ item, editable = false }: { item: ThreadItem; editable?: boolean }) {
  const presence = usePresence(item.author, item.authorId)
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
  return (
    <div
      className="group/message relative flex gap-4 animate-rise"
      onContextMenu={
        deletable && !editing
          ? event => {
              event.preventDefault()
              setMenuAt({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      {agentSeed ? <AgentIcon seed={agentSeed} presence={presence} /> : <Avatar name={item.author} presence={presence} />}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <MemberName id={item.authorId} name={item.author}>
            <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
              {item.author}
            </span>
          </MemberName>
          {item.self && <Pill>You</Pill>}
          <Tooltip label={formatFullTime(item.ts)}>
            <span className="text-sm text-fg-faint cursor-default">{formatTime(item.ts)}</span>
          </Tooltip>
        </div>
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
            {item.error ? item.text : <Markdown text={item.text || '…'} />}
          </div>
        ) : (
          item.text && (
            <p className="text-base text-fg leading-[22px] whitespace-pre-wrap mt-1">
              <MentionText text={item.text} mentionRefs={item.mentionRefs} docMentions={item.docMentions} />
            </p>
          )
        )}
        {item.attachments && <MessageImages attachments={item.attachments} />}
        {item.streaming && <span className="inline-block w-2 h-4 bg-fg-muted animate-pulse mt-1 rounded-sm" />}
        {item.reactionTargetId && !editing && (
          <MessageReactions
            targetId={item.reactionTargetId}
            reactions={item.reactions}
            deletable={deletable}
            onDelete={() => deleteMessage(item.key)}
            onEdit={canEdit ? () => setDraft(item.text) : undefined}
          />
        )}
      </div>
      {deletable && (
        <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
          {canEdit && (
            <MenuItem
              icon={<PencilIcon />}
              label="Edit message"
              onClick={() => {
                setMenuAt(null)
                setDraft(item.text)
              }}
            />
          )}
          <MenuItem
            icon={<TrashIcon />}
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
