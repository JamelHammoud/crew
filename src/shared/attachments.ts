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
  'image/webp': 'webp'
}

const IMAGE_BY_EXTENSION: Record<string, string> = {
  ...Object.fromEntries(Object.entries(IMAGE_TYPES).map(([mime, ext]) => [ext, mime])),
  jpeg: 'image/jpeg'
}

// Anything made of words is handed over as text, whatever it was written in.
// A page and a vector are markup a browser would run, and an attachment is
// served from the host's own address, so one carrying a script would be reading
// the session from inside it. As text they are still there to read and there is
// nothing to run.
const TEXT_EXTENSIONS = [
  'txt',
  'text',
  'log',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'sql',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'patch',
  'diff',
  'lock',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'pl',
  'lua',
  'scala',
  'dart',
  'vue',
  'svelte',
  'css',
  'scss',
  'sass',
  'less',
  'graphql',
  'proto',
  'gradle',
  'cmake',
  'html',
  'htm',
  'xhtml',
  'xml',
  'svg',
  'plist'
]

const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  bz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  ...Object.fromEntries(TEXT_EXTENSIONS.map(ext => [ext, 'text/plain']))
}

export const DOWNLOAD_TYPE = 'application/octet-stream'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 6

const FILE_NAME = /^[a-z0-9-]+\.[a-z0-9]{1,12}$/

export type AttachmentKind = 'image' | 'video' | 'audio' | 'archive' | 'document' | 'file'

export function isImageType(mime: string): boolean {
  return mime in IMAGE_TYPES
}

export function extensionFor(mime: string): string {
  return IMAGE_TYPES[mime]
}

// A picture is stored under the extension its own type says, since that is the
// one thing a browser hands over reliably. For everything else the type a
// browser reports is a guess and the name is what somebody chose, so the name
// decides, and a file with nothing to go on is kept as it arrived.
export function extensionOf(name: string): string {
  const found = /\.([A-Za-z0-9]{1,12})$/.exec(name)?.[1]
  return found ? found.toLowerCase() : 'bin'
}

export function extensionUsedFor(mime: string, name: string): string {
  return isImageType(mime) ? extensionFor(mime) : extensionOf(name)
}

export function mimeForFile(file: string): string {
  const ext = extensionOf(file)
  return IMAGE_BY_EXTENSION[ext] ?? FILE_TYPES[ext] ?? DOWNLOAD_TYPE
}

export function isAttachmentFile(file: string): boolean {
  return FILE_NAME.test(file)
}

// What the app can put on a screen itself. Everything else is handed to the
// machine, which has something that opens it.
export function showsInPanel(mime: string): boolean {
  return (
    mime.startsWith('text/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf' ||
    mime === 'application/json'
  )
}

export function kindOf(mime: string): AttachmentKind {
  if (isImageType(mime)) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/zip' || mime === 'application/gzip' || mime === 'application/x-tar') return 'archive'
  if (mime.startsWith('application/x-') || mime === 'application/vnd.rar') return 'archive'
  if (mime.startsWith('text/') || mime === 'application/pdf' || mime === 'application/json') return 'document'
  if (mime.startsWith('application/vnd.') || mime === 'application/msword' || mime === 'application/rtf')
    return 'document'
  return 'file'
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function attachmentFileUrl(httpBase: string, file: string): string {
  return `${httpBase}/attachments/${file}`
}

export function attachmentUrl(httpBase: string, attachment: Attachment): string {
  return attachmentFileUrl(httpBase, attachment.file)
}

export function httpBaseFrom(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '')
}
