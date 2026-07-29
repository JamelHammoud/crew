import type { ParsedUsage } from './types'

// Every CLI names the same four numbers differently, and they disagree about
// one of them: the part of the input that came off a cache is counted beside
// the input by Anthropic and inside it by OpenAI. Read the wrong way round, a
// long cached prefix is charged twice at full rate, so which shape a message is
// in has to be decided rather than guessed.

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function usageFrom(usage: unknown, model?: unknown): ParsedUsage | null {
  if (!usage || typeof usage !== 'object') return null
  const raw = usage as Record<string, any>
  const name = typeof model === 'string' && model.trim() ? model : undefined
  const output = count(raw.output_tokens) ?? count(raw.completion_tokens)

  const read = count(raw.cache_read_input_tokens)
  const written = count(raw.cache_creation_input_tokens)
  if (read !== undefined || written !== undefined) {
    return { model: name, input: count(raw.input_tokens), output, cacheRead: read, cacheWrite: written }
  }

  const input = count(raw.input_tokens) ?? count(raw.prompt_tokens)
  const cached = count(raw.cached_input_tokens) ?? count(raw.prompt_tokens_details?.cached_tokens)
  if (cached !== undefined && input !== undefined) {
    return { model: name, input: Math.max(0, input - cached), output, cacheRead: cached }
  }
  if (input === undefined && output === undefined) return null
  return { model: name, input, output }
}
