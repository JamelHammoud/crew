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
    docs: { main: { title: 'Main', text: '' }, 'plan-1abc': { title: 'Plan', text: 'ship it' } },
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

function type(input: HTMLTextAreaElement, text: string) {
  input.focus()
  fireEvent.change(input, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } })
}

describe('picking a mention', () => {
  it('adds a space after the agent name and leaves the caret past it on tab', () => {
    const input = boot()
    type(input, 'hey @bob')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('hey @Bob (Kimi K3) ')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('adds a space after the agent name when the row is clicked', () => {
    const input = boot()
    type(input, '@bob')
    fireEvent.click(screen.getByText('@Bob (Kimi K3)'))
    expect(input.value).toBe('@Bob (Kimi K3) ')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('adds a space after a doc name', () => {
    const input = boot()
    type(input, '#pla')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('#Plan ')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('keeps typing in place when text already follows the mention', () => {
    const input = boot()
    input.focus()
    fireEvent.change(input, { target: { value: '@bob can you look', selectionStart: 4, selectionEnd: 4 } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('@Bob (Kimi K3) can you look')
    expect(input.selectionStart).toBe('@Bob (Kimi K3) '.length)
  })
})
