// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PooledAgent } from '../src/renderer/../shared/llm'
import { aimOf } from '../src/shared/llm'
import { useDefaultAgents } from '../src/renderer/src/state/defaultAgent'
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
  fireEvent.click(screen.getByText('Pick who takes it'))
  fireEvent.click(screen.getByText(label))
}

describe('the agent standing on the chat composer', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
    useDefaultAgents.setState({ aimed: {} })
  })
  afterEach(cleanup)

  it('lands a chip that says who takes it, and takes it off again', () => {
    open()
    pick('Bubbles')

    // The chip stands in the row the plus stands in, the way a command does.
    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).toContain('Bubbles')
    expect(useDefaultAgents.getState().aimed[PLACE]).toBe('ali/bubbles')

    fireEvent.click(screen.getByLabelText('Stop sending to Bubbles'))
    expect(row.textContent).not.toContain('Bubbles')
    expect(useDefaultAgents.getState().aimed[PLACE]).toBeUndefined()
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

  it('stands through a send, where a command does not', () => {
    const composer = open()
    pick('Bubbles')

    fireEvent.change(composer, { target: { value: '/plan ' } })
    fireEvent.change(composer, { target: { value: 'work out the columns' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(useCrew.getState().chatCommands).toEqual([])
    expect(screen.getByLabelText('Stop sending to Bubbles')).toBeTruthy()
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
    expect(screen.queryByText('Pick who takes it')).toBeNull()
    expect(screen.getByText('Upload a file')).toBeTruthy()
  })

  it('draws no chip for an agent the crew has nothing for', () => {
    useDefaultAgents.setState({ aimed: { [PLACE]: 'ali/bubbles' } })
    open([])

    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).not.toContain('Bubbles')
    // The agents arrive with the welcome, so the choice is still there for the
    // moment they do.
    expect(useDefaultAgents.getState().aimed[PLACE]).toBe('ali/bubbles')
  })

  it('is one place's own', () => {
    open()
    pick('Bubbles')

    useCrew.setState({ place: 'project:/tmp/two' })
    expect(screen.queryByLabelText('Stop sending to Bubbles')).toBeNull()

    useCrew.setState({ place: PLACE })
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
