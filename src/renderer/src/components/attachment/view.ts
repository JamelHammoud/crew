import { markupOf, previewOf, type PreviewKind } from '../../../../shared/attachments'
import { unpacks } from './archive'

export type ViewKind = PreviewKind | 'file' | 'page' | 'vector'

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// The name only decides this where the type has nothing left to say, which is
// where a page and a vector land: both are handed over as text, so the type says
// text and the name is what says which of the two it really is.
export function viewFor(mime: string, name = ''): ViewKind {
  const kind = previewOf(mime)
  if (kind === 'writing') return mime === DOCX ? 'writing' : 'text'
  if (kind === 'archive') return unpacks(mime) ? 'archive' : 'file'
  if (kind === 'text') return markupOf(name) ?? 'text'
  return kind
}

// A file written to be looked at is offered both ways, as the thing it is and as
// the words it is written in, the way a file in the project is.
export function bothWays(mime: string, name = ''): boolean {
  const kind = viewFor(mime, name)
  if (kind === 'page' || kind === 'vector') return true
  return kind === 'text' && mime === 'text/markdown'
}
