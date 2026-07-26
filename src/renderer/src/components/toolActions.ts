import type { Glyph } from './glyph'
import {
  BellGlyph,
  BoltGlyph,
  BookmarkGlyph,
  BoxGlyph,
  BranchGlyph,
  ChecklistGlyph,
  ClipboardGlyph,
  ClockGlyph,
  CodeGlyph,
  DoneGlyph,
  EditGlyph,
  FilesGlyph,
  FlagGlyph,
  FlowGlyph,
  FolderGlyph,
  GlobeGlyph,
  ImageGlyph,
  NotebookGlyph,
  OutputGlyph,
  PageGlyph,
  PlaneGlyph,
  PlugGlyph,
  PostsGlyph,
  QuestionGlyph,
  ReadGlyph,
  SearchGlyph,
  ShellGlyph,
  SignalGlyph,
  SparkGlyph,
  StopGlyph,
  ThinkingGlyph,
  VideoGlyph,
  WriteGlyph
} from './toolGlyphs'

export type ToolIcon = Glyph

export interface ToolAction {
  icon: ToolIcon
  run: string
  done: string
  prose?: boolean
}

const AGENT: ToolAction = { icon: SparkGlyph, run: 'Asking an agent', done: 'Asked an agent', prose: true }
const WORKING: ToolAction = { icon: BoxGlyph, run: 'Working', done: 'Working', prose: true }

export const THINKING: ToolAction = { icon: ThinkingGlyph, run: 'Thinking', done: 'Thinking', prose: true }

const TABLE: Array<[string, ToolAction]> = [
  ['read readfile viewfile view cat openfile readmediafile', { icon: DocumentTextIcon, run: 'Reading', done: 'Read' }],
  ['write writefile createfile create newfile savefile', { icon: DocumentPlusIcon, run: 'Writing', done: 'Wrote' }],
  [
    'edit editfile edits multiedit strreplace strreplacefile strreplaceeditor applypatch patch filechange',
    { icon: PencilSquareIcon, run: 'Editing', done: 'Edited' }
  ],
  ['notebookedit notebook', { icon: BookOpenIcon, run: 'Editing a notebook', done: 'Edited a notebook' }],
  [
    'bash shell sh commandexecution localshell powershell run runcommand exec execute terminal',
    { icon: CommandLineIcon, run: 'Running', done: 'Ran' }
  ],
  [
    'bashoutput shelloutput processoutput readoutput',
    { icon: EyeIcon, run: 'Checking output', done: 'Checked output' }
  ],
  ['killbash killshell killprocess stopprocess', { icon: StopCircleIcon, run: 'Stopping', done: 'Stopped' }],
  [
    'grep search searchcode codesearch ripgrep searchfiles findinfiles',
    { icon: MagnifyingGlassIcon, run: 'Searching', done: 'Searched' }
  ],
  ['glob findfiles filesearch find', { icon: DocumentMagnifyingGlassIcon, run: 'Finding files', done: 'Found files' }],
  ['ls list listdir listdirectory listfiles tree', { icon: FolderOpenIcon, run: 'Listing files', done: 'Listed files' }],
  [
    'websearch searchweb googlesearch',
    { icon: GlobeAltIcon, run: 'Searching the web', done: 'Searched the web', prose: true }
  ],
  [
    'webfetch fetchurl fetch openurl browse readurl urlfetch',
    { icon: LinkIcon, run: 'Reading a page', done: 'Read a page' }
  ],
  [
    'searchx xsearch xkeywordsearch xsemanticsearch',
    { icon: HashtagIcon, run: 'Searching X', done: 'Searched X', prose: true }
  ],
  [
    'todowrite todo todolist settodolist writetodos updateplan',
    { icon: ListBulletIcon, run: 'Planning', done: 'Planned', prose: true }
  ],
  [
    'exitplanmode enterplanmode planmode plan',
    { icon: ClipboardDocumentListIcon, run: 'Writing a plan', done: 'Wrote a plan', prose: true }
  ],
  ['task agent subagent delegate dispatchagent launchagent', AGENT],
  [
    'askuserquestion ask question',
    { icon: QuestionMarkCircleIcon, run: 'Asking', done: 'Asked', prose: true }
  ],
  ['skill slashcommand command', { icon: BoltIcon, run: 'Running a skill', done: 'Ran a skill', prose: true }],
  [
    'generateimage createimage editimage imagegen',
    { icon: PhotoIcon, run: 'Making an image', done: 'Made an image', prose: true }
  ],
  [
    'generatevideo createvideo videogen',
    { icon: VideoCameraIcon, run: 'Making a video', done: 'Made a video', prose: true }
  ],
  [
    'memory remember savememory recall selfimprove',
    { icon: BookmarkSquareIcon, run: 'Saving to memory', done: 'Saved to memory', prose: true }
  ],
  [
    'taskcreate taskupdate tasklist taskget taskoutput taskstop',
    { icon: CheckCircleIcon, run: 'Updating tasks', done: 'Updated tasks', prose: true }
  ],
  [
    'sendmessage message',
    { icon: PaperAirplaneIcon, run: 'Sending a message', done: 'Sent a message', prose: true }
  ],
  ['pushnotification notify', { icon: BellIcon, run: 'Sending a notice', done: 'Sent a notice', prose: true }],
  [
    'croncreate crondelete cronlist schedulewakeup schedule',
    { icon: ClockIcon, run: 'Scheduling', done: 'Scheduled', prose: true }
  ],
  ['monitor watch', { icon: SignalIcon, run: 'Watching', done: 'Watched', prose: true }],
  ['workflow pipeline', { icon: Squares2X2Icon, run: 'Running a workflow', done: 'Ran a workflow', prose: true }],
  [
    'enterworktree exitworktree worktree',
    { icon: Square3Stack3DIcon, run: 'Setting up a workspace', done: 'Set up a workspace', prose: true }
  ],
  ['lsp diagnostics typecheck', { icon: CodeBracketIcon, run: 'Checking the code', done: 'Checked the code', prose: true }],
  ['reportfindings findings', { icon: FlagIcon, run: 'Reporting', done: 'Reported', prose: true }],
  [
    'toolsearch listmcpresources listmcpresourcestool readmcpresource readmcpresourcetool',
    { icon: WrenchScrewdriverIcon, run: 'Finding tools', done: 'Found tools', prose: true }
  ],
  ['mcp mcptool mcptoolcall', { icon: PuzzlePieceIcon, run: 'Running a tool', done: 'Ran a tool', prose: true }]
]

const TOOLS = new Map(TABLE.flatMap(([names, action]) => names.split(' ').map(name => [name, action] as const)))

const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const humanize = (name: string): string => {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.\-/]+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : words
}

const mcpTool = (name: string): string | undefined => {
  if (!name.includes('__') && !name.includes('.')) return undefined
  const parts = name.split(/__|\./).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : undefined
}

export function toolAction(name: string | undefined, subagent = false): ToolAction {
  if (subagent) return AGENT
  const raw = (name ?? '').trim()
  if (!raw) return WORKING
  const known = TOOLS.get(normalize(raw))
  if (known) return known
  const mcp = mcpTool(raw)
  if (mcp) {
    const label = humanize(mcp)
    return TOOLS.get(normalize(mcp)) ?? { icon: PuzzlePieceIcon, run: label, done: label, prose: true }
  }
  const label = humanize(raw)
  return { icon: WrenchScrewdriverIcon, run: label, done: label, prose: true }
}
