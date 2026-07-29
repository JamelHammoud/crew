export interface ScribeChunk {
  text: string
  start: number
  end: number
}

export interface TidyRules {
  fillers: boolean
  stutters: boolean
  corrections: boolean
  marks: boolean
  words: Array<{ from: string; to: string }>
}

export const TIDY_RULES: TidyRules = {
  fillers: true,
  stutters: true,
  corrections: true,
  marks: true,
  words: []
}

const SENTENCE_GAP = 0.7
const CLAUSE_GAP = 0.35
const CLAUSE_WORDS = 3
const LONG_RUN = 30
const FALSE_START = 4

const SOUNDS = new Set([
  'um',
  'umm',
  'ummm',
  'uhm',
  'uh',
  'uhh',
  'uhhh',
  'er',
  'err',
  'erm',
  'ah',
  'ahh',
  'mm',
  'mmm',
  'hmm',
  'hmmm',
  'huh'
])

const ASIDES = [
  ['you', 'know'],
  ['i', 'mean'],
  ['sort', 'of'],
  ['kind', 'of'],
  ['like'],
  ['basically'],
  ['literally'],
  ['right']
]

const SENTENCE_CUTS = [
  'scratch that',
  'strike that',
  'delete that',
  'forget that',
  'no wait',
  'wait no',
  'actually no',
  'sorry no',
  'i mean no'
]

const WHOLE_CUTS = [
  'scratch all that',
  'scratch everything',
  'strike all that',
  'delete all that',
  'delete everything',
  'forget all that',
  'forget everything',
  'start over'
]

const CUTS = [
  ...WHOLE_CUTS.map(cut => ({ phrase: cut.split(' '), whole: true })),
  ...SENTENCE_CUTS.map(cut => ({ phrase: cut.split(' '), whole: false }))
].sort((a, b) => b.phrase.length - a.phrase.length)

const KEPT_DOUBLE = new Set(['very', 'really', 'so', 'no', 'yes', 'yeah', 'had', 'that'])

const SELF = new Set(['i', "i'm", "i'll", "i've", "i'd"])

const LEAD = /^[^\p{L}\p{N}']*/u
const TAIL = /[^\p{L}\p{N}]*$/u

interface Word {
  lead: string
  text: string
  mark: string
  gap: number
}

const weight = (mark: string): number => (/[.!?]/.test(mark) ? 3 : /[,;:]/.test(mark) ? 2 : mark ? 1 : 0)

const stronger = (mark: string, other: string): string => (weight(other) > weight(mark) ? other : mark)

const ends = (word: Word): boolean => /[.!?]/.test(word.mark)

const capital = (text: string): boolean => text.charAt(0) !== text.charAt(0).toLowerCase()

const key = (word: Word): string => word.text.toLowerCase()

const at = (value: number): number | null => (Number.isFinite(value) ? value : null)

const push = (words: Word[], raw: string, gap: number): void => {
  const lead = raw.match(LEAD)?.[0] ?? ''
  const rest = raw.slice(lead.length)
  const mark = rest.match(TAIL)?.[0] ?? ''
  const text = rest.slice(0, rest.length - mark.length)
  const back = words[words.length - 1]
  if (!text) {
    if (back) back.mark = stronger(back.mark, lead + mark)
    return
  }
  if (back && !lead && back.mark === '' && text.startsWith("'")) {
    back.text += text
    back.mark = mark
    return
  }
  words.push({ lead, text, mark, gap })
}

// The silence between one chunk and the next is half of what this pass has to
// go on, so a chunk with nothing usable on its clock leaves the gap at nothing
// rather than inventing one out of a missing number.
const readWords = (chunks: readonly ScribeChunk[]): Word[] => {
  const words: Word[] = []
  let heard: number | null = null
  for (const chunk of chunks) {
    const start = at(chunk?.start)
    const end = at(chunk?.end)
    const gap = heard !== null && start !== null ? Math.max(0, start - heard) : 0
    let first = true
    for (const raw of (chunk?.text ?? '').split(/\s+/)) {
      if (!raw) continue
      push(words, raw, first ? gap : 0)
      first = false
    }
    const last = start !== null && end !== null ? Math.max(start, end) : (end ?? start)
    if (last !== null) heard = last
  }
  return words
}

const matches = (words: Word[], from: number, phrase: string[]): boolean => {
  if (from + phrase.length > words.length) return false
  for (let step = 0; step < phrase.length; step++) {
    const word = words[from + step]
    if (key(word) !== phrase[step]) return false
    if (step < phrase.length - 1 && ends(word)) return false
  }
  return true
}

const opens = (words: Word[], from: number): boolean =>
  from === 0 || words[from - 1].mark !== '' || words[from].gap >= CLAUSE_GAP

const closes = (words: Word[], to: number): boolean =>
  to >= words.length || words[to - 1].mark !== '' || words[to].gap >= CLAUSE_GAP

const corrected = (words: Word[]): Word[] => {
  const out: Word[] = []
  let sentence = 0
  for (let index = 0; index < words.length; ) {
    const cut = opens(words, index) ? CUTS.find(entry => matches(words, index, entry.phrase)) : undefined
    if (!cut) {
      const word = words[index]
      out.push(word)
      if (ends(word) || (words[index + 1]?.gap ?? 0) >= SENTENCE_GAP) sentence = out.length
      index += 1
      continue
    }
    const from = cut.whole ? 0 : sentence
    const gap = out[from]?.gap ?? words[index].gap
    out.length = from
    sentence = from
    const next = words[index + cut.phrase.length]
    if (next) next.gap = Math.max(next.gap, gap)
    index += cut.phrase.length
  }
  return out
}

const fillerAt = (words: Word[], from: number): number => {
  if (SOUNDS.has(key(words[from]))) return 1
  for (const phrase of ASIDES) {
    if (!matches(words, from, phrase)) continue
    if (opens(words, from) && closes(words, from + phrase.length)) return phrase.length
  }
  return 0
}

// An aside is marked off by a comma at each end, and both of those commas
// belong to the aside rather than to the sentence around it, so the pair goes
// out with the words. Anything else hands its mark back to the word in front.
const filtered = (words: Word[]): Word[] => {
  const out: Word[] = []
  let carry = 0
  for (let index = 0; index < words.length; ) {
    const word = words[index]
    const run = fillerAt(words, index)
    if (run === 0) {
      word.gap = Math.max(word.gap, carry)
      carry = 0
      out.push(word)
      index += 1
      continue
    }
    const back = out[out.length - 1]
    const mark = words[index + run - 1].mark
    if (back) back.mark = back.mark === ',' && mark === ',' ? '' : stronger(back.mark, mark)
    carry = Math.max(carry, word.gap)
    index += run
  }
  return out
}

const repeats = (words: Word[], from: number, again: number, run: number): boolean => {
  for (let step = 0; step < run; step++) {
    if (key(words[from + step]) !== key(words[again + step])) return false
    if (ends(words[from + step])) return false
  }
  return true
}

const repeatAt = (words: Word[], from: number): number => {
  for (let run = Math.min(FALSE_START, Math.floor((words.length - from) / 2)); run >= 1; run--) {
    if (!repeats(words, from, from + run, run)) continue
    if (run === 1 && KEPT_DOUBLE.has(key(words[from]))) continue
    return run
  }
  return 0
}

const collapsed = (words: Word[]): Word[] => {
  const out: Word[] = []
  for (let index = 0; index < words.length; ) {
    const run = repeatAt(words, index)
    if (run === 0) {
      out.push(words[index])
      index += 1
      continue
    }
    const opening = out.length === 0 || ends(out[out.length - 1])
    for (let step = 0; step < run; step++) {
      const first = words[index + step]
      const second = words[index + run + step]
      if (step > 0 || !opening || !capital(second.text)) second.text = first.text
      if (step === 0) second.gap = first.gap
    }
    index += run
  }
  return out
}

const eased = (words: Word[]): void => {
  let start = 0
  for (let index = 0; index < words.length; index++) {
    const last = index === words.length - 1
    if (words[index].mark === '' && !last) continue
    if (index - start + 1 > LONG_RUN) {
      const middle = (start + index) / 2
      let best = -1
      for (let step = start; step < index; step++) {
        const gap = words[step + 1].gap
        if (best < 0) best = step
        else if (gap > words[best + 1].gap) best = step
        else if (gap === words[best + 1].gap && Math.abs(step - middle) < Math.abs(best - middle)) best = step
      }
      if (best >= 0 && words[best + 1].gap > 0) words[best].mark = ','
    }
    start = index + 1
  }
}

const marked = (words: Word[]): Word[] => {
  let since = 0
  for (let index = 0; index < words.length - 1; index++) {
    since += 1
    const word = words[index]
    if (word.mark !== '') {
      since = 0
      continue
    }
    const gap = words[index + 1].gap
    if (gap >= SENTENCE_GAP) {
      word.mark = '.'
      since = 0
      continue
    }
    if (gap >= CLAUSE_GAP && since >= CLAUSE_WORDS) {
      word.mark = ','
      since = 0
    }
  }
  eased(words)
  const last = words[words.length - 1]
  if (last && !ends(last)) last.mark = `${last.mark.replace(/[,;:]+$/, '')}.`
  return words
}

const capitals = (words: Word[]): Word[] => {
  let opening = true
  for (const word of words) {
    if (SELF.has(key(word))) word.text = `I${word.text.slice(1)}`
    if (opening) word.text = word.text.charAt(0).toUpperCase() + word.text.slice(1)
    opening = ends(word)
  }
  return words
}

const swapped = (words: Word[], swaps: TidyRules['words']): Word[] => {
  const table = swaps
    .map(swap => ({ phrase: swap.from.trim().toLowerCase().split(/\s+/).filter(Boolean), to: swap.to }))
    .filter(swap => swap.phrase.length > 0 && swap.to !== '')
  if (table.length === 0) return words
  const out: Word[] = []
  for (let index = 0; index < words.length; ) {
    const swap = table.find(entry => matches(words, index, entry.phrase))
    if (!swap) {
      out.push(words[index])
      index += 1
      continue
    }
    const last = words[index + swap.phrase.length - 1]
    out.push({ ...words[index], text: swap.to, mark: last.mark })
    index += swap.phrase.length
  }
  return out
}

// Nothing anyone says is ever read as a mark. "period" and "new line" are words
// somebody dictated and stay words, so the marks in the writing are the ones
// whisper heard plus the ones the pauses ask for.
export function tidy(chunks: readonly ScribeChunk[], rules: TidyRules = TIDY_RULES): string {
  let words = readWords(chunks)
  if (rules.corrections) words = corrected(words)
  if (rules.fillers) words = filtered(words)
  if (rules.stutters) words = collapsed(words)
  if (rules.marks) words = marked(words)
  words = capitals(words)
  if (rules.words.length > 0) words = swapped(words, rules.words)
  return words
    .map(word => `${word.lead}${word.text}${word.mark}`)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
