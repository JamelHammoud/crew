// What a run is worth billed by the token. Agents here run on somebody's own
// CLI, usually on a plan that already covers the work, so this is the price of
// the tokens rather than a bill anyone is getting.
//
// A model with no rate comes back as null and nothing is shown. A wrong number
// costs more than a missing one, so nothing is ever guessed at: adding a model
// is one row here and nowhere else.

export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export const NO_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export function addUsage(a: TokenUsage, b: Partial<TokenUsage>): TokenUsage {
  return {
    input: a.input + (b.input ?? 0),
    output: a.output + (b.output ?? 0),
    cacheRead: a.cacheRead + (b.cacheRead ?? 0),
    cacheWrite: a.cacheWrite + (b.cacheWrite ?? 0)
  }
}

// Reading a prefix that is already cached is a tenth of the input rate and
// writing one is a quarter more, so a row only has to carry the two rates a
// model is sold at.
const CACHE_READ = 0.1
const CACHE_WRITE = 1.25

// Dollars per million tokens, in and out.
export const MODEL_RATES: Record<string, [number, number]> = {
  'claude-fable-5': [10, 50],
  'claude-mythos-5': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-opus-4-5': [5, 25],
  'claude-opus-4-1': [15, 75],
  'claude-opus-4': [15, 75],
  'claude-sonnet-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5': [3, 15],
  'claude-sonnet-4': [3, 15],
  'claude-haiku-4-5': [1, 5]
}

// A CLI names the model it really used, dated build and all, so a row is a
// prefix and the longest one wins: `claude-opus-4-5-20251101` is priced by
// `claude-opus-4-5` rather than by `claude-opus-4`.
const KEYS = Object.keys(RATES).sort((a, b) => b.length - a.length)

export function rateOf(model: string): [number, number] | null {
  const key = KEYS.find(name => model.startsWith(name))
  return key ? RATES[key] : null
}

export function priceOf(model: string, usage: TokenUsage): number | null {
  const rate = rateOf(model.trim())
  if (!rate) return null
  const [input, output] = rate
  const dollars =
    usage.input * input +
    usage.output * output +
    usage.cacheRead * input * CACHE_READ +
    usage.cacheWrite * input * CACHE_WRITE
  return dollars / 1_000_000
}
