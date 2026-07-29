import { create } from 'zustand'

// What this person has dealt with on a board. A question you answered and a
// review you have looked at are yours rather than the crew's, so neither is
// written down: the board itself is read back off the thread, and this is only
// which of it is still waiting on you.
type BoardState = {
  answered: Record<string, string[]>
  reviewed: Record<string, string[]>
  answer(threadId: string, questionId: string): void
  reviewedIt(threadId: string, ticketId: string): void
}

const add = (held: Record<string, string[]>, key: string, id: string): Record<string, string[]> =>
  held[key]?.includes(id) ? held : { ...held, [key]: [...(held[key] ?? []), id] }

export const useBoard = create<BoardState>(set => ({
  answered: {},
  reviewed: {},
  answer: (threadId, questionId) => set(s => ({ answered: add(s.answered, threadId, questionId) })),
  reviewedIt: (threadId, ticketId) => set(s => ({ reviewed: add(s.reviewed, threadId, ticketId) }))
}))
