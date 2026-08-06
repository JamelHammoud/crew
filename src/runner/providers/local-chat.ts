import { openaiUrl } from '../../shared/modelServers'
import { usageFrom } from './tokens'
import type { LocalRuntime } from './local-serve'
import type { ToolSpec } from './local-tools'
import type { ParsedOutput, ParsedUsage } from './types'

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  thinking?: string
  calls?: ToolCall[]
  callId?: string
  name?: string
  images?: string[]
}

export interface ChatTurn {
  text: string
  thinking: string
  calls: ToolCall[]
  usage: ParsedUsage | null
}

export interface Tuning {
  think?: string
  temperature?: string
  topP?: string
  seed?: string
  maxReply?: string
  keepAlive?: string
}

export interface ChatRequest {
  runtime: LocalRuntime
  model: string
  messages: ChatMessage[]
  tools: ToolSpec[]
  context: number
  lane: number
  signal: AbortSignal
  tuning?: Tuning
}

// A model that cannot think is refused outright when a run asks it to, and the
// refusal is the whole request rather than the field, so the first turn simply
// never happens. Which models those are is learned from the refusal and
// remembered, since nothing on the wire says so beforehand.
const noThinking = new Set<string>()

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// Reasoning is the one field nobody agrees on: Ollama's own chat says thinking,
// and the OpenAI compatible runtimes say reasoning_content or reasoning or
// nothing at all.
const reasoningOf = (part: Record<string, any>): string =>
  str(part.thinking) || str(part.reasoning_content) || str(part.reasoning)

interface Pending {
  id: string
  name: string
  args: string
  whole: Record<string, unknown> | null
}

class Calls {
  private readonly byIndex = new Map<number, Pending>()
  private next = 0

  add(index: number | undefined, raw: any, lane: number): void {
    const at = typeof index === 'number' ? index : this.next++
    const held = this.byIndex.get(at) ?? { id: '', name: '', args: '', whole: null }
    if (str(raw?.id)) held.id = str(raw.id)
    if (str(raw?.function?.name)) held.name = str(raw.function.name)
    const args = raw?.function?.arguments
    if (typeof args === 'string') held.args += args
    else if (args && typeof args === 'object') held.whole = args as Record<string, unknown>
    if (!held.id) held.id = `c${lane}_${at}`
    this.byIndex.set(at, held)
  }

  all(): ToolCall[] {
    return [...this.byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, held]) => ({ id: held.id, name: held.name, args: held.whole ?? parseArgs(held.args) }))
      .filter(call => call.name !== '')
  }
}

// What a conversation is written down as here and what goes over the wire are
// two different things, and the runtime is what decides the second. Ollama's
// own chat takes a call's arguments as the object they are and refuses a string
// outright, where an OpenAI compatible one takes the string its own spec asks
// for, and the tool that answered is read off tool_name there and off name here.
// The same conversation goes to both, so it is shaped once, on the way out.
const wire = (message: ChatMessage, kind: LocalRuntime['kind']): Record<string, unknown> => {
  const ollama = kind === 'ollama'
  const out: Record<string, unknown> = { role: message.role, content: message.content }
  if (message.thinking) out.thinking = message.thinking
  if (message.images?.length) out.images = message.images
  if (message.calls?.length) {
    out.tool_calls = message.calls.map(call => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: ollama ? call.args : JSON.stringify(call.args) }
    }))
  }
  if (message.role === 'tool') {
    if (message.name) out[ollama ? 'tool_name' : 'name'] = message.name
    if (message.callId) out.tool_call_id = message.callId
  }
  return out
}

const num = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const held = Number(value)
  return Number.isFinite(held) ? held : undefined
}

const put = (into: Record<string, unknown>, key: string, value: number | undefined): void => {
  if (value !== undefined) into[key] = value
}

export const thinkAsked = (picked: string | undefined): boolean | string => {
  if (picked === 'off') return false
  if (!picked || picked === 'on') return true
  return picked
}

const effortAsked = (picked: string | undefined): string => {
  if (!picked || picked === 'on') return ''
  return picked === 'off' ? 'none' : picked
}

const body = (req: ChatRequest, think: boolean): string => {
  const messages = req.messages.map(message => wire(message, req.runtime.kind))
  const common = { model: req.model, messages, stream: true }
  const tools = req.tools.length ? { tools: req.tools } : {}
  const tuning = req.tuning ?? {}
  const sampling: Record<string, unknown> = {}
  put(sampling, 'temperature', num(tuning.temperature))
  put(sampling, 'top_p', num(tuning.topP))
  put(sampling, 'seed', num(tuning.seed))
  // A streamed OpenAI compatible answer carries no counts at all unless they
  // are asked for, so a run would say nothing about what it cost.
  if (req.runtime.kind !== 'ollama') {
    const effort = effortAsked(tuning.think)
    const capped: Record<string, unknown> = {}
    put(capped, 'max_tokens', num(tuning.maxReply))
    return JSON.stringify({
      ...common,
      ...tools,
      ...sampling,
      ...capped,
      ...(effort ? { reasoning_effort: effort } : {}),
      stream_options: { include_usage: true }
    })
  }
  const inner: Record<string, unknown> = {}
  if (req.context) inner.num_ctx = req.context
  Object.assign(inner, sampling)
  put(inner, 'num_predict', num(tuning.maxReply))
  const options = Object.keys(inner).length ? { options: inner } : {}
  const alive = tuning.keepAlive ? { keep_alive: tuning.keepAlive } : {}
  return JSON.stringify({
    ...common,
    ...tools,
    ...options,
    ...alive,
    ...(think ? { think: thinkAsked(tuning.think) } : {})
  })
}

const endpoint = (req: ChatRequest): string =>
  req.runtime.kind === 'ollama' ? `${req.runtime.url}/api/chat` : openaiUrl(req.runtime.url, '/chat/completions')

const headers = (req: ChatRequest): Record<string, string> => ({
  'content-type': 'application/json',
  ...(req.runtime.key ? { authorization: `Bearer ${req.runtime.key}` } : {})
})

const refusedThinking = (text: string): boolean => /think/i.test(text)

async function open(req: ChatRequest): Promise<Response> {
  const think = req.runtime.kind === 'ollama' && !noThinking.has(req.model)
  const first = await fetch(endpoint(req), {
    method: 'POST',
    headers: headers(req),
    body: body(req, think),
    signal: req.signal
  })
  if (first.ok || !think) return first
  const said = await first.text().catch(() => '')
  if (!refusedThinking(said)) throw new Error(said.trim() || `The model server answered ${first.status}.`)
  noThinking.add(req.model)
  return fetch(endpoint(req), {
    method: 'POST',
    headers: headers(req),
    body: body(req, false),
    signal: req.signal
  })
}

// One streamed call of the model, turned into the same output every other
// provider here hands back. Ollama writes a JSON object a line and the OpenAI
// compatible ones write server-sent events, so both are read a line at a time.
export async function chat(req: ChatRequest, emit: (out: ParsedOutput) => void): Promise<ChatTurn> {
  const response = await open(req)
  if (!response.ok || !response.body) {
    const said = await response.text().catch(() => '')
    throw new Error(said.trim() || `The model server answered ${response.status}.`)
  }

  const thinkLane = req.lane * 2
  const textLane = req.lane * 2 + 1
  const calls = new Calls()
  let text = ''
  let thinking = ''
  let usage: ParsedUsage | null = null
  let buffer = ''

  const take = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'data: [DONE]') return
    const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
    let frame: Record<string, any>
    try {
      frame = JSON.parse(payload)
    } catch {
      return
    }
    if (typeof frame.error === 'string') throw new Error(frame.error)
    const part: Record<string, any> = frame.message ?? frame.choices?.[0]?.delta ?? frame.choices?.[0]?.message ?? {}
    const thought = reasoningOf(part)
    if (thought) {
      thinking += thought
      emit({ thinkingDelta: { index: thinkLane, text: thought } })
    }
    const said = str(part.content)
    if (said) {
      text += said
      emit({ textDelta: { index: textLane, text: said } })
    }
    if (Array.isArray(part.tool_calls)) {
      for (const call of part.tool_calls) calls.add(call?.index, call, req.lane)
    }
    const counted = usageFrom(frame.usage ?? frame, frame.model ?? req.model)
    if (counted && (counted.input !== undefined || counted.output !== undefined)) usage = counted
  }

  const reader = response.body.getReader()
  const decode = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decode.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) take(line)
    }
    if (buffer.trim()) take(buffer)
  } finally {
    // A turn that was stopped or fell over mid-stream still has to close what
    // it opened, or the thought and the answer stand as running forever.
    emit({ blockStop: { index: thinkLane } })
    emit({ blockStop: { index: textLane } })
  }
  return { text, thinking, calls: calls.all(), usage }
}
