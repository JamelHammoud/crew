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
  const stage = (boardId: string) =>
    createElement(
      EditorContext.Provider,
      { value: editor },
      createElement(DesignStage, {
        boardId,
        editor,
        onEditor: () => {},
        onRename: () => {},
        onAsked: () => {}
      })
    )
  const view = render(stage('board:a'))
  return { view, made, container, rerender: (boardId: string) => view.rerender(stage(boardId)) }
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

  it('carries the shortcut the menu row promises', () => {
    const { container } = boot()
    rightClick(container)
    const row = [...document.querySelectorAll('button')].find(el => el.textContent?.startsWith('Ask an agent'))
    expect(row?.textContent).toContain('⇧⌘A')
  })

  it('brings up the ask bar on the shortcut alone', () => {
    boot()
    fireEvent.keyDown(window, { key: 'A', metaKey: true, shiftKey: true })
    expect(screen.getByPlaceholderText('Ask for a change')).toBeTruthy()
  })

  it('asks nothing when nothing is picked', () => {
    boot([])
    fireEvent.keyDown(window, { key: 'A', metaKey: true, shiftKey: true })
    expect(screen.queryByPlaceholderText('Ask for a change')).toBe(null)
  })

  it('leaves the shortcut alone while something is being typed into', () => {
    boot()
    const field = document.createElement('input')
    document.body.appendChild(field)
    fireEvent.keyDown(field, { key: 'A', metaKey: true, shiftKey: true })
    expect(screen.queryByPlaceholderText('Ask for a change')).toBe(null)
  })

  it('runs the other shortcuts the menu names', () => {
    const { made } = boot()
    fireEvent.keyDown(window, { key: 'L', metaKey: true, shiftKey: true })
    expect(made.calls).toContain('toggleLock(shape:a)')
  })

  it('puts the ask away when the board changes under it', () => {
    const { container, rerender } = boot()
    rightClick(container)
    fireEvent.click(screen.getByText('Ask an agent'))
    rerender('board:b')
    expect(screen.queryByPlaceholderText('Ask for a change')).toBe(null)
  })
})
