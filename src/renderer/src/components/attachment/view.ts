import { previewOf, type PreviewKind } from '../../../../shared/attachments'
import { unpacks } from './archive'

export type ViewKind = PreviewKind | 'file'

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function viewFor(mime: string): ViewKind {
  const kind = previewOf(mime)
  if (kind === 'writing') return mime === DOCX ? 'writing' : 'text'
  if (kind === 'archive') return unpacks(mime) ? 'archive' : 'file'
  return kind
}
