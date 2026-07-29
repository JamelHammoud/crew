import { create } from 'zustand'

// What this person has dealt with on a board. A question you answered and a
// review you have looked at are yours rather than the crew's, so neither is
// written down: the board itself is read back off the thread, and this is only
// which of it is still waiting on you.
//
// It is kept on this machine the way the volume is, and it has to be. Held in
// the window alone, every reload handed back a question already answered, and
// a renderer reloads whenever the project is edited under it, which is most of
// an afternoon with an agent working. Nothing about it is ever sent.

const KEY = 'crew.board'
// Boards this is remembered for. The oldest go first, so a folder worked in for
// months is not carrying every thread it ever had.
const THREAD_LIMIT = 200

type Held = Record<string, string[]>

type BoardState = {
  answered: Held
  reviewed: Held
  answer(threadId: string, ask: string): void
  reviewedIt(threadId: string, ticketId: string): void
}

const heldOf = (raw: unknown): Held => {
  const held: Held = {}
  if (!raw || typeof raw !== 'object') return held
  for (const [threadId, ids] of Object.entries(raw as Record<string, unknown>)) {
    const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
    if (list.length > 0) held[threadId] = list
  }
  return held
}

function read(): { answered: Held; reviewed: Held } {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')
    return { answered: heldOf(saved?.answered), reviewed: heldOf(saved?.reviewed) }
  } catch {
    return { answered: {}, reviewed: {} }
  }
}

function write(held: { answered: Held; reviewed: Held }): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(held))
  } catch {
    // A window with no storage keeps them for as long as it is open, which is
    // still better than losing them while it is.
  }
}

// A thread written to goes to the end, so the oldest to be dealt with is the
// first to go rather than whichever happened to be opened first.
const add = (held: Held, threadId: string, id: string): Held => {
  if (held[threadId]?.includes(id)) return held
  const { [threadId]: mine, ...rest } = held
  const next: Held = { ...rest, [threadId]: [...(mine ?? []), id] }
  const threads = Object.keys(next)
  for (const old of threads.slice(0, Math.max(0, threads.length - THREAD_LIMIT))) delete next[old]
  return next
}

export const useBoard = create<BoardState>(set => ({
  ...read(),
  answer: (threadId, ask) =>
    set(state => {
      const answered = add(state.answered, threadId, ask)
      write({ answered, reviewed: state.reviewed })
      return { answered }
    }),
  reviewedIt: (threadId, ticketId) =>
    set(state => {
      const reviewed = add(state.reviewed, threadId, ticketId)
      write({ answered: state.answered, reviewed })
      return { reviewed }
    })
}))
