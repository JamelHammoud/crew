import { stripRoot, stripRootFromText } from '../../shared/files'
import { isShellTool } from '../../shared/tools'
import { addUsage, priceOf, NO_USAGE, type TokenUsage } from '../../shared/pricing'
import { taskLedger } from './tasks'
import type { ParsedOutput, ParsedUsage, RunHooks } from './types'

// What turns a run's output into steps: block ids, the thinking rail, the
// task ledger, the shell-output rule, and what a turn cost. None of it is
// about a child process, which is why it stands apart from the transport that
// spawns one. A provider that owns its own loop reads the same sink rather
// than writing a second copy of all of this.
export interface RunSink {
  apply(out: ParsedOutput): void
  // The no-parser path: a CLI whose output is only ever text.
  raw(chunk: string): void
  report(): void
  close(): void
  answer(): string
}

export function makeSink(cwd: string, hooks: RunHooks): RunSink {
  let text = ''
  let aside = ''
  let blocks = 0
  let written = 0
  let rawOpen = false
  // What the calls of the model have come to so far, and, once the run says
  // so, what the whole turn came to. The second stands in place of the first
  // rather than beside it, or every token is counted twice.
  let spent: TokenUsage = NO_USAGE
  let whole: ParsedUsage | null = null
  let model = ''
  let sent = 0
  let priced: number | null = null
  const streams = {
    thinking: { ids: new Map<number, string>(), open: new Set<string>(), streamed: false },
    text: { ids: new Map<number, string>(), open: new Set<string>(), streamed: false }
  }
  const asides = new Set<string>()
  const toolNames = new Map<string, string>()
  const tasks = taskLedger()

  const report = () => {
    if (!hooks.onTokens) return
    const counted = whole ? addUsage(NO_USAGE, whole) : spent
    // A CLI that says nothing about tokens still has words on screen, and
    // four characters to the token is close enough to say something is
    // happening rather than nothing.
    const tokens = Math.max(counted.output, Math.ceil(written / 4))
    const cost = whole?.cost ?? (model ? priceOf(model, counted) : null)
    if (tokens === sent && cost === priced) return
    sent = tokens
    priced = cost
    hooks.onTokens(tokens, cost)
  }

  const openBlock = (kind: 'thinking' | 'text', index: number, apart = false) => {
    const id = `b${blocks++}`
    streams[kind].ids.set(index, id)
    if (apart) asides.add(id)
  }

  const rail = (kind: 'thinking' | 'text', id: string) => (kind === 'text' && asides.has(id) ? 'thinking' : kind)

  const streamBlock = (kind: 'thinking' | 'text', index: number, chunk: string) => {
    const stream = streams[kind]
    let id = stream.ids.get(index)
    if (!id) {
      id = `b${blocks++}`
      stream.ids.set(index, id)
    }
    if (kind === 'text' && asides.has(id)) aside += (aside && !stream.open.has(id) ? '\n' : '') + chunk
    else if (kind === 'text') text += (text && !stream.open.has(id) ? '\n' : '') + chunk
    stream.streamed = true
    stream.open.add(id)
    written += chunk.length
    hooks.onStep({ id, kind: rail(kind, id), text: chunk, status: 'running' })
  }

  const closeBlock = (index: number) => {
    for (const kind of ['thinking', 'text'] as const) {
      const stream = streams[kind]
      const id = stream.ids.get(index)
      if (!id) continue
      stream.ids.delete(index)
      if (stream.open.delete(id)) hooks.onStep({ id, kind: rail(kind, id), status: 'done' })
    }
  }

  const apply = (out: ParsedOutput) => {
    if (out.thinkingStart) openBlock('thinking', out.thinkingStart.index)
    if (out.textStart) openBlock('text', out.textStart.index, out.textStart.aside)
    // A model that is asked not to show its reasoning still sends the blocks,
    // with an empty string where the words would be. Those are not steps: a
    // run that thinks in silence should look like it is working, not open an
    // empty card. Waiting for text is also what leaves the complete block at
    // the end of the message free to stand in, on a CLI that only ever sends
    // it that way.
    if (out.thinkingDelta?.text) streamBlock('thinking', out.thinkingDelta.index, out.thinkingDelta.text)
    if (out.textDelta?.text) streamBlock('text', out.textDelta.index, out.textDelta.text)
    if (out.blockStop) closeBlock(out.blockStop.index)
    if (out.thinking && !streams.thinking.streamed) {
      written += out.thinking.length
      hooks.onStep({ id: `b${blocks++}`, kind: 'thinking', text: out.thinking, status: 'done' })
    }
    if (out.text && !streams.text.streamed) {
      text += (text ? '\n' : '') + out.text
      written += out.text.length
      hooks.onStep({ id: `b${blocks++}`, kind: 'text', text: out.text, status: 'done' })
    }
    if (out.activity) {
      // Most tools hand back their whole result, and a file read or a search
      // would fill the log the whole crew syncs. Only a command keeps what it
      // printed, and the name it started under is what says so, since the
      // result arrives unnamed.
      const name = out.activity.name || toolNames.get(out.activity.id) || ''
      if (out.activity.name) toolNames.set(out.activity.id, out.activity.name)
      const output = isShellTool(name) ? out.activity.output : undefined
      // A CLI with no whole-list tool says one task per call, so the list such
      // a step carries is the run's own, folded as those land. The id of a new
      // one is only ever in the result, which is read here rather than kept,
      // since a result is not a step's to hold.
      const todos = out.activity.todos ?? tasks.todos(name, out.activity)
      hooks.onStep({
        id: `t${out.activity.id}`,
        kind: out.activity.kind,
        name: out.activity.name,
        detail: out.activity.detail ? stripRootFromText(cwd, out.activity.detail) : undefined,
        output: output ? stripRootFromText(cwd, output) : undefined,
        files: out.activity.files?.map(file => ({ ...file, path: stripRoot(cwd, file.path) })),
        todos,
        status: out.activity.status === 'started' ? 'running' : 'done'
      })
    }
    if (out.usage) {
      if (out.usage.model) model = out.usage.model
      if (out.usage.total) whole = out.usage
      else spent = addUsage(spent, out.usage)
    }
  }

  const raw = (chunk: string) => {
    text += chunk
    written += chunk.length
    rawOpen = true
    hooks.onStep({ id: 'b0', kind: 'text', text: chunk, status: 'running' })
  }

  const close = () => {
    if (rawOpen) hooks.onStep({ id: 'b0', kind: 'text', status: 'done' })
    rawOpen = false
  }

  return { apply, raw, report, close, answer: () => text.trim() || aside.trim() }
}
