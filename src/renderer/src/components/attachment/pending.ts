import { isImageType, type OutgoingAttachment } from '../../../../shared/attachments'

export interface PendingAttachment extends OutgoingAttachment {
  id: string
  size: number
}

const THUMB = 128

const MOVING = new Set(['image/gif'])

interface Held {
  file: File
  thumb: string | null
}

const held = new Map<string, Held>()
const urls = new Map<string, string>()

const drawable = (): boolean => typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function'

async function thumbnailOf(mime: string, file: File): Promise<string | null> {
  if (!isImageType(mime) || MOVING.has(mime) || !drawable()) return null
  try {
    const full = await createImageBitmap(file)
    const scale = Math.min(1, THUMB / Math.min(full.width, full.height))
    const width = Math.max(1, Math.round(full.width * scale))
    const height = Math.max(1, Math.round(full.height * scale))
    const small = await createImageBitmap(full, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
    full.close()
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) {
      small.close()
      return null
    }
    context.drawImage(small, 0, 0)
    small.close()
    return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }))
  } catch {
    return null
  }
}

export async function holdPending(id: string, mime: string, file: File): Promise<void> {
  held.set(id, { file, thumb: null })
  const thumb = await thumbnailOf(mime, file)
  if (!thumb) return
  const one = held.get(id)
  if (one) one.thumb = thumb
  else URL.revokeObjectURL(thumb)
}

const letGo = (url: string): void => {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function pendingUrl(item: PendingAttachment): string {
  const made = urls.get(item.id)
  if (made) return made
  const one = held.get(item.id)
  const url = one ? URL.createObjectURL(one.file) : `data:${item.mime};base64,${item.data}`
  urls.set(item.id, url)
  return url
}

export function previewSrc(item: PendingAttachment): string {
  return held.get(item.id)?.thumb ?? pendingUrl(item)
}

export function keepPreviews(ids: Set<string>): void {
  for (const [id, one] of held) {
    if (ids.has(id)) continue
    if (one.thumb) URL.revokeObjectURL(one.thumb)
    held.delete(id)
  }
  for (const [id, url] of urls) {
    if (ids.has(id)) continue
    letGo(url)
    urls.delete(id)
  }
}
