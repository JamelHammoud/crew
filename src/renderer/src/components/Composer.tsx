import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { pathRuns, type PathIndex } from '../../../shared/pathMention'
import { ArrowUpGlyph, StopGlyph } from '../icons'
import { useMachineFiles } from '../state/machineFiles'
import { useProjectFiles } from '../state/projectFiles'
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
//
// It takes the room the character takes and no more. As tall as the line it was
// standing over the whole caret, and a pixel wider on each side it was standing
// over the one drawn against the emoji's own edge, so a box with a picture in it
// read as one nothing could be typed into. Held to the character's own square,
// the caret is met above and below the picture and the band runs on either side.
function EmojiHighlight({
  text,
  at,
  selection,
  surface
}: {
  text: string
  at: number
  selection: SelectedRange | null
  surface: string
}) {
  const tokens = useMemo(() => spanned(tokenizeEmoji(text), at), [at, text])
  return (
    <>
      {tokens.map(({ token, start, end }, index) =>
        // One of the crew's own is a `:name:` and stays the words it was typed
        // in. The patch is a square standing over one glyph, and ten characters
        // of a name is not one: it would cover the rest of the line.
        token.kind !== 'emoji' ? (
          token.text
        ) : (
          <span key={index} className="relative inline-block">
            {token.text}
            <span
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 aspect-square flex items-center justify-center ${surface}`}
            >
              {covers(selection, start, end) && <span className="absolute inset-0 bg-selection" />}
              <Emoji char={token.entry.char} size="100%" />
            </span>
          </span>
        )
      )}
    </>
  )
}

// A path arrives as a link for everyone who reads it, so it says so in the box
// it is written in, the way a name somebody is about to be handed does.
function PathHighlight({
  text,
  at,
  files,
  known,
  selection,
  surface
}: {
  text: string
  at: number
  files: PathIndex
  known: Set<string>
  selection: SelectedRange | null
  surface: string
}) {
  const runs = useMemo(() => spanned(pathRuns(text, files, known), at), [at, files, known, text])
  return (
    <>
      {runs.map(({ token, start }, index) =>
        token.path ? (
          <span key={index} className="rounded-md pl-0.5 -ml-0.5 py-0.5 bg-fg/10">
            {token.text}
          </span>
        ) : (
          <EmojiHighlight key={index} text={token.text} at={start} selection={selection} surface={surface} />
        )
      )}
    </>
  )
}

function MentionHighlights({
  value,
  selection,
  surface
}: {
  value: string
  selection: SelectedRange | null
  surface: string
}) {
  const agents = useCrew(s => s.agents)
  const members = useCrew(s => s.members)
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const files = useProjectFiles(s => s.index)
  const known = useMachineFiles(s => s.known)
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
        return (
          <PathHighlight
            key={index}
            text={token.text}
            at={start}
            files={files}
            known={known}
            selection={selection}
            surface={surface}
          />
        )
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
  defaultAgent,
  replyTo,
  onCancelReply,
  chips,
  ghost,
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
  defaultAgent?: boolean
  replyTo?: ThreadItem
  onCancelReply?: () => void
  chips?: ReactNode
  ghost?: boolean
  children?: ReactNode
}) {
  const attach = useCrew(s => s.attach)
  const pendingCount = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const highlightRef = useRef<HTMLDivElement>(null)
  const selection = useSelectedRange(inputRef)
  const canSend = value.trim().length > 0 || pendingCount > 0

  // Nothing typed here is kept, so the box stops being a solid one: it drops to
  // the page's own surface and wears the dashed stroke a hidden thread wears
  // everywhere else. The border stands in both states so the row cannot shift.
  const surface = ghost ? 'bg-ink-900' : 'bg-ink-800'

  // The room above the first line belongs to the scroller rather than to the
  // card, so a line scrolled past runs to the top edge instead of being cut
  // short with a band of the card standing empty over it. A tray takes that
  // room back, since the text scrolls up under whatever is attached.
  const tray = pendingCount > 0
  const above = tray ? 'pt-5' : ''
  const lead = tray ? '' : 'pt-5'

  return (
    <div className="relative">
      {children}
      {replyTo && <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />}
      <div
        className={`relative ${surface} border ${
          ghost ? 'border-dashed border-ink-600' : 'border-transparent'
        } rounded-shell p-5 flex flex-col transition-[background-color,border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_40px_rgb(0_0_0/0.4)] light:focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_12px_40px_rgb(0_0_0/0.1)] cursor-text`}
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
            <MentionHighlights value={value} selection={selection} surface={surface} />
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
            className="relative block w-full bg-transparent text-base text-transparent caret-fg placeholder:text-fg-muted outline-none resize-none leading-relaxed max-h-48 no-scrollbar"
          />
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-2 min-w-0">
            <AddMenu
              attachmentKey={attachmentKey}
              huddle={huddle && !ghost}
              defaultAgent={defaultAgent}
              inputRef={inputRef}
              onSend={onSend}
            />
            {chips}
          </div>
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
