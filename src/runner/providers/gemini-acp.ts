import type { FileChange } from '../../shared/llm'
import { acpDialog, CANCELLED, chunkText, makeLanes, str } from './acp'
import type { SettingReader } from './cli'
import { fileChanges } from './detail'
import type { Dialog, ParsedOutput, RunOptions, RunParser } from './types'

const STARTED = new Set(['pending', 'in_progress'])

const STOPS: Record<string, string> = {
  max_tokens: 'Gemini reached its token limit before it finished.',
  max_turn_requests: 'Gemini reached its limit of steps before it finished.'
}

const TOOLS: Record<string, string> = {
  read: 'Read',
  edit: 'Edit',
  execute: 'Bash',
  search: 'Grep',
  fetch: 'WebFetch',
  think: 'Task',
  delete: 'Delete',
  move: 'Move'
}

const SUBAGENT_KINDS = new Set(['think'])

export function geminiDialog(prompt: string, cwd: string, _get: SettingReader, options: RunOptions = {}): Dialog {
  return acpDialog({ prompt, cwd, run: options })
}

const partsOf = (update: any): any[] => (Array.isArray(update?.content) ? update.content : [])

const outputText = (update: any): string =>
  partsOf(update)
    .map(part => chunkText(part?.content))
    .filter(Boolean)
    .join('\n')

const diffFiles = (update: any): FileChange[] | undefined => {
  const out: FileChange[] = []
  for (const part of partsOf(update)) {
    if (str(part?.type) !== 'diff') continue
    const changed = fileChanges('Edit', part)
    if (changed) out.push(...changed)
  }
  return out.length > 0 ? out : undefined
}

const located = (update: any): string => {
  const list = Array.isArray(update?.locations) ? update.locations : []
  const first = list.find((entry: any) => str(entry?.path))
  return str(first?.path)
}

export function geminiParser(): RunParser {
  const { close, stream } = makeLanes()
  const kinds = new Map<string, string>()
  const titles = new Map<string, string>()

  const activity = (out: ParsedOutput[], update: any): void => {
    const id = str(update?.toolCallId)
    if (!id) return
    const opening = str(update?.sessionUpdate) === 'tool_call'
    if (opening) {
      kinds.set(id, str(update?.kind))
      titles.set(id, str(update?.title))
    }
    const kind = kinds.get(id) ?? str(update?.kind)
    const title = str(update?.title) || titles.get(id) || ''
    const running = STARTED.has(str(update?.status))
    const files = running ? undefined : diffFiles(update)
    if (!opening && running) return
    close(out)
    out.push({
      activity: {
        id,
        kind: SUBAGENT_KINDS.has(kind) ? 'subagent' : 'tool',
        name: TOOLS[kind] ?? kind,
        status: running ? 'started' : 'finished',
        detail: title || located(update) || undefined,
        files,
        output: running ? undefined : outputText(update)
      }
    })
  }

  const update = (out: ParsedOutput[], params: any): void => {
    const body = params?.update ?? params
    const kind = str(body?.sessionUpdate)
    if (kind === 'agent_thought_chunk') return stream(out, 'thinking', chunkText(body?.content))
    if (kind === 'agent_message_chunk') return stream(out, 'text', chunkText(body?.content))
    if (kind === 'tool_call' || kind === 'tool_call_update') return activity(out, body)
  }

  const parse = (line: string): ParsedOutput[] => {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return []
    }
    const out: ParsedOutput[] = []
    if (str(msg?.method) === 'session/update') {
      update(out, msg.params)
      return out
    }
    if (msg?.error && msg.id !== undefined) {
      close(out)
      const text = str(msg.error?.message)
      if (text) out.push({ error: text })
      out.push({ turnEnd: true })
      return out
    }
    const stop = str(msg?.result?.stopReason)
    if (stop) {
      close(out)
      if (STOPS[stop]) out.push({ error: STOPS[stop] })
      if (stop !== CANCELLED) out.push({ turnEnd: true })
    }
    return out
  }

  return { parse }
}
