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
// nothing to run. The last row of them is dotfiles, which are all extension, so
// the whole of the name a person wrote is what says it is words.
const TEXT_EXTENSIONS = (
  'txt text log yml yaml toml ini cfg conf env properties lock patch diff sql ' +
  'sh bash zsh fish ps1 bat awk tcl rake gemspec podspec ' +
  'ts tsx js jsx mjs cjs mts cts vue svelte css scss sass less graphql proto ' +
  'py rb go rs java kt kts swift m mm c h cc cpp hpp cs php pl lua scala sc dart ' +
  'ex exs erl clj cljs edn jl hs ml fs elm zig groovy sbt vb asm ' +
  'tf tfvars hcl nix gradle cmake csproj sln ' +
  'html htm xhtml xml svg plist hbs ejs pug twig j2 ' +
  'rst adoc asciidoc org tex bib po srt vtt ics ' +
  'gitignore gitattributes npmrc editorconfig prettierrc eslintrc babelrc zshrc bashrc vimrc profile'
).split(' ')

const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  jsonl: 'text/plain',
  ndjson: 'text/plain',
  ipynb: 'application/json',
  mdx: 'text/markdown',
  rtf: 'application/rtf',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  ico: 'image/x-icon',
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

export const MAX_ATTACHMENTS = 6

// How big a file may be is the crew's own, since everything sent lands in the
// folder they share and the host is what turns a big one away. It is written
// down as one event and folded off the log the way the toolbox is, so a number
// somebody picked months ago is still the number.
export const DEFAULT_ATTACHMENT_MB = 10

// No limit is written down as nought, the way nginx writes it, since nobody
// could have meant a limit of nothing. It rides over the wire as a number like
// every other, which nothing nullish can: a snapshot with no number in it is a
// host that predates the setting, and that has to read as the default rather
// than as no limit at all.
export const ATTACHMENT_UNLIMITED = 0
export const ATTACHMENT_MB_LIMIT = 10_000
export const ATTACHMENT_MB_STEPS = [
  1,
  2,
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1000,
  2000,
  5000,
  ATTACHMENT_MB_LIMIT,
  ATTACHMENT_UNLIMITED
]

// The sizes past half a gigabyte stand only while the crew is this machine's
// own. Shared, a file is pulled by every machine here and lands in the history
// they sync, so it is everyone's disk and not just yours. A number picked before
// anybody was invited still stands, because it is the crew's number rather than
// a window's, so it is offered wherever it falls.
export const SHARED_ATTACHMENT_MB = 500

// A megabyte is a million bytes here, which is what the Finder counts in and
// what a file says it is everywhere somebody would go and check. Counting the
// limit in one unit and saying it in another is how a ten megabyte limit turns
// away a file the machine calls ten megabytes.
export const attachmentBytes = (mb: number): number =>
  mb === ATTACHMENT_UNLIMITED ? Number.POSITIVE_INFINITY : mb * 1000 * 1000

const bySize = (mbs: number[]): number[] => [...mbs].sort((a, b) => attachmentBytes(a) - attachmentBytes(b))

export function attachmentMbChoices(shared: boolean, picked: number): number[] {
  if (!shared) return ATTACHMENT_MB_STEPS
  const ladder = ATTACHMENT_MB_STEPS.filter(mb => mb !== ATTACHMENT_UNLIMITED && mb <= SHARED_ATTACHMENT_MB)
  return ladder.includes(picked) ? ladder : bySize([...ladder, picked])
}

// A size somebody picks is said the way a size on a file is said, through the one
// formatter, or the ladder and the row under a file disagree about what a
// gigabyte is.
export function attachmentMbLabel(mb: number): string {
  return mb === ATTACHMENT_UNLIMITED ? 'No limit' : fileSize(attachmentBytes(mb))
}

export function cleanAttachmentMb(mb: unknown): number | null {
  if (typeof mb !== 'number' || !Number.isFinite(mb)) return null
  const whole = Math.round(mb)
  if (whole === ATTACHMENT_UNLIMITED) return whole
  return whole >= 1 && whole <= ATTACHMENT_MB_LIMIT ? whole : null
}

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

// What a thing is, which is what the mark on it says. Whether the app can draw
// it is a different question, and `isImageType` is the one that answers it: a
// photo off a phone is a picture on the row and still a file to open.
export function kindOf(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (ARCHIVE_TYPES.has(mime)) return 'archive'
  if (mime.startsWith('text/') || mime.startsWith('application/vnd.') || DOCUMENT_TYPES.has(mime)) return 'document'
  return 'file'
}

const SHEET_TYPES = new Set([
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet'
])

const WRITING_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf'
])

// How the app draws one, which is a different question from what it is. Every
// file has an answer here, because one nobody can name still has something in
// it: what is left over is read as its own contents rather than handed to the
// machine with nothing shown.
export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'sheet' | 'writing' | 'archive' | 'text'

const PAGE_NAMES = new Set(['html', 'htm', 'xhtml'])

export type MarkupKind = 'page' | 'vector'

// A page and a vector are handed over as text on purpose, so the type one
// carries says nothing about what it is and the name is the only thing left that
// does. Both are still written to be looked at, and neither is ever served as
// itself: a page is drawn from the words in hand, standing away from the address
// the session is on, and a vector is drawn as the picture it is.
export function markupOf(name: string): MarkupKind | null {
  const ext = namedExtension(name)
  if (!ext) return null
  if (PAGE_NAMES.has(ext)) return 'page'
  return ext === 'svg' ? 'vector' : null
}

export function previewOf(mime: string): PreviewKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (SHEET_TYPES.has(mime)) return 'sheet'
  if (WRITING_TYPES.has(mime)) return 'writing'
  if (ARCHIVE_TYPES.has(mime)) return 'archive'
  return 'text'
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

// A thousand of one unit is one of the next, which is how a disk is sold and how
// the Finder counts, so a file is the size here that it is everywhere else
// somebody would go and look. Nothing ever stands in four digits of the unit
// below. The decimal is worth a digit only under ten, where it is the difference
// between two files, and a trailing nought is a digit spent on nothing, so 1 MB,
// 1.4 MB, 14 MB, 140 MB.
export function fileSize(bytes: number): string {
  let size = Math.max(0, bytes)
  let unit = 0
  while (unit < UNITS.length - 1 && Math.round(size) >= 1000) {
    size /= 1000
    unit += 1
  }
  const said = unit > 0 && size < 10 ? size.toFixed(1) : String(Math.round(size))
  return `${said.replace(/\.0$/, '')} ${UNITS[unit]}`
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
