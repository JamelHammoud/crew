// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Chat from '../src/renderer/src/views/Chat'
import { useCrew } from '../src/renderer/src/state/store'
import type { PooledAgent, ProviderCapability } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

const capability: ProviderCapability = {
  provider: 'codex',
  label: 'Codex',
  fields: [],
  installed: true,
  installable: true
}

const agent: PooledAgent = {
  id: 'jamel/codex',
  label: 'Codex',
  provider: 'codex',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

function open(agents: PooledAgent[], connection: 'connecting' | 'online' = 'online') {
  useCrew.setState({
    connection,
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents,
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
    docsTarget: null
  })
  render(createElement(Chat))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the empty chat', () => {
  it('shows a skeleton while the Crew contents are loading', () => {
    open([], 'connecting')

    const list = document.querySelector('[data-chat-list-skeleton]')
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll('[data-skeleton]')).toHaveLength(11)
    expect(screen.queryByRole('button', { name: 'Add an agent' })).toBeNull()
    expect(screen.queryByText('Say hi, or mention someone with @.')).toBeNull()
  })

  it('opens agent setup from the empty state when the Crew has no agents', async () => {
    const agentCapabilities = vi.fn(async () => [capability])
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: { agentCapabilities } as unknown as Window['crew']
    })

    open([])

    expect(agentCapabilities).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Add an agent' }))

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add an agent' })).toBeTruthy())
    expect(agentCapabilities).toHaveBeenCalledOnce()
    expect(screen.queryByText('Say hi, or mention someone with @.')).toBeNull()
  })

  it('keeps the conversational empty state once an agent is available', () => {
    open([agent])

    expect(screen.getByText('Say hi, or mention someone with @.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add an agent' })).toBeNull()
  })
})
