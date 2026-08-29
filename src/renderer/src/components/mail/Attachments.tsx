import type { MailAttachment } from '../../state/mail'
import { AttachmentGlyph, DownloadGlyph } from '../../icons'
import { fileSize } from './parts'

export default function MailAttachments({
  attachments,
  onSave
}: {
  attachments: MailAttachment[]
  onSave: (attachment: MailAttachment) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
      {attachments.map(attachment => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => onSave(attachment)}
          className="group min-w-0 px-3 py-2.5 rounded-xl border border-fg/[0.08] flex items-center gap-3 text-left transition-colors hover:border-fg/20 hover:bg-fg/[0.035] active:scale-[0.98]"
        >
          <span className="w-9 h-9 rounded-xl bg-fg/[0.06] flex items-center justify-center text-fg/45 shrink-0">
            <AttachmentGlyph className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-fg/75">{attachment.name}</span>
            <span className="block mt-0.5 text-[11px] text-fg/35">{fileSize(attachment.size)}</span>
          </span>
          <DownloadGlyph className="w-4 h-4 shrink-0 text-fg/25 transition-colors group-hover:text-fg/60" />
        </button>
      ))}
    </div>
  )
}
