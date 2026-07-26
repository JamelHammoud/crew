// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Chat from '../src/renderer/src/views/Chat'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const mine: SessionEvent = {
  id: 'mine',
  ts: 1,
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text: 'Can someone look at the reply button?',
  mentions: []
}

const theirs: SessionEvent = {
  id: 'theirs',
  ts: 2,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: 'On it.',
  mentions: [],
  replyTo: { targetId: 'message:mine', authorId: 'ali', authorName: 'ALI', text: mine.kind === 'message' ? mine.text : '' }
}

const openChat = (events: SessionEvent[], sendChat = vi.fn()): void => {
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
    docsTarget: null,
    sendChat
  })
  render(createElement(Chat))
}

describe('seeing a reply', () => {
  afterEach(cleanup)

  it('says a reply came to you and jumps back to what it answers', () => {
    openChat([mine, theirs])

    expect(screen.getByText('Replying to you')).toBeTruthy()
    expect(screen.queryByText('Replying to ALI')).toBeNull()

    fireEvent.click(screen.getByLabelText('Go to the message this replies to'))

    const target = document.querySelector('[data-message="message:mine"]')
    expect(target).toBeTruthy()
    expect(target!.classList.contains('message-flash')).toBe(true)
  })

  it('names your own message as yourself when you reply to it', () => {
    const sendChat = vi.fn((text: string, _threadId?: string, _boardId?: string, replyTo?: string) => {
      useCrew.setState(state => ({
        chatDraft: '',
        events: [
          ...state.events,
          {
            id: 'again',
            ts: 3,
            kind: 'message',
            authorId: 'ali',
            authorName: 'ALI',
            text,
            mentions: [],
            replyTo: {
              targetId: replyTo!,
              authorId: 'ali',
              authorName: 'ALI',
              text: mine.kind === 'message' ? mine.text : ''
            }
          }
        ]
      }))
    })
    openChat([mine], sendChat)

    fireEvent.click(screen.getByLabelText('Reply'))
    expect(screen.getByText('Replying to yourself')).toBeTruthy()

    const composer = screen.getByPlaceholderText('Send a message, @ an agent to start a thread, or / for a command')
    fireEvent.change(composer, { target: { value: 'Still broken.' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith('Still broken.', undefined, undefined, 'message:mine')
    expect(screen.getByText('Replying to yourself')).toBeTruthy()
  })
})
