import { describe, expect, it } from 'vitest'
import type { AgentStep, StepTodo } from '../src/shared/llm'
import { boardOf, cleanWorkCard, readWork } from '../src/shared/tickets'
import { stepTodos } from '../src/runner/providers/detail'

let clock = 0

const todoStep = (todos: StepTodo[]): AgentStep => ({
  id: `t${++clock}`,
  ts: clock,
  kind: 'tool',
  name: 'TodoWrite',
  status: 'done',
  todos
})

const textStep = (text: string): AgentStep => ({
  id: `b${++clock}`,
  ts: clock,
  kind: 'text',
  status: 'done',
  text
})

const editStep = (...paths: string[]): AgentStep => ({
  id: `e${++clock}`,
  ts: clock,
  kind: 'tool',
  name: 'Edit',
  status: 'done',
  files: paths.map(path => ({ path, added: 1, removed: 0 }))
})

const card = (body: object): string => ['```work', JSON.stringify(body), '```'].join('\n')

describe('the list every CLI keeps', () => {
  it('reads the three states however a provider spells them', () => {
    expect(stepTodos({ todos: [{ content: 'Draw the rows', status: 'in_progress' }] })).toEqual([
      { text: 'Draw the rows', status: 'doing' }
    ])
    expect(stepTodos({ plan: [{ step: 'Ship it', status: 'completed' }] })).toEqual([
      { text: 'Ship it', status: 'done' }
    ])
    expect(stepTodos({ items: [{ text: 'Ship it', completed: true }] })).toEqual([{ text: 'Ship it', status: 'done' }])
    expect(stepTodos({ todos: [{ content: 'Later', status: 'pending' }] })).toEqual([
      { text: 'Later', status: 'todo' }
    ])
  })

  it('is nothing rather than an empty list when there is none', () => {
    expect(stepTodos({ command: 'yarn test' })).toBeUndefined()
    expect(stepTodos({ todos: [] })).toBeUndefined()
    expect(stepTodos(undefined)).toBeUndefined()
  })
})

describe('a card', () => {
  it('comes back as null with nothing on it', () => {
    expect(cleanWorkCard({ kind: 'question' })).toBeNull()
    expect(cleanWorkCard({ kind: 'decision', text: '  ' })).toBeNull()
    expect(cleanWorkCard({ kind: 'nonsense', text: 'hi' })).toBeNull()
    expect(cleanWorkCard('question')).toBeNull()
  })

  it('is taken out of what is read', () => {
    const written = ['Starting on the sync loop.', card({ kind: 'decision', text: 'Kept the local copy' }), 'Done.'].join(
      '\n'
    )
    const { text, cards } = readWork(written)
    expect(text).toBe('Starting on the sync loop.\nDone.')
    expect(cards).toEqual([{ kind: 'decision', text: 'Kept the local copy' }])
  })

  it('leaves a broken one out rather than showing it', () => {
    const { text, cards } = readWork(['Working.', '```work', '{not json', '```'].join('\n'))
    expect(cards).toEqual([])
    expect(text).toBe('Working.')
  })
})

describe('the board', () => {
  it('is the columns the agent already keeps', () => {
    const board = boardOf([
      todoStep([
        { text: 'Read the plumbing', status: 'done' },
        { text: 'Draw the panel', status: 'doing' },
        { text: 'Write the test', status: 'todo' }
      ])
    ])
    expect(board.tickets.map(t => [t.title, t.column])).toEqual([
      ['Read the plumbing', 'done'],
      ['Draw the panel', 'doing'],
      ['Write the test', 'todo']
    ])
  })

  it('is the last list the agent wrote', () => {
    const board = boardOf([
      todoStep([{ text: 'Draw the panel', status: 'doing' }]),
      todoStep([
        { text: 'Draw the panel', status: 'done' },
        { text: 'Write the test', status: 'doing' }
      ])
    ])
    expect(board.tickets.map(t => t.column)).toEqual(['done', 'doing'])
  })

  it('hangs a decision and the files off whatever was being worked on', () => {
    const board = boardOf([
      todoStep([
        { text: 'Draw the panel', status: 'doing' },
        { text: 'Write the test', status: 'todo' }
      ]),
      textStep(card({ kind: 'decision', text: 'Sections rather than columns' })),
      editStep('src/renderer/src/components/work/WorkView.tsx')
    ])
    const panel = board.tickets[0]
    expect(panel.decisions).toEqual(['Sections rather than columns'])
    expect(panel.files).toEqual(['src/renderer/src/components/work/WorkView.tsx'])
    expect(board.tickets[1].decisions).toEqual([])
  })

  it('keeps a decision made before there was a list to hang it off', () => {
    const board = boardOf([
      textStep(card({ kind: 'decision', text: 'Derived rather than written down' })),
      todoStep([{ text: 'Draw the panel', status: 'doing' }])
    ])
    expect(board.tickets[0].decisions).toEqual(['Derived rather than written down'])
  })

  it('holds a reviewed ticket in review, and picking it back up is the way out', () => {
    const steps = [
      todoStep([{ text: 'Draw the panel', status: 'doing' }]),
      textStep(card({ kind: 'review', note: 'The panel reads off the steps now' })),
      todoStep([{ text: 'Draw the panel', status: 'done' }])
    ]
    expect(boardOf(steps)[('tickets' as const)][0].column).toBe('review')
    expect(boardOf(steps)[('tickets' as const)][0].review).toBe('The panel reads off the steps now')
    expect(boardOf([...steps, todoStep([{ text: 'Draw the panel', status: 'doing' }])]).tickets[0].column).toBe('doing')
  })

  it('moves a review to done for whoever has looked at it, and nobody else', () => {
    const steps = [
      todoStep([{ text: 'Draw the panel', status: 'doing' }]),
      textStep(card({ kind: 'review', note: 'Have a look' }))
    ]
    expect(boardOf(steps, { reviewed: ['draw the panel'] }).tickets[0].column).toBe('done')
    expect(boardOf(steps).tickets[0].column).toBe('review')
  })

  it('says what answering a question late would cost', () => {
    const board = boardOf([
      todoStep([{ text: 'Draw the panel', status: 'doing' }]),
      textStep(card({ kind: 'question', ask: 'Columns or sections?', assumed: 'sections', options: ['columns', 'sections'] })),
      editStep('a.ts', 'b.ts'),
      editStep('b.ts', 'c.ts')
    ])
    expect(board.questions).toHaveLength(1)
    expect(board.questions[0].since).toBe(3)
    expect(board.questions[0].ticket).toBe('Draw the panel')
    expect(board.questions[0].options).toEqual(['columns', 'sections'])
  })

  it('drops a question the reader has answered', () => {
    const steps = [textStep(card({ kind: 'question', ask: 'Columns or sections?', assumed: 'sections' }))]
    const asked = boardOf(steps).questions
    expect(asked).toHaveLength(1)
    expect(boardOf(steps, { answered: [asked[0].id] }).questions).toEqual([])
  })

  it('is empty for a thread that never drew a list', () => {
    expect(boardOf([textStep('Had a look at the sync loop.'), editStep('src/server/git.ts')])).toEqual({
      tickets: [],
      questions: []
    })
  })
})
