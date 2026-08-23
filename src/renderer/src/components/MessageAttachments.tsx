import { attachmentUrl, fileSize, isImageType, type Attachment } from '../../../shared/attachments'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import { useImageMenu } from './imageMenu'
import Tooltip from './Tooltip'

const open = (attachment: Attachment, httpBase: string): void =>
  useBrowser
    .getState()
    .openAttachment(attachmentUrl(httpBase, attachment), attachment.name, attachment.mime, attachment.size)

function FileRow({ attachment, httpBase }: { attachment: Attachment; httpBase: string }) {
  const Mark = markFor(attachment.mime)
  return (
    <button
      onClick={() => open(attachment, httpBase)}
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

function ImageAttachment({ attachment, httpBase }: { attachment: Attachment; httpBase: string }) {
  const src = attachmentUrl(httpBase, attachment)
  const { menuOpen, menu, onContextMenu } = useImageMenu(src)
  return (
    <Tooltip label={attachment.name} disabled={menuOpen}>
      <button
        onClick={() => open(attachment, httpBase)}
        onContextMenu={onContextMenu}
        aria-label={`Open ${attachment.name}`}
      >
        <img
          src={src}
          alt={attachment.name}
          className="max-h-64 rounded-xl border border-fg/10 transition-opacity hover:opacity-90"
        />
      </button>
      {menu}
    </Tooltip>
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
            <ImageAttachment key={attachment.id} attachment={attachment} httpBase={httpBase} />
          ))}
        </div>
      )}
      {files.map(attachment => (
        <FileRow key={attachment.id} attachment={attachment} httpBase={httpBase} />
      ))}
    </div>
  )
}
