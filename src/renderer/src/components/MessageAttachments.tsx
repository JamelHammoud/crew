import { attachmentUrl, fileSize, isImageType, showsInPanel, type Attachment } from '../../../shared/attachments'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import Tooltip from './Tooltip'

// The app puts what it can on a screen of its own. Everything else goes to the
// machine, which has something that opens it.
const open = (url: string, mime: string): void => {
  if (showsInPanel(mime)) useBrowser.getState().openUrl(url)
  else void window.crew.openExternal(url)
}

function FileRow({ attachment, httpBase }: { attachment: Attachment; httpBase: string }) {
  const Mark = markFor(attachment.mime)
  const url = attachmentUrl(httpBase, attachment)
  return (
    <button
      onClick={() => open(url, attachment.mime)}
      aria-label={`Open ${attachment.name}`}
      className="flex h-14 w-fit max-w-full items-center gap-2.5 rounded-xl border border-fg/10 px-3.5 text-left transition-all duration-150 hover:border-fg/25 active:scale-[0.98]"
    >
      <Mark className="h-5 w-5 shrink-0 text-fg-muted" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg-secondary">{attachment.name}</span>
        <span className="block text-xs text-fg-faint">{fileSize(attachment.size)}</span>
      </span>
    </button>
  )
}

export default function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const httpBase = useCrew(s => s.httpBase)
  if (attachments.length === 0) return null
  const images = attachments.filter(a => isImageType(a.mime))
  const files = attachments.filter(a => !isImageType(a.mime))
  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(attachment => (
            <Tooltip key={attachment.id} label={attachment.name}>
              <a href={attachmentUrl(httpBase, attachment)} target="_blank" rel="noreferrer">
                <img
                  src={attachmentUrl(httpBase, attachment)}
                  alt={attachment.name}
                  className="max-h-64 rounded-xl border border-fg/10 transition-opacity hover:opacity-90"
                />
              </a>
            </Tooltip>
          ))}
        </div>
      )}
      {files.map(attachment => (
        <FileRow key={attachment.id} attachment={attachment} httpBase={httpBase} />
      ))}
    </div>
  )
}
