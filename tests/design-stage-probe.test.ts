// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorContext, type Editor } from 'tldraw'
import { nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'
import { installLocalStorage } from './helpers/local-storage'

vi.mock('../src/renderer/src/components/DesignCanvas', () => ({ default: () => null }))
vi.mock('../src/renderer/src/components/DesignToolbar', () => ({ default: () => null }))

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const storage = installLocalStorage()

const { default: DesignStage } = await import('../src/renderer/src/components/DesignStage')
const { useCrew } = await import('../src/renderer/src/state/store')

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

function boot(selected: string[] = ['shape:a']) {
  const made = fakeBoard([node('shape:a', 'Card')])
  made.select(...selected)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const editor = {
    ...made.editor,
    getContainer: () => container,
    screenToPage: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    pageToViewport: ({ x, y }: { x: number; y: number }) => ({ x, y })
  } as unknown as Editor
  useCrew.setState({
    agents: [agent('agent:bubbles', 'Bubbles')],
    threads: {},
    pending: {},
    sendChat: () => {}
  } as never)
  const view = render(
    createElement(
      EditorContext.Provider,
      { value: editor },
      createElement(DesignStage, {
        boardId: 'board:a',
        editor,
        onEditor: () => {},
        onRename: () => {},
        onAsked: () => {}
      })
    )
  )
  return { view, made, container }
}

function rightClick(container: HTMLElement) {
  fireEvent.contextMenu(container, { clientX: 240, clientY: 180 })
}

describe('the design stage', () => {
  afterEach(cleanup)
  beforeEach(() => storage.clear())

  it('opens the right click menu where the pointer is', () => {
    const { container } = boot()
    rightClick(container)
    expect(screen.getByText('Ask an agent')).toBeTruthy()
  })

  it('brings up the ask bar when the menu hands the ask over', () => {
    const { container } = boot()
    rightClick(container)
    fireEvent.click(screen.getByText('Ask an agent'))
    expect(screen.queryByText('Ask an agent')).toBe(null)
    expect(screen.getByPlaceholderText('Ask for a change')).toBeTruthy()
  })
})
