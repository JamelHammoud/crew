import type { AgentStep } from './llm'

// The board beside a thread. Nothing here is written down: the columns are the
// list the agent already keeps, and the questions, decisions and reviews are
// cards it writes beside its words. Both are read back off the steps the thread
// already holds, so a board is the same on every machine and costs the sync
// loop nothing.

export type TicketColumn = 'todo' | 'doing' | 'review' | 'done'

export const TICKET_COLUMNS: Array<{ key: TicketColumn; label: string }> = [
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' }
]

export interface Ticket {
  id: string
  title: string
  column: TicketColumn
  decisions: string[]
  files: string[]
  review: string
}

export interface TicketQuestion {
  id: string
  ask: string
  assumed: string
  options: string[]
  ticket: string
  // Files changed since it was asked, which is what answering late costs.
  since: number
}

export interface WorkBoard {
  tickets: Ticket[]
  questions: TicketQuestion[]
}

export type WorkCard =
  | { kind: 'question'; ask: string; assumed: string; options: string[] }
  | { kind: 'decision'; text: string }
  | { kind: 'review'; note: string }

export const ASK_LIMIT = 160
export const ASSUMED_LIMIT = 120
export const OPTION_LIMIT = 40
export const OPTIONS_LIMIT = 4
export const NOTE_LIMIT = 200
export const CARDS_LIMIT = 4

const line = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

// What arrives is whatever a model wrote, so a card is only as good as this. One
// with nothing on it is not a card and comes back as null rather than as an
// empty row standing on the board.
export function cleanWorkCard(raw: unknown): WorkCard | null {
  if (!raw || typeof raw !== 'object') return null
  const card = raw as Record<string, unknown>
  if (card.kind === 'question') {
    const ask = line(card.ask ?? card.text ?? card.question, ASK_LIMIT)
    if (!ask) return null
    const options = Array.isArray(card.options)
      ? card.options
          .map(option => line(option, OPTION_LIMIT))
          .filter(Boolean)
          .slice(0, OPTIONS_LIMIT)
      : []
    return { kind: 'question', ask, assumed: line(card.assumed ?? card.assumption, ASSUMED_LIMIT), options }
  }
  if (card.kind === 'decision') {
    const text = line(card.text ?? card.decision, NOTE_LIMIT)
    return text ? { kind: 'decision', text } : null
  }
  if (card.kind === 'review') {
    const note = line(card.note ?? card.text, NOTE_LIMIT)
    return note ? { kind: 'review', note } : null
  }
  return null
}

// The newline after the closing fence goes with it, or a card lifted out from
// between two lines leaves a blank one behind and splits the prose in two.
const WORK_FENCE = /^[ \t]*```[ \t]*work[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*\r?\n?/gim

// A card is a fenced block written beside the agent's ordinary words. It is
// taken out of what is read in the thread, because the whole point of one is
// that it stands on the board instead.
export function readWork(text: string): { text: string; cards: WorkCard[] } {
  const cards: WorkCard[] = []
  const rest = text.replace(WORK_FENCE, (_whole, body: string) => {
    if (cards.length >= CARDS_LIMIT) return ''
    try {
      const card = cleanWorkCard(JSON.parse(body))
      if (card) cards.push(card)
    } catch {
      return ''
    }
    return ''
  })
  return { text: rest.replace(/\n{3,}/g, '\n\n').trim(), cards }
}

// What this person has already dealt with. A question they answered and a
// review they have looked at are theirs alone, so the two ride with the window
// rather than being written down for the whole crew.
export interface Handled {
  answered?: readonly string[]
  reviewed?: readonly string[]
}

interface Entry {
  id: string
  title: string
  status: TicketColumn
  waiting: boolean
  decisions: string[]
  files: Set<string>
  review: string
}

const keyOf = (title: string): string => title.toLowerCase().replace(/\s+/g, ' ').trim()

const columnOf = (entry: Entry, reviewed: ReadonlySet<string>): TicketColumn => {
  if (entry.waiting) return reviewed.has(entry.id) ? 'done' : 'review'
  return entry.status
}

// The whole board, folded out of the steps in the order they happened. The last
// list the agent wrote is the tickets there are, and everything else hangs off
// whichever one was being worked on when it was written.
export function boardOf(steps: readonly AgentStep[], handled: Handled = {}): WorkBoard {
  const answered = new Set(handled.answered ?? [])
  const reviewed = new Set(handled.reviewed ?? [])
  const entries = new Map<string, Entry>()
  const questions: Array<TicketQuestion & { askedAt: number }> = []
  const touched = new Set<string>()
  let order: string[] = []
  let doing = ''
  let pending: string[] = []

  const current = (): Entry | undefined => entries.get(doing)

  for (const step of [...steps].sort((a, b) => a.ts - b.ts)) {
    for (const file of step.files ?? []) touched.add(file.path)
    if (step.todos?.length) {
      order = []
      for (const todo of step.todos) {
        const id = keyOf(todo.text)
        if (!id || order.includes(id)) continue
        const entry = entries.get(id) ?? {
          id,
          title: todo.text,
          status: 'todo' as TicketColumn,
          waiting: false,
          decisions: [],
          files: new Set<string>(),
          review: ''
        }
        entry.title = todo.text
        entry.status = todo.status === 'doing' ? 'doing' : todo.status === 'done' ? 'done' : 'todo'
        // Picking a ticket back up is the way out of review, and it is the
        // agent's own word rather than anybody pressing anything.
        if (todo.status === 'doing') entry.waiting = false
        entries.set(id, entry)
        order.push(id)
      }
      const started = step.todos.find(todo => todo.status === 'doing')
      doing = started ? keyOf(started.text) : ''
      // A decision written before there was a list to hang it off waits for the
      // first ticket that is picked up rather than being lost.
      const entry = current()
      if (entry && pending.length) {
        entry.decisions.push(...pending)
        pending = []
      }
    }
    if (doing && step.files?.length) {
      const entry = current()
      for (const file of step.files) entry?.files.add(file.path)
    }
    if (step.kind !== 'text' || !step.text) continue
    const { cards } = readWork(step.text)
    cards.forEach((card, index) => {
      const entry = current()
      if (card.kind === 'question') {
        questions.push({
          id: `${step.id}:${index}`,
          ask: card.ask,
          assumed: card.assumed,
          options: card.options,
          ticket: entry?.title ?? '',
          since: 0,
          askedAt: touched.size
        })
        return
      }
      if (card.kind === 'decision') {
        if (entry) entry.decisions.push(card.text)
        else pending.push(card.text)
        return
      }
      if (entry) {
        entry.review = card.note
        entry.waiting = true
      }
    })
  }

  return {
    tickets: order
      .map(id => entries.get(id))
      .filter((entry): entry is Entry => Boolean(entry))
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        column: columnOf(entry, reviewed),
        decisions: entry.decisions,
        files: [...entry.files],
        review: entry.review
      })),
    questions: questions
      .filter(question => !answered.has(question.id))
      .map(({ askedAt, ...question }) => ({ ...question, since: touched.size - askedAt }))
  }
}

export const TICKET_INSTRUCTIONS = [
  'This thread has a board beside it, and it is drawn from the task list you keep as you work, so keep that list current the way you normally do.',
  'Three other things belong on the board. Each one is a fenced block written beside your ordinary words, and it is taken out of the message and drawn as a card:',
  '```work',
  '{"kind":"question","ask":"Key the cache on the commit or on the path?","assumed":"the commit","options":["the commit","the path"]}',
  '```',
  'Raise a question the moment you notice you are about to answer one for yourself. Say what you are assuming, then take that assumption and carry on working. Never stop and never wait for an answer, and never ask about something you can find out by reading the project.',
  '```work',
  '{"kind":"decision","text":"Kept the local copy on a conflict rather than merging the two"}',
  '```',
  'Name a decision when you make one somebody could reasonably want made the other way.',
  '```work',
  '{"kind":"review","note":"The sync loop commits before it integrates now"}',
  '```',
  'Write a review when a piece of work is finished and worth a look. Whoever is reading can send it back with a sentence, and picking that task up again is what takes it out of review.',
  `At most ${CARDS_LIMIT} cards in one message, only where they earn their place, and never a card that repeats what you just said.`
].join('\n')
