// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aimOf, type PooledAgent } from '../src/shared/llm'
import { useDefaultAgent } from '../src/renderer/src/state/defaultAgent'
import { useCrew } from '../src/renderer/src/state/store'
import Chat from '../src/renderer/src/views/Chat'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const PLACE = 'project:/tmp/one'

const agent = (id: string, label: string, status: PooledAgent['status'] = 'idle'): PooledAgent => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status,
  runs: {},
  settings: {},
  fields: []
})

const BUBBLES = agent('ali/bubbles', 'Bubbles')
const KIMI = agent('ali/kimi', 'Kimi')

const open = (agents: PooledAgent[] = [BUBBLES, KIMI], sendChat = vi.fn()) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    place: PLACE,
    members: [{ id: 'ali', name: 'ALI', connected: true }],
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
    docsTarget: null,
    sendChat
  })
  render(createElement(Chat))
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

const pick = (label: string) => {
  fireEvent.click(screen.getByLabelText('Add to your message'))
  fireEvent.click(screen.getByText('Default agent'))
  fireEvent.click(screen.getByText(label))
}

describe('the agent standing on the chat composer', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
    useDefaultAgent.setState({ agentId: null })
  })
  afterEach(cleanup)

  it('lands a chip that says who takes it, and takes it off again', () => {
    open()
    pick('Bubbles')

    // The chip stands in the row the plus stands in, the way a command does.
    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).toContain('Bubbles')
    expect(useDefaultAgent.getState().agentId).toBe('ali/bubbles')

    fireEvent.click(screen.getByLabelText('Stop sending to Bubbles'))
    expect(row.textContent).not.toContain('Bubbles')
    expect(useDefaultAgent.getState().agentId).toBeNull()
  })

  it('sends what was typed to them without the name being written', () => {
    const sendChat = vi.fn()
    const composer = open([BUBBLES, KIMI], sendChat)
    pick('Bubbles')

    fireEvent.change(composer, { target: { value: 'tidy the readme' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith(
      'tidy the readme',
      undefined,
      undefined,
      undefined,
      ['ali/bubbles'],
      []
    )
  })

  it('stands through a send, and takes the next message too', () => {
    const sendChat = vi.fn()
    const composer = open([BUBBLES, KIMI], sendChat)
    pick('Bubbles')

    fireEvent.change(composer, { target: { value: 'work out the columns' } })
    fireEvent.click(screen.getByLabelText('Send'))
    expect(screen.getByLabelText('Stop sending to Bubbles')).toBeTruthy()

    fireEvent.change(composer, { target: { value: 'and the rows' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenNthCalledWith(2, 'and the rows', undefined, undefined, undefined, ['ali/bubbles'], [])
  })

  it('is swapped rather than stacked when another is picked', () => {
    open()
    pick('Bubbles')
    pick('Kimi')

    expect(screen.queryByLabelText('Stop sending to Bubbles')).toBeNull()
    expect(screen.getByLabelText('Stop sending to Kimi')).toBeTruthy()
  })

  it('offers nobody to pick with nobody here', () => {
    open([agent('ali/away', 'Away', 'offline')])

    fireEvent.click(screen.getByLabelText('Add to your message'))
    expect(screen.queryByText('Default agent')).toBeNull()
    expect(screen.getByText('Upload a file')).toBeTruthy()
  })

  it('draws no chip for an agent the crew has nothing for', () => {
    useDefaultAgent.setState({ agentId: 'ali/bubbles' })
    open([])

    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).not.toContain('Bubbles')
    // The agents arrive with the welcome, so the choice is still there for the
    // moment they do.
    expect(useDefaultAgent.getState().agentId).toBe('ali/bubbles')
  })

  it('belongs to the project it was picked in', () => {
    open()
    pick('Bubbles')

    act(() => useCrew.setState({ place: 'project:/tmp/two' }))
    expect(screen.queryByLabelText('Stop sending to Bubbles')).toBeNull()

    act(() => useCrew.setState({ place: PLACE }))
    expect(screen.getByLabelText('Stop sending to Bubbles')).toBeTruthy()
  })
})

describe('who a message goes to', () => {
  it('takes the standing agent when the words name nobody', () => {
    expect(aimOf('tidy the readme', [BUBBLES, KIMI], 'ali/bubbles')).toEqual(['ali/bubbles'])
  })

  it('is whoever was named outright', () => {
    expect(aimOf('@Kimi have a look', [BUBBLES, KIMI], 'ali/bubbles')).toBeUndefined()
  })

  it('takes nothing from an agent that is not here', () => {
    const away = agent('ali/bubbles', 'Bubbles', 'offline')
    expect(aimOf('tidy the readme', [away, KIMI], 'ali/bubbles')).toBeUndefined()
  })

  it('takes nothing with nobody standing', () => {
    expect(aimOf('tidy the readme', [BUBBLES], null)).toBeUndefined()
  })
})
