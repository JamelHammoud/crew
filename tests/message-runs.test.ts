// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { sameRun, type ThreadItem } from '../src/renderer/src/components/thread'
import Chat from '../src/renderer/src/views/Chat'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const MINUTE = 60 * 1000

const said = (id: string, who: string, ts: number, extra: Partial<ThreadItem> = {}): ThreadItem => ({
  key: id,
  ts,
  kind: 'message',
  author: who,
  authorId: who.toLowerCase(),
  self: false,
  text: 'hi',
  streaming: false,
  ...extra
})

const noon = new Date('2026-07-21T12:00:00').getTime()

const message = (id: string, who: string, ts: number, extra: Record<string, unknown> = {}): SessionEvent => ({
  id,
  ts,
  kind: 'message',
  authorId: who.toLowerCase(),
  authorName: who,
  text: `${id} text`,
  mentions: [],
  ...extra
})

const seat = (events: SessionEvent[]) =>
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [
      { id: 'ali', name: 'ALI', connected: true },
      { id: 'jamel', name: 'Jamel', connected: true }
    ],
    agents: [],
    events,
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null
  })

describe('a run of messages from one person', () => {
  it('keeps the second line under the first', () => {
    expect(sameRun(said('m1', 'Jamel', noon), said('m2', 'Jamel', noon + MINUTE))).toBe(true)
  })

  it('breaks when somebody else is talking', () => {
    expect(sameRun(said('m1', 'Jamel', noon), said('m2', 'ALI', noon + MINUTE))).toBe(false)
  })

  it('breaks after seven minutes', () => {
    expect(sameRun(said('m1', 'Jamel', noon), said('m2', 'Jamel', noon + 7 * MINUTE - 1))).toBe(true)
    expect(sameRun(said('m1', 'Jamel', noon), said('m2', 'Jamel', noon + 7 * MINUTE))).toBe(false)
  })

  it('breaks over midnight', () => {
    const late = new Date('2026-07-21T23:58:00').getTime()
    expect(sameRun(said('m1', 'Jamel', late), said('m2', 'Jamel', late + 4 * MINUTE))).toBe(false)
  })

  it('leaves a message with its own head alone', () => {
    const before = said('m1', 'Jamel', noon)
    const reply = said('m2', 'Jamel', noon + MINUTE, {
      replyTo: { targetId: 'message:x', authorId: 'ali', authorName: 'ALI', text: 'go on' }
    })
    expect(sameRun(before, reply)).toBe(false)
    expect(sameRun(before, said('m3', 'Jamel', noon + MINUTE, { voice: true }))).toBe(false)
  })

  it('never starts from a step or a note', () => {
    expect(sameRun(said('n1', 'crew', noon, { kind: 'note' }), said('m1', 'Jamel', noon + MINUTE))).toBe(false)
    expect(sameRun(undefined, said('m1', 'Jamel', noon))).toBe(false)
  })
})

describe('the chat', () => {
  afterEach(cleanup)

  it('draws one head over a run and a new one when the run breaks', () => {
    seat([
      message('m1', 'Jamel', noon),
      message('m2', 'Jamel', noon + MINUTE),
      message('m3', 'ALI', noon + 2 * MINUTE),
      message('m4', 'Jamel', noon + 3 * MINUTE),
      message('m5', 'Jamel', noon + 11 * MINUTE),
      message('m6', 'Jamel', noon + 12 * MINUTE)
    ])

    const { container } = render(createElement(Chat))

    expect(container.querySelectorAll('.msg-row')).toHaveLength(6)
    expect(container.querySelectorAll('.msg-run')).toHaveLength(2)
    expect(screen.getAllByText('Jamel')).toHaveLength(3)
    expect(screen.getAllByText('ALI')).toHaveLength(1)
    for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
      expect(screen.getByText(`${id} text`)).toBeTruthy()
    }
  })
})
