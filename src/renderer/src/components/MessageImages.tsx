import { attachmentUrl, type Attachment } from '../../../shared/attachments'
import { useCrew } from '../state/store'

export default function MessageImages({ attachments }: { attachments: Attachment[] }) {
  const httpBase = useCrew(s => s.httpBase)
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(attachment => (
        <a
          key={attachment.id}
          href={attachmentUrl(httpBase, attachment)}
          target="_blank"
          rel="noreferrer"
          title={attachment.name}
        >
          <img
            src={attachmentUrl(httpBase, attachment)}
            alt={attachment.name}
            className="max-h-64 rounded-xl border border-white/10 transition-opacity hover:opacity-90"
          />
        </a>
      ))}
    </div>
  )
}
