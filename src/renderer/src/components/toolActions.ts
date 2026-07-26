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
  VideoGlyph
} from './toolGlyphs'

export type ToolIcon = Glyph

export interface ToolAction {
  icon: ToolIcon
  run: string
  done: string
  many?: string
  prose?: boolean
  terminal?: boolean
}

const AGENT: ToolAction = { icon: SparkGlyph, run: 'Asking an agent', done: 'Asked an agent', many: 'Asked agents', prose: true }
const WORKING: ToolAction = { icon: BoxGlyph, run: 'Working', done: 'Working', prose: true }

export const THINKING: ToolAction = { icon: ThinkingGlyph, run: 'Thinking', done: 'Thinking', prose: true }

const TABLE: Array<[string, ToolAction]> = [
  ['read readfile viewfile view cat openfile readmediafile', { icon: ReadGlyph, run: 'Reading', done: 'Read', many: 'Read files' }],
  [
    'edit editfile edits multiedit strreplace strreplacefile strreplaceeditor applypatch patch filechange write writefile createfile create newfile savefile',
    { icon: EditGlyph, run: 'Editing', done: 'Edited', many: 'Edited files' }
  ],
  ['notebookedit notebook', { icon: NotebookGlyph, run: 'Editing a notebook', done: 'Edited a notebook', many: 'Edited notebooks' }],
  [SHELL_TOOLS, { icon: ShellGlyph, run: 'Running', done: 'Ran', many: 'Ran commands', terminal: true }],
  [
    'bashoutput shelloutput processoutput readoutput',
    { icon: OutputGlyph, run: 'Checking output', done: 'Checked output' }
  ],
  ['killbash killshell killprocess stopprocess', { icon: StopGlyph, run: 'Stopping', done: 'Stopped' }],
  [
    'grep search searchcode codesearch ripgrep searchfiles findinfiles',
    { icon: SearchGlyph, run: 'Searching', done: 'Searched', many: 'Searched the code' }
  ],
  ['glob findfiles filesearch find', { icon: FilesGlyph, run: 'Finding files', done: 'Found files' }],
  ['ls list listdir listdirectory listfiles tree', { icon: FolderGlyph, run: 'Listing files', done: 'Listed files' }],
  [
    'websearch searchweb googlesearch',
    { icon: GlobeGlyph, run: 'Searching the web', done: 'Searched the web', prose: true }
  ],
  [
    'webfetch fetchurl fetch openurl browse readurl urlfetch',
    { icon: PageGlyph, run: 'Reading a page', done: 'Read a page', many: 'Read pages' }
  ],
  [
    'searchx xsearch xkeywordsearch xsemanticsearch',
    { icon: PostsGlyph, run: 'Searching X', done: 'Searched X', prose: true }
  ],
  [
    'todowrite todo todolist settodolist writetodos updateplan',
    { icon: ChecklistGlyph, run: 'Planning', done: 'Planned', prose: true }
  ],
  [
    'exitplanmode enterplanmode planmode plan',
    { icon: ClipboardGlyph, run: 'Writing a plan', done: 'Wrote a plan', prose: true }
  ],
  ['task agent subagent delegate dispatchagent launchagent', AGENT],
  [
    'askuserquestion ask question',
    { icon: QuestionGlyph, run: 'Asking', done: 'Asked', prose: true }
  ],
  ['skill slashcommand command', { icon: BoltGlyph, run: 'Running a skill', done: 'Ran a skill', prose: true }],
  [
    'generateimage createimage editimage imagegen',
    { icon: ImageGlyph, run: 'Making an image', done: 'Made an image', prose: true }
  ],
  [
    'generatevideo createvideo videogen',
    { icon: VideoGlyph, run: 'Making a video', done: 'Made a video', prose: true }
  ],
  [
    'memory remember savememory recall selfimprove',
    { icon: BookmarkGlyph, run: 'Saving to memory', done: 'Saved to memory', prose: true }
  ],
  [
    'taskcreate taskupdate tasklist taskget taskoutput taskstop',
    { icon: DoneGlyph, run: 'Updating tasks', done: 'Updated tasks', prose: true }
  ],
  [
    'sendmessage message',
    { icon: PlaneGlyph, run: 'Sending a message', done: 'Sent a message', prose: true }
  ],
  ['pushnotification notify', { icon: BellGlyph, run: 'Sending a notice', done: 'Sent a notice', prose: true }],
  [
    'croncreate crondelete cronlist schedulewakeup schedule',
    { icon: ClockGlyph, run: 'Scheduling', done: 'Scheduled', prose: true }
  ],
  ['monitor watch', { icon: SignalGlyph, run: 'Watching', done: 'Watched', prose: true }],
  ['workflow pipeline', { icon: FlowGlyph, run: 'Running a workflow', done: 'Ran a workflow', prose: true }],
  [
    'enterworktree exitworktree worktree',
    { icon: BranchGlyph, run: 'Setting up a workspace', done: 'Set up a workspace', prose: true }
  ],
  ['lsp diagnostics typecheck', { icon: CodeGlyph, run: 'Checking the code', done: 'Checked the code', prose: true }],
  ['reportfindings findings', { icon: FlagGlyph, run: 'Reporting', done: 'Reported', prose: true }],
  [
    'toolsearch listmcpresources listmcpresourcestool readmcpresource readmcpresourcetool',
    { icon: BoxGlyph, run: 'Finding tools', done: 'Found tools', prose: true }
  ],
  ['mcp mcptool mcptoolcall', { icon: PlugGlyph, run: 'Running a tool', done: 'Ran a tool', prose: true }]
]

const TOOLS = new Map(TABLE.flatMap(([names, action]) => names.split(' ').map(name => [name, action] as const)))

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
  const known = TOOLS.get(normalizeTool(raw))
  if (known) return known
  const mcp = mcpTool(raw)
  if (mcp) {
    const label = humanize(mcp)
    return TOOLS.get(normalizeTool(mcp)) ?? { icon: PlugGlyph, run: label, done: label, prose: true }
  }
  const label = humanize(raw)
  return { icon: BoxGlyph, run: label, done: label, prose: true }
}
