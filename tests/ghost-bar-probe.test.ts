// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const thread = (ghost: boolean): ThreadMeta => ({
  id: 't1',
  agentId: 'a1',
  agentLabel: 'Fable',
  title: 'tidy the readme',
  createdBy: 'ALI',
  status: 'open',
  mode: 'build',
  ghost
})

const open = (ghost: boolean) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [{ id: 'a1', label: 'Fable', provider: 'claude', online: true, busy: false }],
    events: [],
    docs: {},
    threads: { t1: thread(ghost) },
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
  render(createElement(ThreadView, { threadId: 't1' }))
}

describe('a hidden thread says so at the head of it', () => {
  afterEach(cleanup)

  it('floats the ghost bar and leaves the old pill off the header', () => {
    open(true)
    expect(screen.getByText('Ghost mode')).toBeTruthy()
    expect(screen.queryByText('Only you')).toBeNull()
  })

  it('says nothing on an ordinary thread', () => {
    open(false)
    expect(screen.queryByText('Ghost mode')).toBeNull()
  })
})
