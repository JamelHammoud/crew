import { attachmentUrl, type Attachment } from '../../../shared/attachments'
import { useCrew } from '../state/store'
import Tooltip from './Tooltip'

export default function MessageImages({ attachments }: { attachments: Attachment[] }) {
  const httpBase = useCrew(s => s.httpBase)
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(attachment => (
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
  )
}
