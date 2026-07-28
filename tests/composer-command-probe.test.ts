// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Chat from '../src/renderer/src/views/Chat'
import { useCrew } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const open = (sendChat = vi.fn()) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [],
    events: [],
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null,
    sendChat
  })
  render(createElement(Chat))
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('commands in the composer', () => {
  afterEach(cleanup)

  it('lifts a typed command onto a chip and takes it off again', () => {
    const composer = open()

    fireEvent.change(composer, { target: { value: '/plan ' } })
    expect(composer.value).toBe('')
    expect(screen.getByText('Plan')).toBeTruthy()

    // The chip stands in the row the plus stands in.
    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).toContain('Plan')

    fireEvent.click(screen.getByLabelText('Remove Plan'))
    expect(screen.queryByText('Plan')).toBeNull()
    expect(useCrew.getState().chatCommands).toEqual([])
  })

  it('sends the command beside the message rather than in it', () => {
    const sendChat = vi.fn()
    const composer = open(sendChat)

    fireEvent.change(composer, { target: { value: '/plan ' } })
    fireEvent.change(composer, { target: { value: 'tidy the readme' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith('tidy the readme', undefined, undefined, undefined, undefined, ['plan'])
  })

  it('leaves a command written inside a sentence alone', () => {
    const sendChat = vi.fn()
    const composer = open(sendChat)

    fireEvent.change(composer, { target: { value: 'fix this /plan later' } })
    expect(composer.value).toBe('fix this /plan later')
    expect(screen.queryByLabelText('Remove Plan')).toBeNull()

    fireEvent.click(screen.getByLabelText('Send'))
    expect(sendChat).toHaveBeenCalledWith('fix this /plan later', undefined, undefined, undefined, undefined, [])
  })

  it('rubs a chip out with backspace on an empty box', () => {
    const composer = open()

    fireEvent.change(composer, { target: { value: '/plan ' } })
    fireEvent.change(composer, { target: { value: '/ghost ' } })
    expect(useCrew.getState().chatCommands).toEqual(['plan', 'ghost'])

    fireEvent.keyDown(composer, { key: 'Backspace' })
    expect(useCrew.getState().chatCommands).toEqual(['plan'])
  })
})
