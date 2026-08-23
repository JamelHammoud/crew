// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentStep } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import DesignChip from '../src/renderer/src/components/DesignChip'
import { buildThread, type ThreadItem } from '../src/renderer/src/components/thread'
import { useCrew } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

afterEach(cleanup)

const run: SessionEvent = {
  id: 'run',
  ts: 1,
  kind: 'agent.start',
  promptId: 'prompt',
  agentId: 'agent',
  agentLabel: 'Bubbles',
  promptText: 'draw it',
  byName: 'Jamel',
  threadId: 'thread'
}

const step = (id: string, detail: string): AgentStep => ({
  id,
  ts: 2,
  kind: 'tool',
  status: 'done',
  name: 'Bash',
  detail
})

describe('design API work in a thread', () => {
  it('turns local board reads and edits into design primitives', () => {
    const steps = {
      prompt: [
        step('read', 'curl -s http://127.0.0.1:59206/6329c2/design/landing-1abc'),
        step(
          'edit',
          `curl -s -X POST http://localhost:59206/6329c2/design/landing-1abc/ops -H 'content-type: application/json'`
        )
      ]
    }

    expect(buildThread([run], steps, 'jamel').map(item => item.design)).toEqual([
      { boardId: 'landing-1abc', action: 'read' },
      { boardId: 'landing-1abc', action: 'edit' }
    ])
  })

  it('leaves external and unrelated curl calls as shell steps', () => {
    const steps = {
      prompt: [
        step('external', 'curl -s https://example.com/6329c2/design/landing-1abc'),
        step('other', 'curl -s http://127.0.0.1:59206/6329c2/files/landing-1abc')
      ]
    }

    const items = buildThread([run], steps, 'jamel')
    expect(items.map(item => item.kind)).toEqual(['tool', 'tool'])
    expect(items.map(item => item.detail)).toEqual(steps.prompt.map(item => item.detail))
  })

  it('opens the named board from the chip', () => {
    useCrew.setState({
      boards: [{ id: 'landing-1abc', name: 'Landing' }],
      designTarget: null,
      docsTarget: null
    })
    const item: ThreadItem = {
      key: 'design',
      ts: 1,
      kind: 'design',
      author: 'Bubbles',
      self: false,
      text: '',
      streaming: false,
      design: { boardId: 'landing-1abc', action: 'read' }
    }

    render(createElement(DesignChip, { item }))
    fireEvent.click(screen.getByRole('button', { name: 'Landing Read' }))

    expect(useCrew.getState().designTarget).toBe('landing-1abc')
  })
})
