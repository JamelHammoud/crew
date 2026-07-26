import { normalizeUrl } from './urls'

// A tool is one button in the toolbox: a name, a mark, and the single thing it
// does when it is pressed. The built-in ones are the app's own and are drawn
// where the toolbox is; these are the ones a crew builds for itself, so they
// are shared the way todos are and everyone gets the same toolbox.

export type ToolAction =
  | { kind: 'web'; url: string; external?: boolean }
  | { kind: 'terminal'; command?: string }
  | { kind: 'file'; path: string }
  | { kind: 'doc'; page: string }
  | { kind: 'board'; boardId: string }
  | { kind: 'prompt'; text: string; agentId?: string }
  | { kind: 'copy'; text: string }

export const TOOL_MARKS = [
  'globe',
  'window',
  'link',
  'search',
  'terminal',
  'prompt',
  'folder',
  'file',
  'doc',
  'clipboard',
  'checklist',
  'archive',
  'photo',
  'film',
  'music',
  'speaker',
  'desktop',
  'cloud',
  'signal',
  'chat',
  'people',
  'star',
  'clock',
  'eye'
] as const

export type ToolMark = (typeof TOOL_MARKS)[number]

export const DEFAULT_MARK: ToolMark = 'star'

export interface CrewTool {
  id: string
  name: string
  mark: string
  action: ToolAction
  createdBy: string
  ts: number
}

export const NAME_LIMIT = 24
export const COMMAND_LIMIT = 500
export const PATH_LIMIT = 500
export const PROMPT_LIMIT = 2000
export const MARK_LIMIT = 16

// One emoji, however many code points it takes to say it: a face is one, a face
// with a skin tone is three, and a flag or a family is a run of them joined up.
// A keycap starts on a digit, so it is asked for on its own.
const EMOJI = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\u200d\ufe0f\u{1f3fb}-\u{1f3ff}]*$/u
const KEYCAP = /^[0-9#*]\ufe0f?\u{20e3}$/u

// A mark is one of the app's own or one emoji. A name from a newer build, or a
// line of text where a mark goes, comes back as the default rather than as a
// tile with nothing on it.
export function cleanMark(mark: string): string {
  if ((TOOL_MARKS as readonly string[]).includes(mark)) return mark
  if (typeof mark !== 'string' || mark.length > MARK_LIMIT) return DEFAULT_MARK
  return EMOJI.test(mark) || KEYCAP.test(mark) ? mark : DEFAULT_MARK
}

// What arrives over the wire is whatever the other end sent, so a tool is only
// as good as this. One with no name, or with nothing to do, is not a tool and
// comes back as null rather than as a button that sits there doing nothing.
export function cleanTool(
  name: string,
  mark: string,
  action: ToolAction
): { name: string; mark: string; action: ToolAction } | null {
  const cleanName = name.trim().slice(0, NAME_LIMIT)
  if (!cleanName) return null
  const built = (clean: ToolAction) => ({ name: cleanName, mark: cleanMark(mark), action: clean })
  if (action?.kind === 'web') {
    const url = action.url?.trim()
    if (!url) return null
    const open = { kind: 'web' as const, url: normalizeUrl(url) }
    return built(action.external ? { ...open, external: true } : open)
  }
  if (action?.kind === 'terminal') {
    const command = action.command?.trim().slice(0, COMMAND_LIMIT)
    return built({ kind: 'terminal', command: command || undefined })
  }
  if (action?.kind === 'file') {
    const path = action.path?.trim().slice(0, PATH_LIMIT)
    if (!path) return null
    return built({ kind: 'file', path })
  }
  if (action?.kind === 'prompt') {
    const text = action.text?.trim().slice(0, PROMPT_LIMIT)
    if (!text) return null
    const ask = { kind: 'prompt' as const, text }
    return built(action.agentId ? { ...ask, agentId: action.agentId } : ask)
  }
  return null
}
