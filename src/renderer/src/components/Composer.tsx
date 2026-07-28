import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { ArrowUpGlyph, StopGlyph } from '../icons'
import { useCrew } from '../state/store'
import AddMenu from './AddMenu'
import { AttachmentTray } from './Attachments'
import { clickToFocus } from './clickToFocus'
import { covers, spanned, useSelectedRange, type SelectedRange } from './composerSelection'
import Emoji from './Emoji'
import { tokenizeEmoji } from './emojiTokens'
import { tokenizeMentions, writtenRefs } from './mentionTokens'
import ReplyPreview from './ReplyPreview'
import Tooltip from './Tooltip'
import type { ThreadItem } from './thread'

// The textarea keeps its own glyph under the caret, so the sheet is painted
// over it rather than in place of it. The patch is opaque, which takes the band
// the textarea draws under a selection with it, so it paints that band itself.
function EmojiHighlight({
  text,
  at,
  selection
}: {
  text: string
  at: number
  selection: SelectedRange | null
}) {
  const tokens = useMemo(() => spanned(tokenizeEmoji(text), at), [at, text])
  return (
    <>
      {tokens.map(({ token, start, end }, index) =>
        token.kind === 'text' ? (
          token.text
        ) : (
          <span key={index} className="relative inline-block">
            {token.text}
            <span className="absolute inset-y-0 -inset-x-px flex items-center justify-center bg-ink-800">
              {covers(selection, start, end) && (
                <span className="absolute inset-y-0 inset-x-px bg-selection" />
              )}
              <Emoji char={token.entry.char} size="1.15em" />
            </span>
          </span>
        )
      )}
    </>
  )
}

function MentionHighlights({ value, selection }: { value: string; selection: SelectedRange | null }) {
  const agents = useCrew(s => s.agents)
  const members = useCrew(s => s.members)
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const tokens = useMemo(
    () => spanned(tokenizeMentions(value, agents, members, writtenRefs(value, docs, boards)), 0),
    [agents, boards, docs, members, value]
  )
  return (
    <>
      {tokens.map(({ token, start }, index) => {
        if (token.kind === 'agent' || token.kind === 'member') {
          return (
            <span key={index} className="rounded-md pl-0.5 -ml-0.5 py-0.5 bg-fg/10">
              {token.text}
            </span>
          )
        }
        if (token.kind === 'ref') {
          return (
            <span
              key={index}
              className="rounded-md pl-0.5 -ml-0.5 py-0.5 text-sky-300 bg-sky-400/15 light:text-sky-700 light:bg-sky-500/10"
            >
              {token.text}
            </span>
          )
        }
        return <EmojiHighlight key={index} text={token.text} at={start} selection={selection} />
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
  huddle,
  replyTo,
  onCancelReply,
  chips,
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
  huddle?: boolean
  replyTo?: ThreadItem
  onCancelReply?: () => void
  children?: ReactNode
}) {
  const attach = useCrew(s => s.attach)
  const pendingCount = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const highlightRef = useRef<HTMLDivElement>(null)
  const selection = useSelectedRange(inputRef)
  const canSend = value.trim().length > 0 || pendingCount > 0

  return (
    <div className="relative">
      {children}
      {replyTo && <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />}
      <div
        className="relative bg-ink-800 rounded-shell p-5 flex flex-col transition-shadow duration-200 focus-within:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_40px_rgb(0_0_0/0.4)] light:focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_12px_40px_rgb(0_0_0/0.1)] cursor-text"
        onClick={clickToFocus(inputRef)}
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
            className="absolute inset-y-0 -inset-x-1 px-1 z-10 overflow-hidden text-base text-fg whitespace-pre-wrap break-words leading-relaxed pointer-events-none"
          >
            <MentionHighlights value={value} selection={selection} />
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
          <AddMenu attachmentKey={attachmentKey} huddle={huddle} onSend={onSend} />
          {onStop && !canSend ? (
            <Tooltip label="Stop">
              <button
                onClick={onStop}
                aria-label="Stop"
                className="w-10 h-10 rounded-full bg-fg text-ink-800 flex items-center justify-center transition-transform duration-150 cursor-pointer hover:scale-105 active:scale-95"
              >
                <StopGlyph className="w-5 h-5" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label={sendLabel}>
              <button
                onClick={onSend}
                disabled={!canSend}
                aria-label={sendLabel}
                className="w-10 h-10 rounded-full bg-fg text-ink-800 flex items-center justify-center transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 disabled:bg-fg/10 disabled:text-fg-muted disabled:scale-100"
              >
                <ArrowUpGlyph className="w-5 h-5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
