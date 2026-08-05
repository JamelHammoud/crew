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

function stand(editor: Editor, panels: { left: boolean; right: boolean }, onPanels = () => {}): ReactNode {
  useCrew.setState({ boards: [{ id: 'b1', name: 'App design' }] })
  return createElement(
    EditorContext.Provider,
    { value: editor },
    createElement(
      DesignBoardContext.Provider,
      { value: { current: 'b1', select: () => {} } },
      createElement(DesignHeader, { editor, panels, onPanels })
    )
  )
}

afterEach(() => {
  cleanup()
  useHeaderSlot.setState({ node: null })
  useCrew.setState({ boards: [] })
})

describe('the design header', () => {
  it('stands the board and its two panels in the app header, with no bar of its own', () => {
    const held = slot()
    render(stand(board(), { left: true, right: true }))

    const layers = screen.getByRole('button', { name: 'Hide layers' })
    const name = screen.getByRole('button', { name: /App design/ })
    const zoom = screen.getByRole('button', { name: 'Zoom' })
    const chat = screen.getByRole('button', { name: 'Hide board panel' })

    for (const control of [layers, name, zoom, chat]) expect(held.contains(control)).toBe(true)

    const order = [...held.querySelectorAll<HTMLElement>('button')]
    expect(order.indexOf(layers)).toBeLessThan(order.indexOf(name))
    expect(order.indexOf(name)).toBeLessThan(order.indexOf(zoom))
    expect(order.indexOf(zoom)).toBeLessThan(order.indexOf(chat))
  })

  it('says which panel is away and asks for it back', () => {
    slot()
    let panels = { left: false, right: false }
    const { rerender } = render(stand(board(), panels, next => (panels = next(panels))))

    fireEvent.click(screen.getByRole('button', { name: 'Show layers' }))
    expect(panels.left).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Show board panel' }))
    expect(panels.right).toBe(true)

    rerender(stand(board(), panels))
    expect(screen.getByRole('button', { name: 'Hide layers' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide board panel' })).toBeTruthy()
  })

  it('reads the zoom off the board and opens the way to change it', () => {
    const editor = board()
    slot()
    render(stand(editor, { left: true, right: true }))

    expect(screen.getByRole('button', { name: 'Zoom' }).textContent).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom' }))
    expect(screen.getByText('Zoom to fit')).toBeTruthy()
    expect(screen.getByText('Zoom in')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('waits for the board before it draws the view controls', () => {
    const held = slot()
    render(stand(board(), { left: true, right: true }))
    expect(screen.queryByRole('button', { name: 'Zoom' })).not.toBeNull()

    cleanup()
    useHeaderSlot.setState({ node: held })
    render(
      createElement(
        DesignBoardContext.Provider,
        { value: { current: 'b1', select: () => {} } },
        createElement(DesignHeader, { editor: null, panels: { left: true, right: true }, onPanels: () => {} })
      )
    )
    expect(screen.queryByRole('button', { name: 'Zoom' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Hide layers' })).toBeTruthy()
  })
})
