import { describe, expect, it } from 'vitest'
import type { AgentStep, StepTodo } from '../src/shared/llm'
import {
  boardOf,
  cleanColumn,
  cleanOptions,
  cleanTitles,
  isTicketEvent,
  LIST_LIMIT,
  ticketPreamble,
  type TicketEvent
} from '../src/shared/tickets'

let clock = 0

const todoStep = (todos: StepTodo[]): AgentStep => ({
  id: `t${++clock}`,
  ts: clock,
  kind: 'tool',
  name: 'TodoWrite',
  status: 'done',
  todos
})

const editStep = (...paths: string[]): AgentStep => ({
  id: `e${++clock}`,
  ts: clock,
  kind: 'tool',
  name: 'Edit',
  status: 'done',
  files: paths.map(path => ({ path, added: 1, removed: 0 }))
})

const added = (ticketId: string, title: string): TicketEvent => ({
  id: `a${++clock}`,
  ts: clock,
  kind: 'ticket.added',
  threadId: 'one',
  ticketId,
  title
})

const moved = (ticketId: string, column: 'todo' | 'doing' | 'review' | 'done', note = ''): TicketEvent => ({
  id: `m${++clock}`,
  ts: clock,
  kind: 'ticket.moved',
  threadId: 'one',
  ticketId,
  column,
  note
})

const decided = (ticketId: string, text: string): TicketEvent => ({
  id: `d${++clock}`,
  ts: clock,
  kind: 'ticket.decided',
  threadId: 'one',
  ticketId,
  text
})

const asked = (askId: string, ask: string, assumed = '', options: string[] = []): TicketEvent => ({
  id: `q${++clock}`,
  ts: clock,
  kind: 'ticket.asked',
  threadId: 'one',
  askId,
  ticketId: '',
  ask,
  assumed,
  options
})

describe('what the host will take', () => {
  it('refuses a ticket with no words on it and holds the list to a length', () => {
    expect(cleanTitles(['Read the loop', '   ', 'Seal a segment'])).toEqual(['Read the loop', 'Seal a segment'])
    expect(cleanTitles('One on its own')).toEqual(['One on its own'])
    expect(cleanTitles([{ title: 'From an object' }])).toEqual(['From an object'])
    expect(cleanTitles([])).toEqual([])
    expect(cleanTitles(Array.from({ length: 40 }, (_, i) => `Ticket ${i}`))).toHaveLength(LIST_LIMIT)
  })

  it('takes only the four columns', () => {
    expect(cleanColumn('doing')).toBe('doing')
    expect(cleanColumn('review')).toBe('review')
    expect(cleanColumn('blocked')).toBeNull()
    expect(cleanColumn(2)).toBeNull()
  })

  it('keeps a handful of options and drops the empty ones', () => {
    expect(cleanOptions(['the commit', '', 'the path'])).toEqual(['the commit', 'the path'])
    expect(cleanOptions('the commit')).toEqual([])
    expect(cleanOptions(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(4)
  })

  it('knows its own events apart from everything else in the log', () => {
    expect(isTicketEvent('ticket.added')).toBe(true)
    expect(isTicketEvent('ticket.asked')).toBe(true)
    expect(isTicketEvent('agent.step')).toBe(false)
  })
})

describe('the board an agent keeps', () => {
  it('stands the tickets up in the order they went up', () => {
    const board = boardOf([], [added('1', 'Read the loop'), added('2', 'Seal a segment')])
    expect(board.tickets.map(ticket => ticket.title)).toEqual(['Read the loop', 'Seal a segment'])
    expect(board.tickets.every(ticket => ticket.column === 'todo')).toBe(true)
  })

  it('moves one as the agent says so', () => {
    const board = boardOf([], [added('1', 'Read the loop'), added('2', 'Seal a segment'), moved('1', 'done'), moved('2', 'doing')])
    expect(board.tickets.map(ticket => ticket.column)).toEqual(['done', 'doing'])
  })

  it('carries the line the agent wrote into review, and takes it back out when the ticket is picked up again', () => {
    const events = [added('1', 'Seal a segment'), moved('1', 'review', 'The log seals at a megabyte')]
    expect(boardOf([], events).tickets[0]).toMatchObject({
      column: 'review',
      review: 'The log seals at a megabyte'
    })
    const back = boardOf([], [...events, moved('1', 'doing')]).tickets[0]
    expect(back.column).toBe('doing')
    expect(back.review).toBe('')
  })

  it('reads as done for whoever has looked at it and still in review for everyone else', () => {
    const events = [added('1', 'Seal a segment'), moved('1', 'review', 'Have a look')]
    expect(boardOf([], events, { reviewed: ['1'] }).tickets[0].column).toBe('done')
    expect(boardOf([], events).tickets[0].column).toBe('review')
  })

  it('hangs a decision off whatever is being worked on when it was written', () => {
    const board = boardOf(
      [],
      [
        added('1', 'Read the loop'),
        added('2', 'Seal a segment'),
        moved('2', 'doing'),
        decided('', 'Kept the local copy on a conflict')
      ]
    )
    expect(board.tickets[1].decisions).toEqual(['Kept the local copy on a conflict'])
    expect(board.tickets[0].decisions).toEqual([])
  })

  it('puts a decision on the ticket it names even when another one is being worked on', () => {
    const board = boardOf([], [added('1', 'Read the loop'), added('2', 'Seal it'), moved('2', 'doing'), decided('1', 'Read it twice')])
    expect(board.tickets[0].decisions).toEqual(['Read it twice'])
  })

  it('gives a ticket the files that changed while it was the one being worked on', () => {
    const board = boardOf(
      [editStep('src/before.ts')],
      [added('1', 'Seal a segment'), moved('1', 'doing')]
    )
    expect(board.tickets[0].files).toEqual([])
    const after = boardOf(
      [editStep('src/before.ts'), editStep('src/server/chatLog.ts')],
      [added('1', 'Seal a segment'), moved('1', 'doing')]
    )
    expect(after.tickets[0].files).toEqual([])
  })

  it('counts what answering a question late would cost', () => {
    const question = asked('q1', 'Key the cache on the commit or on the path?', 'the commit', ['the commit', 'the path'])
    const steps = [editStep('src/one.ts'), editStep('src/two.ts')]
    const board = boardOf(steps, [added('1', 'Cache it'), moved('1', 'doing'), question])
    expect(board.questions).toHaveLength(1)
    expect(board.questions[0]).toMatchObject({
      ask: 'Key the cache on the commit or on the path?',
      assumed: 'the commit',
      options: ['the commit', 'the path'],
      ticket: 'Cache it'
    })
  })

  it('takes a question off the board for whoever answered it', () => {
    const events = [asked('q1', 'Commit or path?')]
    expect(boardOf([], events).questions).toHaveLength(1)
    expect(boardOf([], events, { answered: ['q1'] }).questions).toEqual([])
  })

  it('is nothing at all for a thread that never said anything about its work', () => {
    expect(boardOf([editStep('src/server/git.ts')])).toEqual({ tickets: [], questions: [] })
  })
})

describe('the list a CLI keeps for itself', () => {
  it('stands in for a thread that never put its own tickets up', () => {
    const board = boardOf([
      todoStep([
        { text: 'Draw the rows', status: 'doing' },
        { text: 'Cover it', status: 'todo' }
      ])
    ])
    expect(board.tickets.map(ticket => ticket.column)).toEqual(['doing', 'todo'])
  })

  it('gives way the moment the agent keeps a board of its own', () => {
    const board = boardOf(
      [todoStep([{ text: 'Whatever the CLI called it', status: 'doing' }])],
      [added('1', 'What the agent put up')]
    )
    expect(board.tickets.map(ticket => ticket.title)).toEqual(['What the agent put up'])
  })
})

describe('the words an agent is given', () => {
  it('carries the address and the credential into every line that needs one', () => {
    const words = ticketPreamble('http://127.0.0.1:2739', 'p-1')
    expect(words).toContain('http://127.0.0.1:2739/tickets')
    expect(words).toContain('"promptId":"p-1"')
    expect(words).toContain('/tickets/question')
    expect(words).toContain('/decision')
    for (const column of ['todo', 'doing', 'review', 'done']) expect(words).toContain(column)
  })
})
