import { activityDetail, fileChanges } from './detail'
import { localBrief } from './local-brief'
import { chat, type ChatMessage, type ToolCall } from './local-chat'
import { LOCAL_TOOLS, runTool } from './local-tools'
import { commandOutput } from './output'
import type { LocalRuntime } from './local-serve'
import type { RunSink } from './run'

// A round is one call of the model. The limit is a backstop against a model
// that calls the same tool forever, not a budget: a real piece of work is a
// handful of rounds and a long one is tens.
const ROUND_LIMIT = 60
const DEFAULT_CONTEXT = 8192
// What the model is left to answer in, once the conversation has been fitted
// into the window.
const REPLY_ROOM = 1024
const PER_TOKEN = 4

export interface LoopOptions {
  runtime: LocalRuntime
  model: string
  context: number
  cwd: string
  prompt: string
  sink: RunSink
}

export interface LocalRun {
  done: Promise<{ text: string }>
  kill: () => void
  say: (text: string) => boolean
}

const weigh = (message: ChatMessage): number =>
  Math.ceil((message.content.length + JSON.stringify(message.calls ?? '').length) / PER_TOKEN)

// A run that quietly forgets what it was asked reads as a bad model and is
// usually a full window. The brief and the first thing the person said are
// what the run is for, so they stay; what goes is the oldest work, and it goes
// in whole rounds, since a tool result with no call in front of it is a
// conversation the server refuses outright.
export function fitWindow(messages: ChatMessage[], context: number): ChatMessage[] {
  const budget = Math.max(1024, (context || DEFAULT_CONTEXT) - REPLY_ROOM)
  const head = messages.slice(0, 2)
  let rest = messages.slice(2)
  const total = () => [...head, ...rest].reduce((sum, message) => sum + weigh(message), 0)
  while (total() > budget && rest.length > 1) {
    let cut = 1
    while (cut < rest.length && rest[cut].role === 'tool') cut++
    rest = rest.slice(cut)
  }
  return [...head, ...rest]
}

const answerOf = (call: ToolCall, output: string): ChatMessage => ({
  role: 'tool',
  name: call.name,
  callId: call.id,
  content: output
})

export function startLoop(opts: LoopOptions): LocalRun {
  const control = new AbortController()
  const waiting: string[] = []
  let stopped = false
  let running = true

  const messages: ChatMessage[] = [
    { role: 'system', content: localBrief(opts.cwd) },
    { role: 'user', content: opts.prompt }
  ]

  const step = async (call: ToolCall): Promise<ChatMessage> => {
    opts.sink.apply({
      activity: {
        id: call.id,
        kind: 'tool',
        name: call.name,
        status: 'started',
        detail: activityDetail(call.args),
        files: fileChanges(call.name, call.args),
        todos: undefined
      }
    })
    const result = await runTool(call.name, call.args, opts.cwd)
    opts.sink.apply({
      activity: {
        id: call.id,
        kind: 'tool',
        name: call.name,
        status: 'finished',
        output: commandOutput(result.output)
      }
    })
    return answerOf(call, result.output || (result.ok ? 'Done.' : 'That tool failed and said nothing.'))
  }

  const work = async (): Promise<{ text: string }> => {
    let said = ''
    for (let round = 0; round < ROUND_LIMIT; round++) {
      if (stopped) throw new Error('Stopped')
      while (waiting.length) messages.push({ role: 'user', content: waiting.shift()! })
      const turn = await chat(
        {
          runtime: opts.runtime,
          model: opts.model,
          messages: fitWindow(messages, opts.context),
          tools: LOCAL_TOOLS,
          context: opts.context,
          lane: round,
          signal: control.signal
        },
        out => opts.sink.apply(out)
      )
      if (turn.usage) opts.sink.apply({ usage: turn.usage })
      opts.sink.report()
      if (turn.text.trim()) said = turn.text.trim()
      if (!turn.calls.length) return { text: said }
      messages.push({
        role: 'assistant',
        content: turn.text,
        tool_calls: turn.calls.map(call => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: JSON.stringify(call.args) }
        }))
      })
      for (const call of turn.calls) {
        if (stopped) throw new Error('Stopped')
        messages.push(await step(call))
      }
      opts.sink.report()
    }
    return { text: said || 'Stopped after too many turns without finishing.' }
  }

  const done = work().finally(() => {
    running = false
    opts.sink.close()
  })

  return {
    done,
    kill: () => {
      stopped = true
      control.abort()
    },
    // A steer is a message put in front of the next call, so it lands in the
    // tens of milliseconds between one round and the next rather than
    // interrupting anything.
    say: (text: string) => {
      if (!running || stopped) return false
      waiting.push(text)
      return true
    }
  }
}
