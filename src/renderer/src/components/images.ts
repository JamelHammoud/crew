import {
  isAttachmentType,
  isImageType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
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

export function imagesFrom(items: FileList | File[] | null | undefined): File[] {
  return [...(items ?? [])].filter(file => isImageType(file.type) && file.size <= MAX_ATTACHMENT_BYTES)
}

export function attachmentsFrom(items: FileList | File[] | null | undefined): File[] {
  return [...(items ?? [])].filter(file => isAttachmentType(file.type) && file.size <= MAX_ATTACHMENT_BYTES)
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

export async function readImages(files: File[], taken: number): Promise<PendingAttachment[]> {
  const room = Math.max(0, MAX_ATTACHMENTS - taken)
  const read = await Promise.all(
    files.slice(0, room).map(async file => ({
      id: crypto.randomUUID(),
      name: file.name || 'image',
      mime: file.type,
      size: file.size,
      data: await readAsBase64(file)
    }))
  )
  return read.filter(item => item.data.length > 0)
}

export const readAttachments = readImages
