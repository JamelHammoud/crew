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

const agent = (id: string, label: string) =>
  ({
    id,
    label,
    provider: 'claude',
    ownerId: 'jamel',
    ownerName: 'Jamel',
    status: 'idle',
    runs: {},
    settings: {},
    fields: []
  }) as never

interface Sent {
  text: string
  threadId?: string
  boardId?: string
}

function boot(selected: string[] = ['shape:a']) {
  const sent: Sent[] = []
  const made = fakeBoard([node('shape:a', 'Card'), node('shape:b', 'Label')])
  made.select(...selected)
  const editor = {
    ...made.editor,
    getSelectionRotatedScreenBounds: () => ({ x: 100, y: 200, width: 300, height: 80 })
  } as unknown as Editor
  useCrew.setState({
    agents: [agent('agent:bubbles', 'Bubbles'), agent('agent:fable', 'Fable')],
    threads: {},
    pending: {},
    sendChat: (text: string, threadId?: string, boardId?: string) => sent.push({ text, threadId, boardId })
  } as never)
  const view = render(
    createElement(
      EditorContext.Provider,
      { value: editor },
      createElement(DesignAskBar, { boardId: 'board:a', open: true, onClose: () => {} })
    )
  )
  return { sent, view, made }
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
            getSelectionRotatedScreenBounds: () => ({ x: 0, y: 0, width: 10, height: 10 })
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
    boot()
    fireEvent.click(screen.getByLabelText('Pick an agent'))
    fireEvent.click(screen.getByText('Fable'))
    expect(lastAskAgent()).toBe('agent:fable')
    const input = screen.getByPlaceholderText('Ask for a change')
    fireEvent.change(input, { target: { value: 'try again' } })
    fireEvent.keyDown(input, { key: 'Enter' })
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
})
