import { normalizeUrl } from './urls'

// A tool is one button in the toolbox: a name, a mark, and the single thing it
// does when it is pressed. The built-in ones are the app's own and are drawn
// where the toolbox is; these are the ones a crew builds for itself, so they
// are shared the way todos are and everyone gets the same toolbox.

export type ToolAction =
  | { kind: 'web'; url: string }
  | { kind: 'terminal'; command?: string }

export const TOOL_MARKS = [
  'globe',
  'terminal',
  'folder',
  'doc',
  'photo',
  'music',
  'star',
  'clock',
  'signal',
  'cloud',
  'search',
  'link',
  'desktop',
  'people'
] as const

export type ToolMark = (typeof TOOL_MARKS)[number]

export const DEFAULT_MARK: ToolMark = 'star'

export interface CrewTool {
  id: string
  name: string
  mark: ToolMark
  action: ToolAction
  createdBy: string
  ts: number
}

export const NAME_LIMIT = 24
export const COMMAND_LIMIT = 500

// What arrives over the wire is whatever the other end sent, so a tool is only
// as good as this. One with no name, or with nothing to do, is not a tool and
// comes back as null rather than as a button that sits there doing nothing.
export function cleanTool(
  name: string,
  mark: string,
  action: ToolAction
): { name: string; mark: ToolMark; action: ToolAction } | null {
  const cleanName = name.trim().slice(0, NAME_LIMIT)
  if (!cleanName) return null
  const cleanMark = (TOOL_MARKS as readonly string[]).includes(mark) ? (mark as ToolMark) : DEFAULT_MARK
  if (action?.kind === 'web') {
    const url = action.url?.trim()
    if (!url) return null
    return { name: cleanName, mark: cleanMark, action: { kind: 'web', url: normalizeUrl(url) } }
  }
  if (action?.kind === 'terminal') {
    const command = action.command?.trim().slice(0, COMMAND_LIMIT)
    return { name: cleanName, mark: cleanMark, action: { kind: 'terminal', command: command || undefined } }
  }
  return null
}
