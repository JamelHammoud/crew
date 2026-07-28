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

const source: SessionEvent = {
  id: 'source-message',
  ts: 1,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: 'Can you take a look?',
  mentions: []
}

describe('chat replies', () => {
  afterEach(cleanup)

  it('shows the selected reply and keeps it on the sent message', () => {
    const sendChat = vi.fn((text: string, _threadId?: string, _boardId?: string, replyTo?: string) => {
      useCrew.setState(state => ({
        chatDraft: '',
        events: [
          ...state.events,
          {
            id: 'sent-message',
            ts: 2,
            kind: 'message',
            authorId: 'ali',
            authorName: 'ALI',
            text,
            mentions: [],
            replyTo: {
              targetId: replyTo!,
              authorId: 'jamel',
              authorName: 'Jamel',
              text: source.kind === 'message' ? source.text : ''
            }
          }
        ]
      }))
    })

    useCrew.setState({
      connection: 'online',
      selfId: 'ali',
      selfName: 'ALI',
      members: [
        { id: 'ali', name: 'ALI', connected: true },
        { id: 'jamel', name: 'Jamel', connected: true }
      ],
      agents: [],
      events: [source],
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
    fireEvent.click(screen.getByLabelText('Reply'))

    expect(screen.getByText('Replying to Jamel')).toBeTruthy()
    expect(screen.getAllByText('Can you take a look?')).toHaveLength(2)

    const composer = screen.getByRole('textbox')
    fireEvent.change(composer, { target: { value: 'Yes, I can.' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith('Yes, I can.', undefined, undefined, 'message:source-message', undefined, [])
    expect(screen.getByText('Replying to Jamel')).toBeTruthy()
    expect(screen.getAllByText('Can you take a look?')).toHaveLength(2)
  })
})
