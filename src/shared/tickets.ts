import type { AgentStep } from './llm'

// The board beside a thread. It is Crew's own rather than a reading of whatever
// list each CLI happens to expose: an agent puts its tickets up, moves them,
// names a decision and raises a question through the session's own http, the
// way it sends a helper out. That is a curl line in the preamble, so every
// provider gets the same board at once, and a vendor renaming its own task tool
// cannot take the columns out again, which is what happened the first time.
//
// Nothing about a board is state the host holds. Every call is written down as
// an event on the thread and the whole board is folded back out of them, so it
// replays for free and is the same on every machine.

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

export const TITLE_LIMIT = 120
export const ASK_LIMIT = 160
export const ASSUMED_LIMIT = 120
export const OPTION_LIMIT = 40
export const OPTIONS_LIMIT = 4
export const NOTE_LIMIT = 200
export const LIST_LIMIT = 24

// The four things an agent can say about its own work. They carry the thread
// they are on rather than a board id, because a board is a thread.
export type TicketEvent =
  | { id: string; ts: number; kind: 'ticket.added'; threadId: string; ticketId: string; title: string }
  | { id: string; ts: number; kind: 'ticket.moved'; threadId: string; ticketId: string; column: TicketColumn; note: string }
  | { id: string; ts: number; kind: 'ticket.decided'; threadId: string; ticketId: string; text: string }
  | {
      id: string
      ts: number
      kind: 'ticket.asked'
      threadId: string
      askId: string
      ticketId: string
      ask: string
      assumed: string
      options: string[]
    }

export const isTicketEvent = (kind: string): boolean => kind.startsWith('ticket.')

export const ticketLine = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

const COLUMNS = new Set<string>(TICKET_COLUMNS.map(column => column.key))

// What arrives is whatever a model wrote, so a call is only as good as these.
// One with nothing on it is refused rather than written down as a ticket with
// no words on it.
export const cleanColumn = (raw: unknown): TicketColumn | null =>
  typeof raw === 'string' && COLUMNS.has(raw) ? (raw as TicketColumn) : null

export function cleanTitles(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const titles: string[] = []
  for (const entry of list) {
    const title = ticketLine(typeof entry === 'string' ? entry : (entry as { title?: unknown })?.title, TITLE_LIMIT)
    if (title) titles.push(title)
    if (titles.length >= LIST_LIMIT) break
  }
  return titles
}

export function cleanOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(option => ticketLine(option, OPTION_LIMIT))
    .filter(Boolean)
    .slice(0, OPTIONS_LIMIT)
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
  column: TicketColumn
  decisions: string[]
  files: Set<string>
  review: string
}

interface Asked extends TicketQuestion {
  askedAt: number
}

const entryOf = (id: string, title: string): Entry => ({
  id,
  title,
  column: 'todo',
  decisions: [],
  files: new Set<string>(),
  review: ''
})

const keyOf = (title: string): string => title.toLowerCase().replace(/\s+/g, ' ').trim()

// The whole board, folded out of what happened in the order it happened. Steps
// and ticket events are read as one run of time, because which files a ticket
// touched is the ones that changed while it was the one being worked on.
export function boardOf(
  steps: readonly AgentStep[],
  events: readonly TicketEvent[] = [],
  handled: Handled = {}
): WorkBoard {
  const answered = new Set(handled.answered ?? [])
  const reviewed = new Set(handled.reviewed ?? [])
  const sorted = [...steps].sort((a, b) => a.ts - b.ts)
  const said = [...events].sort((a, b) => a.ts - b.ts)
  const put = said.length > 0
  const { entries, order } = put ? { entries: new Map<string, Entry>(), order: [] as string[] } : listedBy(sorted)
  const questions: Asked[] = []
  const touched = new Set<string>()
  let doing = ''

  const at = (id: string): Entry | undefined => entries.get(id || doing)

  const timeline: Array<{ ts: number; step?: AgentStep; event?: TicketEvent }> = [
    ...sorted.map(step => ({ ts: step.ts, step })),
    ...said.map(event => ({ ts: event.ts, event }))
  ].sort((a, b) => a.ts - b.ts)

  for (const moment of timeline) {
    const { step, event } = moment
    if (step) {
      for (const file of step.files ?? []) {
        touched.add(file.path)
        at('')?.files.add(file.path)
      }
      continue
    }
    if (!event) continue
    if (event.kind === 'ticket.added') {
      if (entries.has(event.ticketId)) continue
      entries.set(event.ticketId, entryOf(event.ticketId, event.title))
      order.push(event.ticketId)
      continue
    }
    if (event.kind === 'ticket.moved') {
      const entry = entries.get(event.ticketId)
      if (!entry) continue
      entry.column = event.column
      if (event.column === 'review') entry.review = event.note
      // Picking a ticket back up is the way out of review, and it is the
      // agent's own word rather than anybody pressing anything.
      if (event.column === 'doing') {
        entry.review = ''
        doing = entry.id
      } else if (doing === entry.id) doing = ''
      continue
    }
    if (event.kind === 'ticket.decided') {
      at(event.ticketId)?.decisions.push(event.text)
      continue
    }
    const entry = at(event.ticketId)
    questions.push({
      id: event.askId,
      ask: event.ask,
      assumed: event.assumed,
      options: event.options,
      ticket: entry?.title ?? '',
      since: 0,
      askedAt: touched.size
    })
  }

  return {
    tickets: order
      .map(id => entries.get(id))
      .filter((entry): entry is Entry => Boolean(entry))
      .map(entry => ({
        id: entry.id,
        title: entry.title,
        // A review somebody has looked at is done for them and still in review
        // for everyone else, which is the whole of what In review means.
        column: entry.column === 'review' && reviewed.has(entry.id) ? 'done' : entry.column,
        decisions: entry.decisions,
        files: [...entry.files],
        review: entry.column === 'review' ? entry.review : ''
      })),
    questions: questions
      .filter(question => !answered.has(question.id))
      .map(({ askedAt, ...question }) => ({ ...question, since: touched.size - askedAt }))
  }
}

// The words an agent is given. They are written here rather than on the host
// because only the machine running it knows the address it reaches the session
// at, which is the same reason the helpers and the design board write theirs
// there. Every line of it is a curl, so a CLI needs nothing of its own.
export function ticketPreamble(apiBase: string, promptId: string): string {
  return [
    `## The board`,
    ``,
    `This thread has a board beside it, and it is yours to keep. Everyone watching can see it, so it is how somebody follows what you are doing without reading over your shoulder.`,
    ``,
    `Put the work up before you start, broken into pieces somebody could read one at a time. It comes back with an id for each.`,
    ``,
    `  curl -s -X POST ${apiBase}/tickets -H 'content-type: application/json' -d '{"promptId":"${promptId}","tickets":["Read how the sync loop commits","Segment the chat log","Cover it with a test"]}'`,
    ``,
    `Move one as you pick it up and as you finish it. Keep exactly one on doing.`,
    ``,
    `  curl -s -X POST ${apiBase}/tickets/2 -H 'content-type: application/json' -d '{"promptId":"${promptId}","column":"doing"}'`,
    ``,
    `The columns are todo, doing, review and done. Send a piece to review, with a line saying what to look at, when it is finished and worth a look rather than when it is merely over. Picking it up again is what takes it back out.`,
    ``,
    `  curl -s -X POST ${apiBase}/tickets/2 -H 'content-type: application/json' -d '{"promptId":"${promptId}","column":"review","note":"The log seals a segment at a megabyte and opens the next"}'`,
    ``,
    `Name a decision when you make one somebody could reasonably want made the other way. It hangs off whatever you have on doing.`,
    ``,
    `  curl -s -X POST ${apiBase}/tickets/2/decision -H 'content-type: application/json' -d '{"promptId":"${promptId}","text":"Kept the local copy on a conflict rather than merging the two"}'`,
    ``,
    `Raise a question the moment you notice you are about to answer one for yourself. Say what you are assuming, then take that assumption and carry on. Never stop and never wait for an answer, and never ask what you could find out by reading the project.`,
    ``,
    `  curl -s -X POST ${apiBase}/tickets/question -H 'content-type: application/json' -d '{"promptId":"${promptId}","ask":"Key the cache on the commit or on the path?","assumed":"the commit","options":["the commit","the path"]}'`,
    ``,
    `None of these waits and none of them is a message to anybody. Keep the promptId exactly as it is above. It is what says the board is yours.`
  ].join('\n')
}
