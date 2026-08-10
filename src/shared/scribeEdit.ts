import { openaiUrl } from './modelServers'

// A dictation read a second time, by a model on this machine, so what lands is
// what somebody would have typed rather than what they said out loud. The
// tidying in `scribeTidy.ts` is rules, and rules cannot reach most of this: a
// pause is not a full stop, "four thirty" is 4:30, a spoken list wants its
// commas, and a mishearing is only ever settled by the sentence around it.
//
// It runs where whisper runs, on this computer, or it does not run at all.
// Scribe never touches the crew and nothing said into it goes over the wire, and
// a second pass through somebody else's service would be the one thing here that
// broke that.

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

// A stretch longer than this is a paragraph of speech, and past it the wait is
// worse than the tidying is good.
export const EDIT_LIMIT = 1600

// How long a stretch may take before the rules-based writing goes out instead.
// The whole feature is words landing while somebody talks, so a model thinking
// about it is a dictation that appears to have stopped.
export const EDIT_MS = 8000

// Long enough for a server that is up and short enough that a page does not sit
// there waiting on one that is not.
export const MODELS_MS = 2000

// What has to survive for an answer to be believed. An edit keeps the words and
// moves the marks, so an answer that has dropped a third of what was said is
// answering rather than editing.
export const KEPT = 0.65
export const GROWN = 1.35
export const ADDED = 0.1

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu

const FENCE = /^```[^\n]*\n([\s\S]*?)\n?```$/

const QUOTED = /^(["'“”])([\s\S]*)\1$/

// Words a real edit is allowed to lose or invent, because these are the ones
// that become something else on the way to being written: a figure, a symbol, a
// time. Everything outside this set is meaning and has to come back.
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

// The words that say nothing about which text a line came out of. A preamble is
// made of them, so sharing one is no evidence at all that a line is somebody's
// dictation rather than a model's own sentence about it.
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

// A preamble is a line with none of the dictation's own words in it, which is
// what "Here is the cleaned up text:" is and what a line of somebody's speech
// never is. It is cut rather than refused, since the words under it are the
// answer. Only a word that says something counts as evidence: a line sharing
// nothing but "the" came from a model rather than from a room.
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
  const fenced = FENCE.exec(answer.trim())
  const inside = withoutPreamble((fenced ? fenced[1] : answer).trim(), said)
  const quoted = QUOTED.exec(inside.trim())
  return (quoted ? quoted[2] : inside).replace(/\s+/g, ' ').trim()
}

// Whether what a model handed back may be written into somebody's work. The two
// ways of being wrong do not cost the same: a dictation that came out as the
// rules would have written it is a sentence somebody has to punctuate for
// themselves, and one that came out as a model's own answer, or with a line of
// chat in front of it, is somebody's document with words in it that nobody said.
// So a doubt is refused, and the rules-based writing stands.
export function edited(said: string, answer: string): string | null {
  const meant = wordsIn(said)
  if (meant.length === 0) return null
  const out = unwrapped(answer, new Set(meant.filter(telling)))
  if (!out) return null
  const wrote = wordsIn(out)
  if (wrote.length === 0) return null
  if (wrote.length > Math.ceil(meant.length * GROWN) + 2) return null

  // What is left in here once the answer has been walked is every occurrence of
  // a word that was said and did not come back, which is the one number both
  // halves of this are read from.
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

// No key anywhere in here on purpose. A key belongs to the machine and is kept
// beside the app at 0600, where Scribe's own settings live in this window, so a
// key written into one would be a token in a window's storage. What Scribe
// reaches is a server on this computer, and a server that wants a key is one it
// leaves alone.
export interface Editor {
  url: string
  model: string
}

export const canEdit = (editor: Editor): boolean =>
  Boolean(editor.url.trim()) && Boolean(editor.model.trim())

const answerOf = (frame: any): string => {
  const held = frame?.choices?.[0]?.message?.content
  return typeof held === 'string' ? held : ''
}

// One call, whole rather than streamed. Nothing is drawn as it arrives and a
// half written sentence is not something to paste, so what is wanted is the one
// settled answer.
async function ask(said: string, editor: Editor, signal: AbortSignal): Promise<string> {
  const answer = await fetch(openaiUrl(editor.url, '/chat/completions'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
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

// What to write for a stretch. Every way this can fail hands back the writing
// the rules already produced, because a dictation somebody said out loud is
// never worth losing to a model that was slow, offline, or talking to itself.
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

// What the server says it will serve, asked for again every time the page is
// opened rather than once: a CLI's models change about never and a local one
// changes the moment somebody runs a pull.
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
