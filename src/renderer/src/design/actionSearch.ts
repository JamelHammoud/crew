import type { Editor } from 'tldraw'
import type { Glyph } from '../components/glyph'
import { availableCommands, type CommandContext } from './commands'
import { activateTool, ALL_TOOLS } from './tools'

export interface ActionRow {
  id: string
  label: string
  hint?: string
  section: string
  Icon: Glyph
  terms: string
  run: () => void
}

const SUGGESTED = ['ask', 'frame', 'group', 'auto-layout', 'mask', 'zoom-fit', 'select-all']

function toolRows(editor: Editor): ActionRow[] {
  return ALL_TOOLS.map(tool => ({
    id: `tool:${tool.id}`,
    label: tool.label,
    hint: tool.shortcut,
    section: 'Tools',
    Icon: tool.Icon,
    terms: `${tool.label} tool`,
    run: () => activateTool(editor, tool.id)
  }))
}

export function actionRows(ctx: CommandContext): ActionRow[] {
  const commands = availableCommands(ctx).map(command => ({
    id: command.id,
    label: command.label,
    hint: command.hint,
    section: 'Actions',
    Icon: command.Icon,
    terms: `${command.label} ${command.terms ?? ''}`,
    run: () => command.run(ctx)
  }))
  return [...commands, ...toolRows(ctx.editor)]
}

function score(row: ActionRow, query: string): number {
  const label = row.label.toLowerCase()
  if (label === query) return 0
  if (label.startsWith(query)) return 1
  const word = label.split(' ').some(part => part.startsWith(query))
  if (word) return 2
  if (label.includes(query)) return 3
  return row.terms.toLowerCase().includes(query) ? 4 : -1
}

export function searchActions(rows: ActionRow[], query: string): { section: string; rows: ActionRow[] }[] {
  const clean = query.trim().toLowerCase()
  if (!clean) {
    const suggested = SUGGESTED.flatMap(id => rows.filter(row => row.id === id))
    const picked = new Set(suggested.map(row => row.id))
    const rest = rows.filter(row => !picked.has(row.id))
    return sections([
      ...(suggested.length > 0 ? [{ section: 'Suggestions', rows: suggested }] : []),
      ...group(rest)
    ])
  }
  const hits = rows
    .map(row => ({ row, rank: score(row, clean) }))
    .filter(hit => hit.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map(hit => hit.row)
  return sections(group(hits))
}

function group(rows: ActionRow[]): { section: string; rows: ActionRow[] }[] {
  const order: string[] = []
  const held = new Map<string, ActionRow[]>()
  for (const row of rows) {
    if (!held.has(row.section)) {
      held.set(row.section, [])
      order.push(row.section)
    }
    held.get(row.section)!.push(row)
  }
  return order.map(section => ({ section, rows: held.get(section)! }))
}

function sections(list: { section: string; rows: ActionRow[] }[]): { section: string; rows: ActionRow[] }[] {
  return list.filter(part => part.rows.length > 0)
}
