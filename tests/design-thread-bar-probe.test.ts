// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { installLocalStorage } from './helpers/local-storage'

afterEach(cleanup)

installLocalStorage()

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { default: DesignChat } = await import('../src/renderer/src/components/DesignChat')
const { useCrew } = await import('../src/renderer/src/state/store')

const agent = (id: string, label: string) =>
  ({ id, label, provider: 'claude', ownerId: 'jamel', ownerName: 'Jamel', status: 'idle', runs: {}, settings: {}, fields: [] }) as never

const thread = (id: string, agentId: string, agentLabel: string, title: string) =>
  ({
    id,
    agentId,
    agentLabel,
    title,
    createdBy: 'Jamel',
    status: 'open',
    mode: 'build',
    boardId: 'board:a'
  }) as never

const FIRST = '@Bubbles What’s this? On this board, change: Diamond'
const SECOND = '@Fable Give the card a shadow'

function boot(threads: Record<string, unknown>) {
  useCrew.setState({
    events: [],
    steps: {},
    selfId: 'jamel',
    agents: [agent('agent:bubbles', 'Bubbles'), agent('agent:fable', 'Fable')],
    members: [],
    docs: {},
    boards: [],
    threads,
    threadPrompts: {},
    threadDrafts: {},
    tokens: {},
    pending: {},
    sendChat: () => {},
    cancelPrompt: () => {},
    setThreadDraft: () => {}
  } as never)
  return render(createElement(DesignChat, { boardId: 'board:a' }))
}

describe('the board chat thread bar', () => {
  it('names the thread you are in rather than laying every one of them out', () => {
    boot({
      t1: thread('t1', 'agent:bubbles', 'Bubbles', FIRST),
      t2: thread('t2', 'agent:fable', 'Fable', SECOND)
    })
    expect(screen.getByLabelText('Pick a thread').textContent).toContain('Give the card a shadow')
    expect(document.body.textContent).not.toContain('change: Diamond')
  })

  it('leaves the agent’s own name out of the title, since the pet says who', () => {
    boot({ t1: thread('t1', 'agent:bubbles', 'Bubbles', FIRST) })
    expect(document.body.textContent).toContain('What’s this? On this board, change: Diamond')
    expect(document.body.textContent).not.toContain('@Bubbles')
  })

  it('holds the rest of them in a menu, and switching shows that thread', () => {
    boot({
      t1: thread('t1', 'agent:bubbles', 'Bubbles', FIRST),
      t2: thread('t2', 'agent:fable', 'Fable', SECOND)
    })
    fireEvent.click(screen.getByLabelText('Pick a thread'))
    fireEvent.click(screen.getByText('What’s this? On this board, change: Diamond'))
    expect(screen.getByLabelText('Pick a thread').textContent).toContain('change: Diamond')
  })

  it('offers no picker when there is only one thread to pick', () => {
    boot({ t1: thread('t1', 'agent:bubbles', 'Bubbles', FIRST) })
    expect(screen.queryByLabelText('Pick a thread')).toBe(null)
    expect(screen.getByLabelText('New thread')).toBeTruthy()
  })

  it('says where a new message is going once you ask for a new thread', () => {
    boot({ t1: thread('t1', 'agent:bubbles', 'Bubbles', FIRST) })
    fireEvent.click(screen.getByLabelText('New thread'))
    expect(screen.getByLabelText('Pick a thread').textContent).toContain('New thread')
    expect(screen.getByPlaceholderText('Ask an agent to design something')).toBeTruthy()
  })

  it('keeps the bar off a board nobody has said anything on', () => {
    boot({})
    expect(screen.queryByLabelText('New thread')).toBe(null)
    expect(screen.queryByLabelText('Pick a thread')).toBe(null)
  })
})
