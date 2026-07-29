// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { askKey, boardOf, type TicketEvent } from '../src/shared/tickets'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

// The store reads what is written down as it is made, so a window coming back
// is the module being loaded again.
const opened = async () => {
  vi.resetModules()
  return (await import('../src/renderer/src/state/board')).useBoard
}

const asked = (askId: string, ask: string): TicketEvent => ({
  id: `e-${askId}`,
  ts: 1,
  kind: 'ticket.asked',
  threadId: 'one',
  askId,
  ticketId: '',
  ask,
  assumed: '',
  options: []
})

describe('what this person has dealt with', () => {
  beforeEach(() => store.clear())

  it('is still dealt with in the next window', async () => {
    const board = await opened()
    board.getState().answer('one', askKey('Commit or path?'))
    board.getState().reviewedIt('one', '2')

    const again = await opened()
    expect(again.getState().answered.one).toEqual([askKey('commit or path?')])
    expect(again.getState().reviewed.one).toEqual(['2'])
  })

  it('leaves a question answered when the agent raises it again', async () => {
    const board = await opened()
    board.getState().answer('one', askKey('Commit or path?'))

    const again = await opened()
    const events = [asked('q1', 'Commit or path?'), asked('q2', 'Commit or path?')]
    expect(boardOf([], events, { answered: again.getState().answered.one }).questions).toEqual([])
  })

  it('carries on where there is nothing to write to', async () => {
    vi.stubGlobal('localStorage', undefined)
    const board = await opened()
    board.getState().answer('one', 'q')
    expect(board.getState().answered.one).toEqual(['q'])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear()
    })
  })

  it('keeps the boards last dealt with rather than the first', async () => {
    const board = await opened()
    for (let i = 0; i < 200; i++) board.getState().answer(`thread-${i}`, 'q')
    // The oldest of them, answered again, so it is the last dealt with.
    board.getState().answer('thread-0', 'again')
    board.getState().answer('thread-200', 'q')

    const again = await opened()
    expect(Object.keys(again.getState().answered)).toHaveLength(200)
    expect(again.getState().answered['thread-0']).toEqual(['q', 'again'])
    expect(again.getState().answered['thread-1']).toBeUndefined()
  })
})
