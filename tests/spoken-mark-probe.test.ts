// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ThreadCard from '../src/renderer/src/components/ThreadCard'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const thread = (voice: boolean): ThreadMeta => ({
  id: 't1',
  agentId: 'a1',
  agentLabel: 'Fable',
  title: 'what broke',
  createdBy: 'ALI',
  status: 'open',
  mode: 'build',
  voice
})

const said = (id: string, text: string, voice?: boolean): SessionEvent => ({
  id,
  ts: 1,
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text,
  mentions: [],
  threadId: 't1',
  voice
})

const load = (voice: boolean, events: SessionEvent[]) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [
      {
        id: 'a1',
        label: 'Fable',
        provider: 'claude',
        ownerId: 'ali',
        ownerName: 'ALI',
        status: 'idle',
        runs: {},
        settings: {},
        fields: []
      }
    ],
    events,
    docs: {},
    threads: { t1: thread(voice) },
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: 't1',
    docsTarget: null
  })
}

const card = (voice: boolean) => {
  load(voice, [])
  render(
    createElement(ThreadCard, {
      thread: thread(voice),
      ts: 1,
      state: 'ready' as const,
      detail: '',
      onOpen: () => {}
    })
  )
}

describe('a thread somebody spoke says so', () => {
  afterEach(cleanup)

  it('wears the Voice chip on its card the way a plan wears its own', () => {
    card(true)
    expect(screen.getByText('Voice')).toBeTruthy()
  })

  it('says nothing on the card of a thread somebody typed', () => {
    card(false)
    expect(screen.queryByText('Voice')).toBeNull()
  })

  it('marks the line that was said rather than the box it was typed in', () => {
    load(true, [said('m1', 'what broke', true), said('m2', 'and this one I typed')])
    render(createElement(ThreadView, { threadId: 't1' }))

    const marks = screen.getAllByText('Spoken')
    expect(marks).toHaveLength(1)
    const row = marks[0].parentElement as HTMLElement
    const stamp = row.querySelector('span[class*="text-fg-faint"]') as HTMLElement
    expect(stamp).toBeTruthy()
    expect(stamp.compareDocumentPosition(marks[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row.textContent).toContain('ALI')
  })

  it('leaves the composer header alone', () => {
    load(true, [said('m1', 'what broke', true)])
    render(createElement(ThreadView, { threadId: 't1' }))

    const header = screen.getByLabelText('Back to chat').closest('div') as HTMLElement
    expect(header.textContent).not.toContain('Spoken')
  })
})
