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
const TEXT_EXTENSIONS = (
  'txt text log md-none yml yaml toml ini cfg conf env properties lock patch diff sql ' +
  'sh bash zsh fish ps1 bat awk tcl rake gemspec podspec ' +
  'ts tsx js jsx mjs cjs mts cts vue svelte css scss sass less graphql proto ' +
  'py rb go rs java kt kts swift m mm c h cc cpp hpp cs php pl lua scala sc dart ' +
  'ex exs erl clj cljs edn jl hs ml fs elm zig groovy sbt vb asm ' +
  'tf tfvars hcl nix gradle cmake csproj sln ' +
  'html htm xhtml xml svg plist hbs ejs pug twig j2 ' +
  'rst adoc asciidoc org tex bib po srt vtt ics ' +
  'gitignore gitattributes npmrc editorconfig prettierrc eslintrc babelrc zshrc bashrc vimrc profile'
)
  .split(' ')
  .filter(ext => ext !== 'md-none')

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

// The plainest name for a type is the one that wins, so the last word on it is
// the first one written above.
const EXTENSION_BY_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(FILE_TYPES)
    .reverse()
    .map(([ext, mime]) => [mime, ext])
)

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

const namedExtension = (name: string): string | null => {
  const found = /\.([A-Za-z0-9]{1,12})$/.exec(name)?.[1]
  return found ? found.toLowerCase() : null
}

export function extensionOf(name: string): string {
  return namedExtension(name) ?? 'bin'
}

// A picture is stored under the extension its own type says, since that is the
// one thing a browser hands over reliably. For everything else the type a
// browser reports is a guess and the name is what somebody chose, so the name
// goes first and the type is what is left to go on.
export function extensionUsedFor(mime: string, name: string): string {
  if (isImageType(mime)) return extensionFor(mime)
  return namedExtension(name) ?? EXTENSION_BY_TYPE[mime] ?? 'bin'
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

const ARCHIVE_TYPES = new Set([
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/x-7z-compressed',
  'application/x-bzip2',
  'application/x-xz',
  'application/vnd.rar'
])

const DOCUMENT_TYPES = new Set(['application/pdf', 'application/json', 'application/msword', 'application/rtf'])

export function kindOf(mime: string): AttachmentKind {
  if (isImageType(mime)) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (ARCHIVE_TYPES.has(mime)) return 'archive'
  if (mime.startsWith('text/') || mime.startsWith('application/vnd.') || DOCUMENT_TYPES.has(mime)) return 'document'
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
