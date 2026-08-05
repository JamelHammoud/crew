// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext, createTLStore } from '../src/renderer/src/canvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import { HandTool, SelectTool } from '../src/renderer/src/canvas/tools'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { useHeaderSlot } from '../src/renderer/src/state/headerSlot'
import { useCrew } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { default: DesignHeader } = await import('../src/renderer/src/components/DesignHeader')
const { DesignBoardContext } = await import('../src/renderer/src/components/DesignPanels')

function board(): Editor {
  const editor = new Editor({
    store: createTLStore({ id: 'design-header', shapeUtils: designShapeUtils }),
    shapeUtils: designShapeUtils,
    tools: [SelectTool, HandTool],
    getContainer: () => document.body
  })
  editor.setViewportScreenBounds({ x: 0, y: 0, w: 900, h: 700 })
  return editor
}

function slot(): HTMLElement {
  const node = document.createElement('div')
  document.body.appendChild(node)
  useHeaderSlot.setState({ node })
  return node
}

function stand(editor: Editor | null): ReactNode {
  useCrew.setState({ boards: [{ id: 'b1', name: 'App design' }] })
  return createElement(
    EditorContext.Provider,
    { value: editor },
    createElement(
      DesignBoardContext.Provider,
      { value: { current: 'b1', select: () => {} } },
      createElement(DesignHeader, { editor })
    )
  )
}

afterEach(() => {
  cleanup()
  useHeaderSlot.setState({ node: null })
  useCrew.setState({ boards: [] })
})

describe('the design header', () => {
  it('stands the board and what it is being looked at with in the app header', () => {
    const held = slot()
    render(stand(board()))

    const name = screen.getByRole('button', { name: /App design/ })
    const undo = screen.getByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })
    const zoom = screen.getByRole('button', { name: 'Zoom' })

    for (const control of [name, undo, redo, zoom]) expect(held.contains(control)).toBe(true)

    const order = [...held.querySelectorAll<HTMLElement>('button')]
    expect(order.indexOf(name)).toBeLessThan(order.indexOf(undo))
    expect(order.indexOf(undo)).toBeLessThan(order.indexOf(redo))
    expect(order.indexOf(redo)).toBeLessThan(order.indexOf(zoom))
  })

  it('holds no way to a panel, since a panel is asked back from the board itself', () => {
    slot()
    render(stand(board()))

    expect(screen.queryByRole('button', { name: /layers/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /panel/i })).toBeNull()
  })

  it('rules the history off from the zoom', () => {
    const held = slot()
    render(stand(board()))

    const marks = [...held.querySelectorAll<HTMLElement>('span')].filter(span =>
      span.className.includes('w-px')
    )
    const redo = screen.getByRole('button', { name: 'Redo' })
    const zoom = screen.getByRole('button', { name: 'Zoom' })
    const between = marks.filter(
      mark =>
        redo.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING &&
        zoom.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_PRECEDING
    )
    expect(between.length).toBe(1)
  })

  it('reads the zoom off the board and opens the way to change it', () => {
    const editor = board()
    slot()
    render(stand(editor))

    expect(screen.getByRole('button', { name: 'Zoom' }).textContent).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom' }))
    expect(screen.getByText('Zoom to fit')).toBeTruthy()
    expect(screen.getByText('Zoom in')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('waits for the board before it draws the view controls', () => {
    slot()
    render(stand(null))

    expect(screen.queryByRole('button', { name: 'Zoom' })).toBeNull()
    expect(screen.getByRole('button', { name: /App design/ })).toBeTruthy()
  })
})
