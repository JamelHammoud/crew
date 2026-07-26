import { ArrowUpIcon, ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { StopIcon } from '@heroicons/react/16/solid'
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useCrew } from '../state/store'
import { AttachButton, AttachmentTray } from './Attachments'
import { tokenizeMentions } from './mentionTokens'
import Tooltip from './Tooltip'
import type { ThreadItem } from './thread'

function MentionHighlights({ value }: { value: string }) {
  const agents = useCrew(s => s.agents)
  const docs = useCrew(s => s.docs)
  const tokens = useMemo(() => tokenizeMentions(value, agents, docs), [agents, docs, value])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'agent') {
          return (
            <span key={index} className="rounded-md pl-0.5 -ml-0.5 py-0.5 bg-fg/10">
              {token.text}
            </span>
          )
        }
        if (token.kind === 'doc') {
          return (
            <span
              key={index}
              className="rounded-md pl-0.5 -ml-0.5 py-0.5 text-sky-300 bg-sky-400/15 light:text-sky-700 light:bg-sky-500/10"
            >
              {token.text}
            </span>
          )
        }
        return token.text
      })}
      {'\u200b'}
    </>
  )
}

export default function Composer({
  attachmentKey,
  value,
  placeholder,
  inputRef,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  sendLabel = 'Send',
  replyTo,
  onCancelReply,
  children
}: {
  attachmentKey: string
  value: string
  placeholder: string
  inputRef: RefObject<HTMLTextAreaElement>
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onSend: () => void
  onStop?: () => void
  sendLabel?: string
  replyTo?: ThreadItem
  onCancelReply?: () => void
  children?: ReactNode
}) {
  const attach = useCrew(s => s.attach)
  const pendingCount = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const highlightRef = useRef<HTMLDivElement>(null)
  const canSend = value.trim().length > 0 || pendingCount > 0

  return (
    <div className="relative">
      {children}
      {replyTo && (
        <div className="mx-3 mb-2 flex min-w-0 items-center gap-3 rounded-card border border-ink-700 bg-ink-800 px-3 py-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.2)]">
          <ArrowUturnLeftIcon className="h-4 w-4 shrink-0 text-fg-secondary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg">Replying to {replyTo.author}</p>
            <p className="mt-0.5 truncate text-sm text-fg-muted">{replyTo.text}</p>
          </div>
          <Tooltip label="Cancel reply">
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={onCancelReply}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted transition-all hover:bg-fg/[0.06] hover:text-fg active:scale-95"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      )}
      <div
        className="bg-ink-800 rounded-shell p-5 flex flex-col transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_40px_rgb(0_0_0/0.4)] light:focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_12px_40px_rgb(0_0_0/0.1)] cursor-text"
        onClick={() => inputRef.current?.focus()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          void attach(attachmentKey, event.dataTransfer.files)
        }}
      >
        <AttachmentTray attachmentKey={attachmentKey} />
        <div className="relative">
          <div
            ref={highlightRef}
            aria-hidden
            className="absolute inset-y-0 -inset-x-1 px-1 overflow-hidden text-base text-fg whitespace-pre-wrap break-words leading-relaxed pointer-events-none"
          >
            <MentionHighlights value={value} />
          </div>
          <textarea
            ref={inputRef}
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={event => void attach(attachmentKey, event.clipboardData.files)}
            onScroll={event => {
              if (highlightRef.current) highlightRef.current.scrollTop = event.currentTarget.scrollTop
            }}
            rows={2}
            spellCheck={false}
            placeholder={placeholder}
            className="relative block w-full bg-transparent text-base text-transparent caret-fg placeholder:text-fg-muted outline-none resize-none leading-relaxed max-h-48 [scrollbar-width:none]"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <AttachButton attachmentKey={attachmentKey} />
          {onStop && !canSend ? (
            <Tooltip label="Stop">
              <button
                onClick={onStop}
                aria-label="Stop"
                className="w-10 h-10 rounded-full bg-fg text-ink-900 flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label={sendLabel}>
              <button
                onClick={onSend}
                disabled={!canSend}
                aria-label={sendLabel}
                className="w-10 h-10 rounded-full bg-fg text-ink-900 flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 disabled:bg-fg/10 disabled:text-fg-muted disabled:scale-100"
              >
                <ArrowUpIcon className="w-5 h-5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
