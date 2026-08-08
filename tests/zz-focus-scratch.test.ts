// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, it, vi } from 'vitest'
import type { PooledAgent } from '../src/shared/llm'
import { useCrew } from '../src/renderer/src/state/store'
import Chat from '../src/renderer/src/views/Chat'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const kept = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
    clear: () => kept.clear()
  }
})

const agent = (id: string, label: string): PooledAgent => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
})

const say = (where: string) => {
  const el = document.activeElement as HTMLElement | null
  console.log(where, el?.tagName, el?.getAttribute('aria-label') ?? el?.className?.slice(0, 30))
}

describe('where the caret really stands', () => {
  afterEach(cleanup)

  it('walks the picks', () => {
    useCrew.setState({
      connection: 'online',
      selfId: 'ali',
      selfName: 'ALI',
      place: 'project:/tmp/one',
      members: [{ id: 'ali', name: 'ALI', connected: true }],
      agents: [agent('ali/bubbles', 'Bubbles')],
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
      sendChat: vi.fn()
    })
    render(createElement(Chat))
    say('at mount')
    fireEvent.click(screen.getByLabelText('Add to your message'))
    say('menu open')
    ;(screen.getByLabelText('Add to your message') as HTMLElement).focus()
    say('plus focused by hand')
    fireEvent.click(screen.getByText('Agent'))
    say('on the faces')
    fireEvent.click(screen.getByText('Bubbles'))
    say('picked')
  })
})
