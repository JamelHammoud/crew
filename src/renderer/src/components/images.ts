import {
  isImageType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  mimeForFile,
  type OutgoingAttachment
} from '../../../shared/attachments'

export interface PendingAttachment extends OutgoingAttachment {
  id: string
  size: number
}

export const previewSrc = (attachment: PendingAttachment): string =>
  `data:${attachment.mime};base64,${attachment.data}`

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export function filesFrom(items: FileList | File[] | null | undefined): File[] {
  return [...(items ?? [])].filter(file => file.size <= MAX_ATTACHMENT_BYTES)
}

// A photo is a picture, so that one path takes images and nothing else. A
// message takes whatever somebody dropped on it.
export function imagesFrom(items: FileList | File[] | null | undefined): File[] {
  return filesFrom(items).filter(file => isImageType(file.type))
}

export async function uploadImage(httpBase: string, file: File): Promise<string> {
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
  return `${httpBase}/attachments/${saved.file}`
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
      return {
        id: crypto.randomUUID(),
        name: file.name || (isImageType(mime) ? 'image' : 'file'),
        mime,
        size: file.size,
        data: await readAsBase64(file)
      }
    })
  )
  return read.filter(item => item.data.length > 0)
}
