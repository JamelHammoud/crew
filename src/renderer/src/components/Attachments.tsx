import { useRef } from 'react'
import { fileSize, isImageType, MAX_ATTACHMENTS } from '../../../shared/attachments'
import { CloseGlyph, PlusGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import { pendingUrl, previewSrc, type PendingAttachment } from './attachment/pending'
import Tooltip from './Tooltip'

const SLOT = 'h-16 rounded-xl border border-fg/10 transition-all duration-150 hover:border-fg/25 active:scale-95'

const open = (item: PendingAttachment): void =>
  useBrowser.getState().openAttachment(pendingUrl(item), item.name, item.mime, item.size)

// A picture is its own thumbnail. Anything else is nothing to look at yet, so it
// stands as its name and its weight at the height the thumbnails are, and the
// tray reads as one row whatever is in it.
function PendingFile({ item }: { item: PendingAttachment }) {
  const Mark = markFor(item.mime)
  return (
    <button
      onClick={() => open(item)}
      aria-label={`Open ${item.name}`}
      className={`${SLOT} flex max-w-52 items-center gap-2.5 px-3 text-left`}
    >
      <Mark className="h-5 w-5 shrink-0 text-fg-muted" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg-secondary">{item.name}</span>
        <span className="block text-xs text-fg-faint">{fileSize(item.size)}</span>
      </span>
    </button>
  )
}

export function AttachmentTray({ attachmentKey }: { attachmentKey: string }) {
  const pending = useCrew(s => s.pending[attachmentKey])
  const detach = useCrew(s => s.detach)
  if (!pending || pending.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {pending.map(item => (
        <div key={item.id} className="relative group animate-pop flex">
          <Tooltip label={item.name}>
            {isImageType(item.mime) ? (
              <button
                onClick={() => open(item)}
                aria-label={`Open ${item.name}`}
                className={`${SLOT} block w-16 overflow-hidden`}
              >
                <img src={previewSrc(item)} alt={item.name} className="block h-full w-full object-cover" />
              </button>
            ) : (
              <PendingFile item={item} />
            )}
          </Tooltip>
          <Tooltip label="Remove" className="absolute -top-1.5 -right-1.5">
            <button
              onClick={() => detach(attachmentKey, item.id)}
              aria-label={`Remove ${item.name}`}
              className="h-5 w-5 rounded-full glass flex items-center justify-center text-fg/70 opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity"
            >
              <CloseGlyph className="w-3 h-3" />
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  )
}

export const ATTACH_SIZES = {
  md: 'w-10 h-10 border border-ink-600 hover:border-ink-500 disabled:hover:border-ink-600',
  sm: 'w-7 h-7'
} as const

// A button that opens something stays lit for as long as what it opened is up,
// so the panel on screen always has the control it came out of standing under
// it. It is the same `data-active` a menu row wears, rather than a state of its
// own written at the one call site that needed it.
export const PLUS_BUTTON =
  'rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 cursor-pointer hover:text-fg hover:bg-fg/[0.06] data-active:text-fg data-active:bg-fg/[0.06] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent shrink-0'

// The file dialog is opened from the plus in the ask bar and from a row in the
// composer's own menu, so the input itself lives in one place and both reach it
// through the same handle.
export function useFilePicker(attachmentKey: string) {
  const attach = useCrew(s => s.attach)
  const inputRef = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      onChange={event => {
        void attach(attachmentKey, event.target.files)
        event.target.value = ''
      }}
    />
  )
  return { input, choose: () => inputRef.current?.click() }
}

export function AttachButton({
  attachmentKey,
  size = 'md'
}: {
  attachmentKey: string
  size?: keyof typeof ATTACH_SIZES
}) {
  const count = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const { input, choose } = useFilePicker(attachmentKey)
  const full = count >= MAX_ATTACHMENTS
  return (
    <>
      {input}
      <Tooltip label={full ? `Up to ${MAX_ATTACHMENTS} files` : 'Add a file'}>
        <button
          onClick={choose}
          disabled={full}
          aria-label="Add a file"
          className={`${ATTACH_SIZES[size]} ${PLUS_BUTTON}`}
        >
          <PlusGlyph className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>
      </Tooltip>
    </>
  )
}
