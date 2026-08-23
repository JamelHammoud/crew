import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SubagentMessage from '../src/renderer/src/components/SubagentMessage'
import type { ThreadItem } from '../src/renderer/src/components/thread'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const PARENT = 'parent-thread'
const CHILD = 'child-thread'

const item: ThreadItem = {
  key: 'follow-up',
  ts: 1,
  kind: 'subagent-message',
  author: 'Scout',
  self: false,
  text: 'also check the docs',
  streaming: false,
  helperThreadId: CHILD
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  useCrew.setState({
    threads: {
      [PARENT]: {
        id: PARENT,
        agentId: 'agent-1',
        agentLabel: 'Bubbles',
        title: 'Do the work',
        createdBy: 'Jamel',
        status: 'open',
        mode: 'build'
      }
    }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('a message sent to a helper', () => {
  it('reads as a helper primitive and opens that helper', () => {
    const openSubagent = vi.fn()
    useBrowser.setState({ openSubagent })
    render(createElement(SubagentMessage, { item, threadId: PARENT }))

    expect(screen.getByText('To Scout')).toBeTruthy()
    expect(screen.getByText('also check the docs')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(openSubagent).toHaveBeenCalledWith(CHILD, PARENT)
  })
})
