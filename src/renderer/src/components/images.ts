import { isImageType, MAX_ATTACHMENTS, mimeForFile } from '../../../shared/attachments'
import { holdPending, type PendingAttachment } from './attachment/pending'

export type { PendingAttachment } from './attachment/pending'
export { keepPreviews, previewSrc } from './attachment/pending'

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const comma = url.indexOf(',')
      resolve(comma < 0 ? '' : url.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

// How big a file may be is the crew's, so it arrives from the session rather
// than being a number written here. Anything over it is left behind, and the
// caller is what says so.
export function filesFrom(items: FileList | File[] | null | undefined, limit: number): File[] {
  return [...(items ?? [])].filter(file => file.size <= limit)
}

// A photo is a picture, so that one path takes images and nothing else. A
// message takes whatever somebody dropped on it.
export function imagesFrom(items: FileList | File[] | null | undefined, limit: number): File[] {
  return filesFrom(items, limit).filter(file => isImageType(file.type))
}

export async function uploadImageFile(httpBase: string, file: File): Promise<string> {
  const res = await fetch(`${httpBase}/attachments`, {
    method: 'POST',
    headers: {
      'content-type': file.type,
      'x-attachment-name': encodeURIComponent(file.name || 'image')
    },
    body: file
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const saved = (await res.json()) as { file: string }
  return saved.file
}

export async function uploadImage(httpBase: string, file: File): Promise<string> {
  return `${httpBase}/attachments/${await uploadImageFile(httpBase, file)}`
}

const ATTACH_MARK = '](attachments/'

export function localizeDoc(markdown: string, httpBase: string): string {
  if (!httpBase) return markdown
  return markdown.replaceAll(ATTACH_MARK, `](${httpBase}/attachments/`)
}

export function relativizeDoc(markdown: string, httpBase: string): string {
  if (!httpBase) return markdown
  return markdown.replaceAll(`](${httpBase}/attachments/`, ATTACH_MARK)
}

// A browser reports the type of a picture reliably and guesses at everything
// else, so the name decides for the rest. That is the same rule the host keeps,
// which is what makes the mark in the tray the mark on the message.
const typeOf = (file: File): string => (isImageType(file.type) ? file.type : mimeForFile(file.name))

export async function readFiles(files: File[], taken: number): Promise<PendingAttachment[]> {
  const room = Math.max(0, MAX_ATTACHMENTS - taken)
  const read = await Promise.all(
    files.slice(0, room).map(async file => {
      const mime = typeOf(file)
      const id = crypto.randomUUID()
      const [data] = await Promise.all([readAsBase64(file), holdPending(id, mime, file)])
      return {
        id,
        name: file.name || (isImageType(mime) ? 'image' : 'file'),
        mime,
        size: file.size,
        data
      }
    })
  )
  return read.filter(item => item.data.length > 0)
}
