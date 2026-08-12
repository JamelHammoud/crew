import { describe, expect, it } from 'vitest'
import {
  sameItem,
  sameItems,
  sameShown,
  sameSubagentRuns,
  type ThreadItem
} from '../src/renderer/src/components/thread'

const base: Required<ThreadItem> = {
  key: 'prompt-1:step-4',
  ts: 1200,
  kind: 'tool',
  author: 'Claude',
  authorId: 'ali/claude',
  self: false,
  text: 'what it said',
  streaming: false,
  promptId: 'prompt-1',
  agentId: 'ali/claude',
  error: 'went wrong',
  stopped: false,
  helperSeed: 'helper-1',
  name: 'Edit',
  detail: 'src/app.ts',
  output: 'two lines',
  subagent: false,
  files: [{ path: 'src/app.ts', added: 3, removed: 1, diff: '@@' }],
  attachments: [{ id: 'a1', name: 'shot.png', mime: 'image/png', size: 12, file: 'a1.png' }],
  mentionRefs: [{ id: 'ali/claude', label: 'Claude' }],
  docMentions: [{ page: 'notes', title: 'Notes' }],
  boardMentions: [{ id: 'board-1', name: 'Board' }],
  route: 'queued',
  reactionTargetId: 'message:m1',
  reactions: [{ emoji: '🎉', count: 2, names: ['ALI', 'Jamel'], self: true }],
  replyTo: { targetId: 'm0', authorId: 'ali', authorName: 'ALI', text: 'before' },
  editedTs: 1300,
  voice: false,
  runs: [
    { threadId: 't2', name: 'Scout', subject: 'reading', agentId: 'ali/claude', ok: true, ms: 90, stopped: false }
  ],
  shown: { pages: ['/tmp/one.html'], title: 'The page' }
}

const changed = (value: unknown): unknown => {
  if (typeof value === 'string') return `${value}!`
  if (typeof value === 'number') return value + 1
  if (typeof value === 'boolean') return !value
  if (Array.isArray(value)) return []
  return undefined
}

const rebuilt = (item: Required<ThreadItem>): ThreadItem => ({
  ...item,
  reactions: item.reactions.map(group => ({ ...group, names: [...group.names] })),
  runs: item.runs.map(run => ({ ...run })),
  shown: { pages: [...item.shown.pages], title: item.shown.title }
})

describe('telling a redrawn row from a changed one', () => {
  it('reads a rebuilt row with the same words as the same row', () => {
    expect(sameItem(base, rebuilt(base))).toBe(true)
  })

  it('notices every field a row is drawn from', () => {
    for (const field of Object.keys(base) as Array<keyof ThreadItem>) {
      const other = { ...base, [field]: changed(base[field]) } as ThreadItem
      expect(sameItem(base, other), `${field} went unnoticed`).toBe(false)
    }
  })

  it('reads the lists it rebuilds by what is in them', () => {
    expect(sameShown({ pages: ['a'], title: 'One' }, { pages: ['a'], title: 'One' })).toBe(true)
    expect(sameShown({ pages: ['a'], title: 'One' }, { pages: ['b'], title: 'One' })).toBe(false)
    expect(
      sameSubagentRuns(
        base.runs,
        base.runs.map(run => ({ ...run }))
      )
    ).toBe(true)
    expect(sameSubagentRuns(base.runs, [{ ...base.runs[0], ok: false }])).toBe(false)
    expect(sameItems([base], [rebuilt(base)])).toBe(true)
    expect(sameItems([base], [base, base])).toBe(false)
  })

  it('reads a helper that came home as a change to the chip', () => {
    const out: ThreadItem = { ...base, runs: [{ threadId: 't2', name: 'Scout', subject: 'reading', agentId: 'a' }] }
    const home: ThreadItem = {
      ...base,
      runs: [{ threadId: 't2', name: 'Scout', subject: 'reading', agentId: 'a', ok: true, ms: 40 }]
    }
    expect(sameItem(out, home)).toBe(false)
  })
})
