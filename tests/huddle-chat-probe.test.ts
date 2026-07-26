// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHuddle } from '../src/renderer/src/state/huddle'
import { useCrew } from '../src/renderer/src/state/store'
import Chat from '../src/renderer/src/views/Chat'
import type { SessionEvent } from '../src/shared/events'
import { emptyRoom, type HuddlePeer } from '../src/shared/huddle'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const peer = (peerId: string, name: string): HuddlePeer => ({
  peerId,
  memberId: `m-${peerId}`,
  name,
  muted: false,
  camera: false,
  sharing: false,
  joinedAt: 1
})

const started: SessionEvent = {
  id: 'started',
  ts: 1000,
  kind: 'huddle.started',
  huddleId: 'call-1',
  byId: 'jamel',
  byName: 'Jamel'
}

const joined: SessionEvent = {
  id: 'joined',
  ts: 2000,
  kind: 'huddle.joined',
  huddleId: 'call-1',
  memberId: 'ali',
  name: 'Ali'
}

const mine: SessionEvent = {
  id: 'started',
  ts: 1000,
  kind: 'huddle.started',
  huddleId: 'call-1',
  byId: 'ali',
  byName: 'Ali'
}

const ended: SessionEvent = { id: 'ended', ts: 900_000, kind: 'huddle.ended', huddleId: 'call-1', ms: 780_000 }

const session = (events: SessionEvent[]) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'Ali',
    members: [
      { id: 'ali', name: 'Ali', connected: true },
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
}

describe('a huddle in the chat', () => {
  beforeEach(() => {
    useHuddle.setState({ room: emptyRoom(), joined: false, joining: false })
  })

  afterEach(cleanup)

  it('offers a way in while the call is going', () => {
    const join = vi.fn(() => Promise.resolve())
    session([started, joined])
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('p-jamel', 'Jamel'), peer('p-ali', 'Ali')], startedAt: Date.now() - 65_000 },
      join
    })

    render(createElement(Chat))
    expect(screen.getByText('Jamel and Ali')).toBeTruthy()
    expect(screen.getByText('1m 5s')).toBeTruthy()

    fireEvent.click(screen.getByText('Join'))
    expect(join).toHaveBeenCalled()
  })

  it('says who came and how long it ran once it is over', () => {
    session([started, joined, ended])

    render(createElement(Chat))
    expect(screen.getByText('Jamel and Ali')).toBeTruthy()
    expect(screen.getByText('Lasted 13 minutes')).toBeTruthy()
    expect(screen.queryByText('Join')).toBeNull()
  })

  // The dock is already on screen with the controls in it, so the block does
  // not offer a way into a call you are standing in.
  it('drops the way in once you are in the call', () => {
    session([started, joined])
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('p-jamel', 'Jamel'), peer('p-ali', 'Ali')], startedAt: Date.now() },
      joined: true
    })

    render(createElement(Chat))
    expect(screen.getByText('Jamel and Ali')).toBeTruthy()
    expect(screen.queryByText('Join')).toBeNull()
  })

  // Only the call the block was written for is the live one. An older block
  // keeps its own record rather than borrowing whoever is talking now.
  it('leaves an older block alone while a new call is going', () => {
    const later: SessionEvent = {
      id: 'started-2',
      ts: 1_000_000,
      kind: 'huddle.started',
      huddleId: 'call-2',
      byId: 'ali',
      byName: 'Ali'
    }
    session([started, joined, ended, later])
    useHuddle.setState({ room: { id: 'call-2', peers: [peer('p-ali', 'Ali')], startedAt: Date.now() } })

    render(createElement(Chat))
    expect(screen.getByText('Lasted 13 minutes')).toBeTruthy()
    expect(screen.getAllByText('Join')).toHaveLength(1)
  })

  it('shows nothing for a call it never saw start', () => {
    session([joined, ended])

    render(createElement(Chat))
    expect(screen.queryByText('Huddle')).toBeNull()
  })

  it('lets whoever started a call take its block out', () => {
    const deleteHuddle = vi.fn()
    session([mine, joined, ended])
    useCrew.setState({ deleteHuddle })

    render(createElement(Chat))
    fireEvent.contextMenu(screen.getByText('Huddle'))
    fireEvent.click(screen.getByText('Delete huddle'))
    expect(deleteHuddle).toHaveBeenCalledWith('call-1')
  })

  it('offers nothing on a call someone else started', () => {
    session([started, joined, ended])

    render(createElement(Chat))
    fireEvent.contextMenu(screen.getByText('Huddle'))
    expect(screen.queryByText('Delete huddle')).toBeNull()
  })

  // The block is the way into a call that is going, so it cannot be taken out
  // from under the people who have not joined yet.
  it('leaves the block alone while the call is going', () => {
    session([mine, joined])
    useHuddle.setState({ room: { id: 'call-1', peers: [peer('p-ali', 'Ali')], startedAt: Date.now() } })

    render(createElement(Chat))
    fireEvent.contextMenu(screen.getByText('Huddle'))
    expect(screen.queryByText('Delete huddle')).toBeNull()
  })
})
