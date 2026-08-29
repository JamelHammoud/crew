// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadMeta } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const tops = new WeakMap<HTMLElement, number>()
const scrollHeight = 2000
const clientHeight = 500

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight })
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => clientHeight })
Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get(this: HTMLElement) {
    return tops.get(this) ?? 0
  },
  set(this: HTMLElement, value: number) {
    tops.set(this, value)
  }
})

const { useCrew } = await import('../src/renderer/src/state/store')
const SubagentRun = (await import('../src/renderer/src/components/subagents/SubagentRun')).default

const CHILD = 'child-thread'

const thread: ThreadMeta = {
  id: CHILD,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A helper',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build',
  parentThreadId: 'parent-thread',
  helper: 'Scout'
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useCrew.setState({
    threads: { [CHILD]: thread },
    events: [],
    steps: {},
    threadPrompts: {},
    threadDrafts: {},
    queues: {},
    tokens: {},
    pending: {}
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function boot() {
  const view = render(createElement(SubagentRun, { threadId: CHILD }))
  const scroller = view.container.querySelector('.overflow-y-auto') as HTMLElement
  const top = () => view.container.querySelector('.top-0.bg-gradient-to-b') as HTMLElement
  const bottom = () => view.container.querySelector('.bottom-0.bg-gradient-to-t') as HTMLElement
  return { scroller, top, bottom }
}

// The transcript is cut hard at both ends of the panel, under the header row and
// over the composer, so it goes out the way every other panel's does.
describe('a helper thread in the panel', () => {
  it('fades where the words run under the chrome', () => {
    const { scroller, top, bottom } = boot()

    expect(top()).toBeTruthy()
    expect(bottom()).toBeTruthy()

    // It lands at the bottom, so what is cut off is above.
    expect(top().className).toContain('opacity-100')
    expect(bottom().className).toContain('opacity-0')

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)

    expect(top().className).toContain('opacity-0')
    expect(bottom().className).toContain('opacity-100')
  })

  it('runs the failed helper again from its transcript', () => {
    const restart = vi.fn()
    useCrew.setState({
      restartSubagent: restart,
      events: [
        {
          id: 'start',
          ts: 1,
          kind: 'agent.start',
          promptId: 'prompt',
          agentId: 'agent-1',
          agentLabel: 'Bubbles',
          promptText: 'check it',
          byName: 'Jamel',
          threadId: CHILD
        },
        {
          id: 'end',
          ts: 2,
          kind: 'agent.end',
          promptId: 'prompt',
          agentId: 'agent-1',
          agentLabel: 'Bubbles',
          ok: false,
          error: 'No connection',
          ms: 1000,
          threadId: CHILD
        }
      ]
    })

    render(createElement(SubagentRun, { threadId: CHILD }))
    const action = screen.getByRole('button', { name: 'Try again' })
    expect(action.compareDocumentPosition(screen.getByText('1s')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(action)
    expect(restart).toHaveBeenCalledWith(CHILD)
  })
})
