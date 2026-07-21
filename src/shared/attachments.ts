export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  file: string
}

export interface OutgoingAttachment {
  name: string
  mime: string
  data: string
}

export const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}

export const ATTACHMENT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'text/csv': 'csv'
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 6

const FILE_NAME = /^[a-z0-9-]+\.(png|jpg|gif|webp|svg|pdf|txt|md|json|csv)$/

export function isImageType(mime: string): boolean {
  return mime in IMAGE_TYPES
}

export function isAttachmentType(mime: string): boolean {
  return mime in ATTACHMENT_TYPES
}

export function extensionFor(mime: string): string {
  return ATTACHMENT_TYPES[mime]
}

export function mimeForFile(file: string): string | null {
  const ext = file.split('.').pop()
  const found = Object.entries(ATTACHMENT_TYPES).find(([, value]) => value === ext)
  return found ? found[0] : null
}

export function isAttachmentFile(file: string): boolean {
  return FILE_NAME.test(file)
}

export function attachmentUrl(httpBase: string, attachment: Attachment): string {
  return `${httpBase}/attachments/${attachment.file}`
}

export function httpBaseFrom(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '')
}
