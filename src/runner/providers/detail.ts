import type { FileChange, StepTodo } from '../../shared/llm'

// A command speaks for itself, and the card under it is a terminal, so what was
// run beats the summary the model wrote of it. Everything else falls back to
// the description, which is all some tools give.
const DETAIL_KEYS = ['command', 'description', 'query', 'pattern', 'url', 'file_path', 'path', 'prompt']

const todoDetail = (todos: unknown): string | undefined => {
  if (!Array.isArray(todos)) return undefined
  const entries = todos.filter((todo): todo is Record<string, unknown> => Boolean(todo) && typeof todo === 'object')
  const current = entries.find(todo => todo['status'] === 'in_progress') ?? entries[0]
  const text = current?.['activeForm'] ?? current?.['content'] ?? current?.['title']
  return typeof text === 'string' && text.trim() ? truncate(text) : undefined
}

export function activityDetail(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  for (const key of DETAIL_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return truncate(value)
  }
  return todoDetail(record['todos'] ?? record['plan'] ?? record['items']) ?? truncate(JSON.stringify(record))
}

function truncate(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 4000 ? trimmed.slice(0, 4000) + '…' : trimmed
}

const DIFF_LIMIT = 20000

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const lineCount = (text: string): number => (text ? text.split('\n').length : 0)

const diffOf = (removed: string, added: string): string => {
  const lines = [
    ...(removed ? removed.split('\n').map(line => `- ${line}`) : []),
    ...(added ? added.split('\n').map(line => `+ ${line}`) : [])
  ]
  const joined = lines.join('\n')
  return joined.length > DIFF_LIMIT ? joined.slice(0, DIFF_LIMIT) + '…' : joined
}

const editStrings = (record: Record<string, unknown>): { removed: string; added: string } => ({
  removed: str(record['old_string']) || str(record['old_str']) || str(record['old_text']),
  added: str(record['new_string']) || str(record['new_str']) || str(record['new_text'])
})

export function fileChanges(tool: string, input: unknown): FileChange[] | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  const path = str(record['file_path']) || str(record['path'])
  if (!path) return undefined
  const { removed, added } = editStrings(record)
  if (removed || added) {
    return [{ path, added: lineCount(added), removed: lineCount(removed), diff: diffOf(removed, added) }]
  }
  if (Array.isArray(record['edits'])) {
    let addedTotal = 0
    let removedTotal = 0
    const parts: string[] = []
    for (const edit of record['edits']) {
      if (!edit || typeof edit !== 'object') continue
      const strings = editStrings(edit as Record<string, unknown>)
      if (!strings.removed && !strings.added) continue
      addedTotal += lineCount(strings.added)
      removedTotal += lineCount(strings.removed)
      parts.push(diffOf(strings.removed, strings.added))
    }
    if (!parts.length) return undefined
    return [{ path, added: addedTotal, removed: removedTotal, diff: parts.join('\n') }]
  }
  const content = str(record['content']) || str(record['file_text'])
  if (content && /write|create/i.test(tool)) {
    return [{ path, added: lineCount(content), removed: 0, diff: diffOf('', content) }]
  }
  return undefined
}
