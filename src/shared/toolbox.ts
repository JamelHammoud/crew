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
  | { kind: 'say'; text: string }
  | { kind: 'todo'; text: string; agentId?: string }
  | { kind: 'note'; page: string; text: string }
  | { kind: 'music'; trackId?: string; playlistId?: string }
  | { kind: 'chain'; toolIds: string[] }

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
  'copy',
  'checklist',
  'archive',
  'photo',
  'film',
  'music',
  'play',
  'speaker',
  'desktop',
  'cloud',
  'signal',
  'chat',
  'people',
  'star',
  'spark',
  'bolt',
  'group',
  'pencil',
  'sun',
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
export const COPY_LIMIT = 2000
export const KEY_LIMIT = 200
export const MARK_LIMIT = 16
export const STEP_LIMIT = 12

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
  if (action?.kind === 'doc') {
    const page = action.page?.trim().slice(0, KEY_LIMIT)
    if (!page) return null
    return built({ kind: 'doc', page })
  }
  if (action?.kind === 'board') {
    const boardId = action.boardId?.trim().slice(0, KEY_LIMIT)
    if (!boardId) return null
    return built({ kind: 'board', boardId })
  }
  if (action?.kind === 'copy') {
    const text = action.text?.slice(0, COPY_LIMIT)
    if (!text?.trim()) return null
    return built({ kind: 'copy', text })
  }
  if (action?.kind === 'prompt') {
    const text = action.text?.trim().slice(0, PROMPT_LIMIT)
    if (!text) return null
    const ask = { kind: 'prompt' as const, text }
    return built(action.agentId ? { ...ask, agentId: action.agentId } : ask)
  }
  if (action?.kind === 'say') {
    const text = action.text?.trim().slice(0, PROMPT_LIMIT)
    if (!text) return null
    return built({ kind: 'say', text })
  }
  if (action?.kind === 'todo') {
    const text = action.text?.trim().slice(0, PROMPT_LIMIT)
    if (!text) return null
    const task = { kind: 'todo' as const, text }
    return built(action.agentId ? { ...task, agentId: action.agentId } : task)
  }
  if (action?.kind === 'note') {
    const page = action.page?.trim().slice(0, KEY_LIMIT)
    const text = action.text?.trim().slice(0, PROMPT_LIMIT)
    if (!page || !text) return null
    return built({ kind: 'note', page, text })
  }
  if (action?.kind === 'music') {
    const trackId = action.trackId?.trim().slice(0, KEY_LIMIT)
    const playlistId = action.playlistId?.trim().slice(0, KEY_LIMIT)
    if (!trackId && !playlistId) return null
    return built({
      kind: 'music',
      ...(trackId ? { trackId } : {}),
      ...(playlistId ? { playlistId } : {})
    })
  }
  if (action?.kind === 'chain') {
    const ids = Array.isArray(action.toolIds) ? action.toolIds : []
    const toolIds = [...new Set(ids.filter(id => typeof id === 'string' && id.trim() !== ''))].slice(0, STEP_LIMIT)
    if (toolIds.length === 0) return null
    return built({ kind: 'chain', toolIds })
  }
  return null
}

// A word in braces is a blank the tool asks for when it is pressed, so one tool
// covers every search, every branch and every ticket rather than one for each.
// A brace with a dollar in front of it is a shell variable and is left alone.
const SLOT = /(?<!\$)\{([a-zA-Z0-9][\w -]{0,23})\}/g

const overWords = (action: ToolAction, over: (text: string) => string): ToolAction => {
  if (action.kind === 'web') return { ...action, url: over(action.url) }
  if (action.kind === 'terminal') return action.command ? { ...action, command: over(action.command) } : action
  if (action.kind === 'file') return { ...action, path: over(action.path) }
  if (
    action.kind === 'prompt' ||
    action.kind === 'copy' ||
    action.kind === 'say' ||
    action.kind === 'todo' ||
    action.kind === 'note'
  )
    return { ...action, text: over(action.text) }
  return action
}

export function slotsIn(action: ToolAction): string[] {
  const asked: string[] = []
  overWords(action, text => {
    for (const [, slot] of text.matchAll(SLOT)) if (!asked.includes(slot)) asked.push(slot)
    return text
  })
  return asked
}

// What is typed goes into an address as a query rather than as it stands, so a
// blank filled with several words is still one link.
export function fillSlots(action: ToolAction, answers: Record<string, string>): ToolAction {
  const held = action.kind === 'web' ? encodeURIComponent : (answer: string) => answer
  return overWords(action, text =>
    text.replace(SLOT, (whole, slot: string) => (answers[slot] === undefined ? whole : held(answers[slot])))
  )
}
