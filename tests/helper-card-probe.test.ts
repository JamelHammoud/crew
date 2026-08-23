// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ThreadItems from '../src/renderer/src/components/ThreadItems'
import { buildThread } from '../src/renderer/src/components/thread'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
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
Element.prototype.getAnimations ??= () => []
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const THREAD = 'helper-thread'
const AGENT = 'bubbles'

const agent: PooledAgent = {
  id: AGENT,
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: { model: 'claude-sonnet-4' },
  fields: [
    {
      key: 'model',
      label: 'Model',
      options: [
        { value: 'claude-opus-5', label: 'Opus 5' },
        { value: 'claude-sonnet-4', label: 'Sonnet 4' }
      ],
      default: 'claude-sonnet-4'
    }
  ]
}

const thread: ThreadMeta = {
  id: THREAD,
  agentId: AGENT,
  agentLabel: agent.label,
  title: 'Read the schema',
  createdBy: 'Bubbles',
  status: 'open',
  mode: 'build',
  parentThreadId: 'parent-thread',
  helper: 'Scout',
  subject: 'reading the schema',
  helperModel: 'claude-opus-5'
}

const ended: SessionEvent = {
  id: 'ended',
  ts: 2,
  kind: 'agent.end',
  promptId: 'prompt',
  agentId: AGENT,
  agentLabel: agent.label,
  ok: true,
  text: 'The schema has three tables.',
  threadId: THREAD
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('shows the model the helper started with from its name in the helper thread', () => {
  useCrew.setState({
    selfId: 'jamel',
    agents: [agent],
    members: [],
    threads: { [THREAD]: thread }
  })
  const items = buildThread([ended], {}, 'jamel', [agent], { name: 'Scout', seed: THREAD })
  render(createElement(ThreadItems, { threadId: THREAD, items }))

  vi.useFakeTimers()
  fireEvent.mouseEnter(screen.getByText('Scout').parentElement!)
  act(() => void vi.advanceTimersByTime(400))

  const card = document.body.querySelector('.glass.fixed') as HTMLElement
  expect(card).toBeTruthy()
  expect(card.textContent).toContain('Scout')
  expect(card.textContent).toContain('Bubbles')
  expect(card.textContent).toContain('Model')
  expect(card.textContent).toContain('Opus 5')
  expect(card.textContent).not.toContain('Sonnet 4')
})
