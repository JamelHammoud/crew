import type { FileChange } from '../../shared/llm'
import { acpDialog, CANCELLED, chunkText, makeLanes, str } from './acp'
import type { SettingReader } from './cli'
import { fileChanges } from './detail'
import type { Dialog, ParsedOutput, RunOptions, RunParser } from './types'

const STARTED = new Set(['pending', 'in_progress'])

// A stop that is not the end of a turn has a reason, and these are the ones the
// protocol names rather than describes.
const STOPS: Record<string, string> = {
  max_tokens: 'Gemini reached its token limit before it finished.',
  max_turn_requests: 'Gemini reached its limit of steps before it finished.'
}

// What a tool is comes off the kind rather than off the title, and the kinds are
// already Crew's own words. The title is a narrated description, "notes.txt" or
// the command itself, so read as a name it would be a different tool on every
// call and none of them in the table. Read as a kind, `execute` is a shell tool
// and gets its terminal card, `read` keeps a file out of the log the crew syncs,
// and every mark and phrase is the row a Claude run already draws.
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

// What a run is set to is a flag here rather than something said over the wire,
// so the walk goes straight from the session to the turn with no settings in
// between. Approval is `--yolo` for the same reason.
export function geminiDialog(prompt: string, cwd: string, _get: SettingReader, options: RunOptions = {}): Dialog {
  return acpDialog({ prompt, cwd, run: options })
}

const partsOf = (update: any): any[] => (Array.isArray(update?.content) ? update.content : [])

const outputText = (update: any): string =>
  partsOf(update)
    .map(part => chunkText(part?.content))
    .filter(Boolean)
    .join('\n')

// The diff is the tool's own before and after rather than the arguments it was
// called with, because nothing here carries arguments at all. That is the better
// half of the trade: what comes over is what really landed on the file.
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
    // One tool beats out a run of updates saying the same thing, and a step
    // redrawn from one of those is a step whose detail blinks out. Only what
    // opens a step or ends it is worth drawing again.
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
    // A machine that has never signed in is refused at `session/new` rather than
    // part way through a turn, so the run ends there and says why. No turn is
    // coming to end it, and silence is ten minutes of an agent saying nothing.
    if (msg?.error && msg.id !== undefined) {
      close(out)
      const text = str(msg.error?.message)
      if (text) out.push({ error: text })
      out.push({ turnEnd: true })
      return out
    }
    // Only the prompt answers with a stop reason, so it needs no id to be told
    // apart.
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
