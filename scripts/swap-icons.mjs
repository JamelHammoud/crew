import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const ICONS = path.join(root, 'src/renderer/src/icons')

const MAP = {
  ArchiveBoxIcon: 'ArchiveGlyph',
  ArchiveBoxXMarkIcon: 'UnarchiveGlyph',
  ArrowDownIcon: 'ArrowDownGlyph',
  ArrowLeftIcon: 'ArrowLeftGlyph',
  ArrowPathIcon: 'RefreshGlyph',
  ArrowRightIcon: 'ArrowRightGlyph',
  ArrowRightStartOnRectangleIcon: 'LeaveGlyph',
  ArrowTopRightOnSquareIcon: 'ExternalLinkGlyph',
  ArrowUpIcon: 'ArrowUpGlyph',
  ArrowUpTrayIcon: 'UploadGlyph',
  ArrowUturnLeftIcon: 'UndoGlyph',
  ArrowUturnRightIcon: 'RedoGlyph',
  ArrowsPointingInIcon: 'CollapseGlyph',
  ArrowsPointingOutIcon: 'ExpandGlyph',
  Bars2Icon: 'HandleGlyph',
  Bars3Icon: 'MenuGlyph',
  CheckCircleIcon: 'CheckCircleGlyph',
  CheckIcon: 'CheckGlyph',
  ChevronDownIcon: 'ChevronDownGlyph',
  ChevronLeftIcon: 'ChevronLeftGlyph',
  ChevronRightIcon: 'ChevronRightGlyph',
  ChevronUpIcon: 'ChevronUpGlyph',
  ClipboardDocumentListIcon: 'ChecklistGlyph',
  ClockIcon: 'ClockGlyph',
  CloudIcon: 'CloudGlyph',
  CommandLineIcon: 'TerminalGlyph',
  ComputerDesktopIcon: 'DesktopGlyph',
  DocumentDuplicateIcon: 'DuplicateGlyph',
  DocumentIcon: 'FileGlyph',
  DocumentTextIcon: 'DocGlyph',
  EllipsisHorizontalIcon: 'MoreGlyph',
  EllipsisVerticalIcon: 'MoreVerticalGlyph',
  ExclamationTriangleIcon: 'WarningGlyph',
  EyeDropperIcon: 'EyedropperGlyph',
  EyeIcon: 'EyeGlyph',
  EyeSlashIcon: 'EyeOffGlyph',
  FaceSmileIcon: 'SmileGlyph',
  FilmIcon: 'FilmGlyph',
  FolderIcon: 'FolderGlyph',
  GlobeAltIcon: 'GlobeGlyph',
  HandRaisedIcon: 'HandGlyph',
  LinkIcon: 'LinkGlyph',
  LockClosedIcon: 'LockGlyph',
  LockOpenIcon: 'UnlockGlyph',
  MagnifyingGlassIcon: 'SearchGlyph',
  MicrophoneIcon: 'MicGlyph',
  MinusIcon: 'MinusGlyph',
  MoonIcon: 'MoonGlyph',
  PencilIcon: 'PencilGlyph',
  PhoneXMarkIcon: 'HangupGlyph',
  PhotoIcon: 'PhotoGlyph',
  PlusIcon: 'PlusGlyph',
  RectangleGroupIcon: 'GroupGlyph',
  SignalIcon: 'SignalGlyph',
  SignalSlashIcon: 'SignalOffGlyph',
  SpeakerWaveIcon: 'SpeakerGlyph',
  SpeakerXMarkIcon: 'SpeakerOffGlyph',
  StarIcon: 'StarGlyph',
  StopIcon: 'StopGlyph',
  SunIcon: 'SunGlyph',
  TrashIcon: 'TrashGlyph',
  UserGroupIcon: 'PeopleGlyph',
  VideoCameraIcon: 'CameraGlyph',
  VideoCameraSlashIcon: 'CameraOffGlyph',
  WindowIcon: 'WindowGlyph',
  XCircleIcon: 'XCircleGlyph',
  XMarkIcon: 'CloseGlyph'
}

const SKIP = new Set(['src/renderer/src/design/glyphs.tsx'])

const files = execSync("grep -rl '@heroicons/react' src", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(f => !SKIP.has(f))

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@heroicons\/react\/[^']*'\n/g
const IMPORT_ANY = /^import\s[\s\S]*?from\s*'([^']*)'\n/gm

let touched = 0
for (const file of files) {
  let text = readFileSync(file, 'utf8')
  const wanted = new Set()
  let first = -1
  text = text.replace(IMPORT, (match, names, offset) => {
    if (first < 0) first = offset
    for (const raw of names.split(',')) {
      const name = raw.trim()
      if (!name) continue
      const glyph = MAP[name]
      if (!glyph) throw new Error(`${file}: no glyph for ${name}`)
      wanted.add(glyph)
    }
    return ''
  })
  if (!wanted.size) continue

  for (const [icon, glyph] of Object.entries(MAP)) {
    text = text.replace(new RegExp(`\\b${icon}\\b`, 'g'), glyph)
  }

  const rel = path.relative(path.dirname(path.join(root, file)), ICONS).replace(/\\/g, '/')
  const source = rel.startsWith('.') ? rel : `./${rel}`
  const line = `import { ${[...wanted].sort().join(', ')} } from '${source}'\n`

  let at = -1
  let end = 0
  for (const m of text.matchAll(IMPORT_ANY)) {
    end = m.index + m[0].length
    if (at < 0 && m[1].startsWith('.') && m[1] > source) at = m.index
  }
  text = at < 0 ? text.slice(0, end) + line + text.slice(end) : text.slice(0, at) + line + text.slice(at)

  writeFileSync(file, text)
  touched += 1
}

console.log(`swapped ${touched} files`)
