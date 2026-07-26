// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorContext, type Editor } from 'tldraw'
import { nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'
import { installLocalStorage } from './helpers/local-storage'

afterEach(cleanup)

const storage = installLocalStorage()

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { default: DesignAskBar } = await import('../src/renderer/src/components/DesignAskBar')
const { useCrew } = await import('../src/renderer/src/state/store')
const { agentToAsk, askPrompt, lastAskAgent, rememberAskAgent } = await import('../src/renderer/src/design/askAgent')
const { mentionsIn } = await import('../src/shared/llm')

const node = (id: string, name: string): FakeShape => ({
  id,
  type: 'design-node',
  parentId: 'page:main',
  props: { ...nodeDefaults(), name }
})

const agent = (id: string, label: string, status = 'idle') =>
  ({
    id,
    label,
    provider: 'claude',
    ownerId: 'jamel',
    ownerName: 'Jamel',
    status,
    runs: {},
    settings: {},
    fields: []
  }) as never

const thread = (id: string, agentId: string, status = 'open') =>
  ({ id, agentId, agentLabel: agentId, title: id, createdBy: 'ALI', status, mode: 'build', boardId: 'board:a' }) as never

interface Sent {
  text: string
  threadId?: string
  boardId?: string
  aimedAt?: string[]
}

interface PageBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface BootOptions {
  selected?: string[]
  agents?: unknown[]
  threads?: Record<string, unknown>
  bounds?: PageBounds | null
  stage?: { w: number; h: number }
}

const SHAPE: PageBounds = { minX: 500, minY: 400, maxX: 800, maxY: 480 }

function boot(selected: string[] = ['shape:a'], options: BootOptions = {}) {
  const sent: Sent[] = []
  let asked = 0
  const made = fakeBoard([node('shape:a', 'Card'), node('shape:b', 'Label')])
  made.select(...selected)
  const bounds = options.bounds === undefined ? SHAPE : options.bounds
  const stage = options.stage ?? { w: 1200, h: 800 }
  const editor = {
    ...made.editor,
    getSelectionPageBounds: () => bounds,
    getViewportScreenBounds: () => ({ x: 0, y: 0, ...stage }),
    pageToViewport: ({ x, y }: { x: number; y: number }) => ({ x: x - 460, y: y - 380 })
  } as unknown as Editor
  useCrew.setState({
    agents: options.agents ?? [agent('agent:bubbles', 'Bubbles'), agent('agent:fable', 'Fable')],
    threads: options.threads ?? {},
    pending: {},
    sendChat: (text: string, threadId?: string, boardId?: string, _replyTo?: string, aimedAt?: string[]) =>
      sent.push({ text, threadId, boardId, aimedAt })
  } as never)
  const view = render(
    createElement(
      EditorContext.Provider,
      { value: editor },
      createElement(DesignAskBar, {
        boardId: 'board:a',
        open: true,
        onClose: () => {},
        onSent: () => {
          asked += 1
        }
      })
    )
  )
  return { sent, view, made, asked: () => asked }
}

function ask(what: string) {
  const input = screen.getByPlaceholderText('Ask for a change')
  fireEvent.change(input, { target: { value: what } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('the ask bar', () => {
  beforeEach(() => storage.clear())

  it('stays out of the way until it is asked for', () => {
    const made = fakeBoard([node('shape:a', 'Card')])
    made.select('shape:a')
    useCrew.setState({ agents: [agent('agent:bubbles', 'Bubbles')], threads: {}, pending: {} } as never)
    const { container } = render(
      createElement(
        EditorContext.Provider,
        {
          value: {
            ...made.editor,
            getSelectionPageBounds: () => ({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
            pageToViewport: ({ x, y }: { x: number; y: number }) => ({ x, y })
          } as unknown as Editor
        },
        createElement(DesignAskBar, { boardId: 'board:a', open: false, onClose: () => {} })
      )
    )
    expect(container.textContent).toBe('')
  })

  it('asks for a change rather than echoing what was picked', () => {
    boot()
    expect(screen.getByPlaceholderText('Ask for a change')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Card')
  })

  it('stands under the shape it is asking about, in the stage’s own coordinates', () => {
    const { view } = boot()
    const bar = view.container.querySelector('.animate-pop') as HTMLElement
    expect(bar.style.left).toBe('40px')
    expect(bar.style.top).toBe('112px')
  })

  it('stands above a shape whose bottom edge is off the stage', () => {
    const { view } = boot(['shape:a'], { bounds: { minX: 500, minY: 600, maxX: 800, maxY: 1600 } })
    const bar = view.container.querySelector('.animate-pop') as HTMLElement
    expect(bar.style.top).toBe('208px')
  })

  it('never leaves the stage, whatever is picked', () => {
    const cases: PageBounds[] = [
      { minX: 2000, minY: 400, maxX: 2400, maxY: 480 },
      { minX: 500, minY: 1600, maxX: 800, maxY: 2000 },
      { minX: -900, minY: -800, maxX: -400, maxY: -600 },
      { minX: 460, minY: 380, maxX: 1660, maxY: 1180 }
    ]
    for (const bounds of cases) {
      const { view } = boot(['shape:a'], { bounds })
      const bar = view.container.querySelector('.animate-pop') as HTMLElement
      const left = Number.parseInt(bar.style.left, 10)
      const top = Number.parseInt(bar.style.top, 10)
      expect(left, `left for ${JSON.stringify(bounds)}`).toBeGreaterThanOrEqual(0)
      expect(left + 320, `right for ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(1200)
      expect(top, `top for ${JSON.stringify(bounds)}`).toBeGreaterThanOrEqual(0)
      expect(top + 48, `bottom for ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(800 - 72)
      cleanup()
    }
  })

  it('comes up even when the selection has no bounds to hang from', () => {
    const { view } = boot(['shape:a'], { bounds: null })
    expect(screen.getByPlaceholderText('Ask for a change')).toBeTruthy()
    const bar = view.container.querySelector('.animate-pop') as HTMLElement
    expect(bar.style.left).toBe('440px')
    expect(bar.style.top).toBe('668px')
  })

  it('keeps what it was asked about when the selection goes', () => {
    const { sent, made } = boot(['shape:a'])
    made.select()
    ask('make it round')
    expect(screen.getByPlaceholderText('Ask for a change')).toBeTruthy()
    expect(sent[0].text).toContain('Card')
  })

  it('carries an attachment button and no record button', () => {
    boot()
    expect(screen.getByLabelText('Add an image')).toBeTruthy()
    expect(screen.queryByLabelText(/record/i)).toBe(null)
  })

  it('sends on Enter, naming the agent and what to change', () => {
    const { sent } = boot(['shape:a', 'shape:b'])
    const input = screen.getByPlaceholderText('Ask for a change')
    fireEvent.change(input, { target: { value: 'make this bolder' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sent).toHaveLength(1)
    expect(sent[0].text).toContain('@Bubbles make this bolder')
    expect(sent[0].text).toContain('Card, Label')
    expect(sent[0].boardId).toBe('board:a')
  })

  it('sends nothing when there is nothing to say', () => {
    const { sent } = boot()
    fireEvent.keyDown(screen.getByPlaceholderText('Ask for a change'), { key: 'Enter' })
    expect(sent).toHaveLength(0)
  })

  it('wears the agent as its orb and remembers the one you pick', () => {
    const { sent } = boot()
    fireEvent.click(screen.getByLabelText('Pick an agent'))
    fireEvent.click(screen.getByText('Fable'))
    expect(lastAskAgent()).toBe('agent:fable')
    ask('try again')
    expect(sent[0].aimedAt).toEqual(['agent:fable'])
  })

  it('aims the ask at the agent itself, not at the name written in it', () => {
    const { sent } = boot()
    ask('make it round')
    expect(sent[0].aimedAt).toEqual(['agent:bubbles'])
  })

  it('says the ask went out so the board chat can come up on it', () => {
    const { asked } = boot()
    ask('make it round')
    expect(asked()).toBe(1)
  })

  it('only ever asks an agent that is here', () => {
    rememberAskAgent('agent:gone')
    const { sent } = boot(['shape:a'], {
      agents: [agent('agent:gone', 'Gone', 'offline'), agent('agent:fable', 'Fable')]
    })
    fireEvent.click(screen.getByLabelText('Pick an agent'))
    expect(screen.queryByText('Gone')).toBe(null)
    ask('make it round')
    expect(sent[0].aimedAt).toEqual(['agent:fable'])
    expect(sent[0].text).toContain('@Fable')
  })

  it('says so plainly when there is nobody to ask', () => {
    boot(['shape:a'], { agents: [agent('agent:gone', 'Gone', 'offline')] })
    expect(screen.queryByPlaceholderText('Ask for a change')).toBe(null)
    expect(document.body.textContent).toContain('No agents are here')
  })

  it('carries on in the agent’s own thread rather than taking over another', () => {
    const { sent } = boot(['shape:a'], {
      threads: {
        't1': thread('t1', 'agent:fable'),
        't2': thread('t2', 'agent:bubbles'),
        't3': thread('t3', 'agent:bubbles', 'archived')
      }
    })
    ask('make it round')
    expect(sent[0].threadId).toBe('t2')
    expect(sent[0].boardId).toBe(undefined)
  })
})

describe('who the ask bar can reach', () => {
  it('passes over an agent that has gone offline', () => {
    const agents = [agent('a', 'Away', 'offline'), agent('b', 'Here')] as Array<{ id: string; status: string }>
    expect(agentToAsk(agents, 'a')?.id).toBe('b')
    expect(agentToAsk(agents, null)?.id).toBe('b')
    expect(agentToAsk([agents[0]], null)).toBe(null)
  })
})

describe('what the ask bar says to the agent', () => {
  it('names the agent first so the message reaches it', () => {
    expect(askPrompt('Bubbles', 'make it round', ['Card'])).toBe(
      '@Bubbles make it round\n\nOn this board, change: Card'
    )
  })

  it('leaves the layers out when there are none to name', () => {
    expect(askPrompt('Bubbles', 'add a header', [])).toBe('@Bubbles add a header')
  })

  it('is why the ask carries the id: a written name is not always readable back', () => {
    const written = askPrompt('Bubbles', 'make it round', [])
    expect(mentionsIn(written, [{ id: 'agent:bubbles', label: 'Bubbles', status: 'idle' }])).toEqual(['agent:bubbles'])
    expect(mentionsIn(written, [{ id: 'agent:bubbles', label: 'Bubbles', status: 'offline' }])).toEqual([])
    expect(mentionsIn(written, [{ id: 'agent:bubbles', label: 'Bubbles 2', status: 'idle' }])).toEqual([])
  })
})
