import { isImageType } from '../../../../shared/attachments'
import { previewSrc, type PendingAttachment } from '../images'

const made = new Map<string, string>()

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at)
  return bytes
}

export function pendingUrl(item: PendingAttachment): string {
  if (isImageType(item.mime)) return previewSrc(item)
  const found = made.get(item.id)
  if (found) return found
  const url = URL.createObjectURL(new Blob([bytesOf(item.data)], { type: item.mime }))
  made.set(item.id, url)
  return url
}
