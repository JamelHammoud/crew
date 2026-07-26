// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)
import type { PooledAgent } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia
Element.prototype.scrollIntoView = () => {}
if (typeof globalThis.CSS === 'undefined') {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const agent: PooledAgent = {
  id: 'jamel/bob',
  label: 'Bob (Kimi K3)',
  provider: 'kimi',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

function boot() {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [agent],
    events: [],
    docs: { main: { title: 'Main', text: '' } },
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
  render(createElement(Chat))
  return screen.getByPlaceholderText(/message/i) as HTMLTextAreaElement
}

function type(input: HTMLTextAreaElement, text: string, caret = text.length) {
  input.focus()
  fireEvent.change(input, { target: { value: text, selectionStart: caret, selectionEnd: caret } })
}

describe('emoji shortcodes in the composer', () => {
  it('swaps a closed shortcode for the emoji and leaves the caret after it', () => {
    const input = boot()
    type(input, 'well :pensive:')
    expect(input.value).toBe('well 😔')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('keeps the rest of the line when the shortcode is closed mid sentence', () => {
    const input = boot()
    type(input, 'well :pensive: it happens', 'well :pensive:'.length)
    expect(input.value).toBe('well 😔 it happens')
    expect(input.selectionStart).toBe('well 😔'.length)
  })

  it('leaves a shortcode nothing answers to alone', () => {
    const input = boot()
    type(input, 'meet at 12:30: sharp')
    expect(input.value).toBe('meet at 12:30: sharp')
    type(input, ':notanemoji:')
    expect(input.value).toBe(':notanemoji:')
  })

  it('offers matches while a shortcode is being typed and picks one on tab', () => {
    const input = boot()
    type(input, 'ship it :tad')
    expect(screen.getByLabelText(':tada:')).toBeTruthy()

    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('ship it 🎉 ')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('picks a match from a click', () => {
    const input = boot()
    type(input, ':joy')
    fireEvent.click(screen.getByLabelText(':joy:'))
    expect(input.value).toBe('😂 ')
  })

  it('waits for two letters before opening the menu', () => {
    const input = boot()
    type(input, 'ratio 1:2')
    expect(screen.queryByLabelText(':two:')).toBeNull()
  })
})
