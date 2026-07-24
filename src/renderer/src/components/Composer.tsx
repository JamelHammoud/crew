import { ArrowUpIcon } from '@heroicons/react/20/solid'
import { StopIcon } from '@heroicons/react/16/solid'
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useCrew } from '../state/store'
import { AttachButton, AttachmentTray } from './Attachments'
import { tokenizeMentions } from './mentionTokens'
import Tooltip from './Tooltip'

function MentionHighlights({ value }: { value: string }) {
  const agents = useCrew(s => s.agents)
  const docs = useCrew(s => s.docs)
  const tokens = useMemo(() => tokenizeMentions(value, agents, docs), [agents, docs, value])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'agent') {
          return (
            <span key={index} className="rounded-md px-0.5 -mx-0.5 py-0.5 bg-fg/10">
              {token.text}
            </span>
          )
        }
        if (token.kind === 'doc') {
          return (
            <span
              key={index}
              className="rounded-md px-0.5 -mx-0.5 py-0.5 text-sky-300 bg-sky-400/15 light:text-sky-700 light:bg-sky-500/10"
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
  children?: ReactNode
}) {
  const attach = useCrew(s => s.attach)
  const pendingCount = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const highlightRef = useRef<HTMLDivElement>(null)
  const canSend = value.trim().length > 0 || pendingCount > 0

  return (
    <div className="relative">
      {children}
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
            placeholder={placeholder}
            className="relative block w-full bg-transparent text-base text-transparent caret-fg placeholder:text-fg-muted outline-none resize-none leading-relaxed max-h-48"
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
