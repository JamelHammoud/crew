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

// Somewhere for the choice to be kept, since this environment has none of its
// own and the whole of what is being read is what survives a window.
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
  fireEvent.click(screen.getByText('Agent'))
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

  // A real click stands on the row it landed on, so the row is focused by hand
  // here: jsdom moves the caret for neither a press nor an unmount, and the
  // composer is left focused by the press that opened the menu without it.
  it('leaves the caret in the box it just aimed', () => {
    const composer = open()
    fireEvent.click(screen.getByLabelText('Add to your message'))
    fireEvent.click(screen.getByText('Agent'))
    const row = screen.getByText('Bubbles').closest('button') as HTMLButtonElement
    row.focus()
    fireEvent.click(row)

    expect(document.activeElement).toBe(composer)
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

  it('carries the plus from its rows to the faces in one movement', () => {
    open()
    fireEvent.click(screen.getByLabelText('Add to your message'))

    const box = document.querySelector('.glass.fixed > div') as HTMLElement
    expect(box.className).toContain('transition-[height,width]')
    expect((box.firstElementChild as HTMLElement).className).toContain('w-max')
    expect((box.firstElementChild as HTMLElement).className).not.toContain('animate-screen')

    fireEvent.click(screen.getByText('Agent'))

    const arriving = box.firstElementChild as HTMLElement
    expect(arriving.className).toContain('animate-screen')
    expect(arriving.textContent).toContain('Bubbles')
    expect(screen.queryByText('Upload a file')).toBeNull()
  })

  it('offers nobody to pick with nobody here', () => {
    open([agent('ali/away', 'Away', 'offline')])

    fireEvent.click(screen.getByLabelText('Add to your message'))
    expect(screen.queryByText('Agent')).toBeNull()
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

  it('stands in whatever project you walk into', () => {
    open()
    pick('Bubbles')

    act(() => useCrew.setState({ place: 'project:/tmp/two' }))
    expect(screen.getByLabelText('Stop sending to Bubbles')).toBeTruthy()
  })

  it('is read back off this machine, and an older record is nobody', async () => {
    open()
    pick('Bubbles')
    expect(globalThis.localStorage.getItem('crew.default-agent')).toBe(JSON.stringify('ali/bubbles'))

    const held = async () => {
      vi.resetModules()
      return (await import('../src/renderer/src/state/defaultAgent')).useDefaultAgent.getState().agentId
    }
    expect(await held()).toBe('ali/bubbles')

    globalThis.localStorage.setItem('crew.default-agent', JSON.stringify({ [PLACE]: 'ali/bubbles' }))
    expect(await held()).toBeNull()
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
