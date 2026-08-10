import { openaiUrl } from './modelServers'

export const EDIT_BRIEF = `You are editing dictation. What you are given is speech that has been transcribed and lightly tidied. Turn it into the text the speaker would have typed. Return only that text.

MEANING COMES FIRST. Never swap one word for another: not "the" for "a", not "their" for "the", not "meet" for "be", not "review" for "view". Never change a singular to a plural, a positive to a negative, or a name, date, amount or quantity. Where a phrase is uncertain, take the reading that makes sense with the fewest changes to what was heard. Never reword a sentence because another phrasing sounds better.

SENTENCES. A pause is not a full stop. Keep a clause with the thought it belongs to. Use commas for short pauses, lists, dependent clauses, introductory phrases and asides. Use a full stop only where a thought has really ended, and a question mark wherever the sentence is a question. Never write a fragment the speaker did not mean. Do not open a sentence with And, But, Or or So where that word carries on the sentence in front of it.
Wrong: I still need to review the data. Update the presentation. And send everything. To the team.
Right: I still need to review the data, update the presentation, and send everything to the team.

CORRECTIONS. Where the speaker corrects themselves, write the version they settled on and drop what it replaced. "Schedule it for Tuesday at three, actually make that Wednesday at four thirty" becomes "Schedule it for Wednesday at 4:30." "I'll meet you Thursday, sorry, Friday" becomes "I'll meet you Friday." Leave no half of a correction standing.

FILLERS. Drop um, uh, erm, like, you know, basically, sort of and kind of where they are filler. Keep them where they carry meaning: "I kind of like the new design" stays as it is.

VOICE. Keep contractions. Keep "gonna" where somebody meant it. Do not formalize casual speech: "I'm probably just gonna stay home" is not "I will probably remain at home."

NUMBERS. Write them the way they would be typed: three people, 17 people, $1,247.83, 12.7%, 4:30, 9:30 a.m. Use a colon in a time and never a full stop. Write a spoken date as August 21st, 2026. Keep a currency that was spoken.

NAMES AND TERMS. Keep an unfamiliar name rather than replacing it with a commoner one, and keep its accents where you know them: Nguyen, Jose, Francois. Capitalize acronyms: CEO, IT, API, CRM, VPN, AI, GPU, CPU, URL, HTTP, SQL, Q1. Capitalize products and technologies as they are written: GitHub, JavaScript, TypeScript, Python, OpenAI, ChatGPT, macOS, iOS, JSON, PostgreSQL, AWS. Write a business quarter as Q3. Hyphenate year-over-year, real-time, well-known, long-term.

LISTS. Punctuate a spoken list, with a comma before the last item. "Review the API CRM and VPN settings" becomes "Review the API, CRM, and VPN settings."

QUOTES. Where the speaker says quote and end quote, put what stands between them in quotation marks and drop both spoken words.

Do not add an ellipsis for a pause or a repetition. Use one only where the speaker really trails off. Drop a repeated start: "I was, I was gonna go home" becomes "I was gonna go home." Keep a repetition that is clearly emphasis.

Repair an obvious mishearing only where the sentence gives strong evidence for it. Never guess at a word the speech does not support. Never add, summarize, explain or answer anything. You are editing the speaker's words, not replying to them.

Return the edited text and nothing else. No preamble, no quotation marks around the whole of it, no notes.`

export const EDIT_LIMIT = 1600

export const EDIT_MS = 8000

export const MODELS_MS = 2000

export const KEPT = 0.65
export const GROWN = 1.35
export const ADDED = 0.1

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu

const FENCE = /^```[^\n]*\n([\s\S]*?)\n?```$/

const QUOTED = /^(["'“”])([\s\S]*)\1$/

const THOUGHT = /^[\s\S]*<\/think(?:ing)?>/

const LOOSE = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
  'billion', 'first', 'second', 'third', 'fourth', 'fifth', 'point', 'percent',
  'dollar', 'dollars', 'cent', 'cents', 'pound', 'pounds', 'euro', 'euros',
  'quarter', 'oh', 'o', 'a', 'm', 'p', 'am', 'pm', 'and', 'quote', 'unquote',
  'end'
])

const COMMON = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'this', 'that',
  'for', 'you', 'your', 'i', 'be', 'as', 'on', 'at', 'with', 'here', 'have',
  'has', 'was', 'are', 'my', 'me', 'so', 'up', 'out'
])

const wordsIn = (text: string): string[] =>
  [...text.toLowerCase().matchAll(WORD)].map(found => found[0])

const figure = (word: string): boolean => /\d/.test(word)

const meaning = (word: string): boolean => !figure(word) && !LOOSE.has(word)

const telling = (word: string): boolean => !figure(word) && !COMMON.has(word)

const withoutPreamble = (answer: string, said: Set<string>): string => {
  const lines = answer.split('\n')
  let from = 0
  while (from < lines.length - 1) {
    if (wordsIn(lines[from]).some(word => said.has(word))) break
    from += 1
  }
  return lines.slice(from).join('\n')
}

const unwrapped = (answer: string, said: Set<string>): string => {
  const thought = answer.replace(THOUGHT, '').trim()
  const fenced = FENCE.exec(thought)
  const inside = withoutPreamble((fenced ? fenced[1] : thought).trim(), said)
  const quoted = QUOTED.exec(inside.trim())
  return (quoted ? quoted[2] : inside).replace(/\s+/g, ' ').trim()
}

export function edited(said: string, answer: string): string | null {
  const meant = wordsIn(said)
  if (meant.length === 0) return null
  const out = unwrapped(answer, new Set(meant.filter(telling)))
  if (!out) return null
  const wrote = wordsIn(out)
  if (wrote.length === 0) return null
  if (wrote.length > Math.ceil(meant.length * GROWN) + 2) return null

  const left = new Map<string, number>()
  for (const word of meant) left.set(word, (left.get(word) ?? 0) + 1)
  let added = 0
  for (const word of wrote) {
    const held = left.get(word) ?? 0
    if (held > 0) {
      left.set(word, held - 1)
      continue
    }
    if (meaning(word)) added += 1
  }
  if (added > Math.max(1, Math.floor(meant.length * ADDED))) return null

  const asked = meant.filter(meaning).length
  if (asked > 0) {
    let lost = 0
    for (const [word, count] of left) if (meaning(word)) lost += count
    if (asked - lost < asked * KEPT) return null
  }
  return out
}

export interface Editor {
  url: string
  model: string
}

const canEdit = (editor: Editor): boolean =>
  Boolean(editor.url.trim()) && Boolean(editor.model.trim())

const answerOf = (frame: any): string => {
  const held = frame?.choices?.[0]?.message?.content
  return typeof held === 'string' ? held : ''
}

async function ask(said: string, editor: Editor, signal: AbortSignal): Promise<string> {
  const answer = await fetch(openaiUrl(editor.url, '/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: editor.model,
      stream: false,
      temperature: 0,
      messages: [
        { role: 'system', content: EDIT_BRIEF },
        { role: 'user', content: said }
      ]
    }),
    signal
  })
  if (!answer.ok) throw new Error(`The model server answered ${answer.status}.`)
  return answerOf(await answer.json())
}

export async function editSaid(
  said: string,
  editor: Editor,
  signal?: AbortSignal
): Promise<string> {
  if (!canEdit(editor) || !said.trim() || said.length > EDIT_LIMIT) return said
  const capped = AbortSignal.timeout(EDIT_MS)
  const watching = signal ? AbortSignal.any([signal, capped]) : capped
  try {
    return edited(said, await ask(said, editor, watching)) ?? said
  } catch {
    return said
  }
}

export async function editModels(url: string): Promise<string[]> {
  if (!url.trim()) return []
  try {
    const answer = await fetch(openaiUrl(url, '/models'), {
      signal: AbortSignal.timeout(MODELS_MS)
    })
    if (!answer.ok) return []
    const held = await answer.json()
    const rows: Array<{ id?: unknown }> = Array.isArray(held?.data) ? held.data : []
    return rows
      .map(row => (typeof row?.id === 'string' ? row.id : ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}
