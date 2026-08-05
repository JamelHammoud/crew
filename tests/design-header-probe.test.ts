// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext, createTLStore } from '../src/renderer/src/canvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import { HandTool, SelectTool } from '../src/renderer/src/canvas/tools'
import { LEFT_PANEL_W, NAME_PAD, RIGHT_PANEL_W } from '../src/renderer/src/design/headerBand'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { HEADER_EDGE, useHeaderSlot, type HeaderPlace } from '../src/renderer/src/state/headerSlot'
import { SIDEBAR_W, useSidebar } from '../src/renderer/src/state/sidebar'
import { useCrew } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { default: DesignHeader } = await import('../src/renderer/src/components/DesignHeader')
const { DesignBoardContext } = await import('../src/renderer/src/components/DesignPanels')

const PLACES: HeaderPlace[] = ['backdrop', 'left', 'center', 'right']

const BOTH = { left: true, right: true }
const NEITHER = { left: false, right: false }

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

function slots(): Record<HeaderPlace, HTMLElement> {
  const made = {} as Record<HeaderPlace, HTMLElement>
  const nodes = {} as Record<HeaderPlace, HTMLElement>
  for (const place of PLACES) {
    const node = document.createElement('div')
    document.body.appendChild(node)
    made[place] = node
    nodes[place] = node
  }
  useHeaderSlot.setState({ nodes })
  return made
}

function stand(editor: Editor | null, panels = NEITHER): ReactNode {
  useCrew.setState({ boards: [{ id: 'b1', name: 'App design' }] })
  return createElement(
    EditorContext.Provider,
    { value: editor },
    createElement(
      DesignBoardContext.Provider,
      { value: { current: 'b1', select: () => {} } },
      createElement(DesignHeader, { editor, panels })
    )
  )
}

afterEach(() => {
  cleanup()
  useHeaderSlot.setState({
    nodes: { backdrop: null, left: null, center: null, right: null },
    corner: 0,
    own: 0
  })
  useSidebar.setState({ pinned: false })
  useCrew.setState({ boards: [] })
})

describe('the design header', () => {
  it('stands the board at one end of the app header and the view controls at the other', () => {
    const held = slots()
    render(stand(board()))

    const name = screen.getByRole('button', { name: /App design/ })
    const undo = screen.getByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })
    const zoom = screen.getByRole('button', { name: 'Zoom' })

    expect(held.left.contains(name)).toBe(true)
    for (const control of [undo, redo, zoom]) expect(held.right.contains(control)).toBe(true)
    expect(held.center.querySelector('button')).toBeNull()

    const order = [...held.right.querySelectorAll<HTMLElement>('button')]
    expect(order.indexOf(undo)).toBeLessThan(order.indexOf(redo))
    expect(order.indexOf(redo)).toBeLessThan(order.indexOf(zoom))
  })

  it('holds no way to a panel, since a panel is asked back from the board itself', () => {
    slots()
    render(stand(board()))

    expect(screen.queryByRole('button', { name: /layers/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /panel/i })).toBeNull()
  })

  it('rules the history off from the zoom, and rules nothing in front of it', () => {
    const held = slots()
    render(stand(board()))

    const marks = [...held.right.querySelectorAll<HTMLElement>('span')].filter(span =>
      span.className.includes('w-px')
    )
    expect(marks.length).toBe(1)

    const redo = screen.getByRole('button', { name: 'Redo' })
    const zoom = screen.getByRole('button', { name: 'Zoom' })
    expect(redo.compareDocumentPosition(marks[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(zoom.compareDocumentPosition(marks[0]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('reads the zoom off the board and opens the way to change it', () => {
    const editor = board()
    slots()
    render(stand(editor))

    expect(screen.getByRole('button', { name: 'Zoom' }).textContent).toBe('100%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom' }))
    expect(screen.getByText('Zoom to fit')).toBeTruthy()
    expect(screen.getByText('Zoom in')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('waits for the board before it draws the view controls', () => {
    const held = slots()
    render(stand(null))

    expect(screen.queryByRole('button', { name: 'Zoom' })).toBeNull()
    expect(held.left.querySelector('button')).toBeTruthy()
  })
})

describe('the band behind the design header', () => {
  it('takes the columns of the page under it', () => {
    const held = slots()
    render(stand(board(), BOTH))

    const band = held.backdrop.querySelector('[data-design-band]')!
    const left = band.querySelector<HTMLElement>('[data-design-band-left]')!
    const right = band.querySelector<HTMLElement>('[data-design-band-right]')!

    expect(left.style.width).toBe(`${LEFT_PANEL_W}px`)
    expect(right.style.width).toBe(`${RIGHT_PANEL_W}px`)
    expect(left.className).toContain('border-r')
    expect(right.className).toContain('border-l')
  })

  it('is the canvas alone once both panels are away', () => {
    const held = slots()
    render(stand(board(), NEITHER))

    const band = held.backdrop.querySelector('[data-design-band]')!
    expect(band.querySelector('[data-design-band-left]')).toBeNull()
    expect(band.querySelector('[data-design-band-right]')).toBeNull()
    expect(band.children.length).toBe(1)
  })

  it('reads the canvas colour from the design tokens rather than the chrome', () => {
    const held = slots()
    render(stand(board(), NEITHER))

    const band = held.backdrop.querySelector<HTMLElement>('[data-design-band]')!
    expect(band.className).toContain('design')
    expect(band.querySelector('.bg-\\[var\\(--design-canvas\\)\\]')).toBeTruthy()
  })
})

describe('where the design controls stand', () => {
  it('puts the board name at the canvas edge, past the room the window corner takes', () => {
    useHeaderSlot.setState({ corner: 206 })
    const held = slots()
    render(stand(board(), BOTH))

    const room = 206 - HEADER_EDGE
    const name = held.left.querySelector<HTMLElement>('[data-design-name]')!
    expect(name.style.paddingLeft).toBe(`${LEFT_PANEL_W + NAME_PAD - HEADER_EDGE - room}px`)
    expect(name.style.marginLeft).toBe(`-${NAME_PAD}px`)
  })

  it('takes the corner for nothing once it stands over the rail', () => {
    useHeaderSlot.setState({ corner: 206 })
    useSidebar.setState({ pinned: true })
    const held = slots()
    render(stand(board(), BOTH))

    const name = held.left.querySelector<HTMLElement>('[data-design-name]')!
    expect(SIDEBAR_W).toBeGreaterThan(206)
    expect(name.style.paddingLeft).toBe(`${LEFT_PANEL_W + NAME_PAD - HEADER_EDGE}px`)
  })

  it('places the name by its letters rather than by the pill they stand in', () => {
    useHeaderSlot.setState({ corner: 206 })
    useSidebar.setState({ pinned: true })
    const held = slots()
    render(stand(board(), BOTH))

    const name = held.left.querySelector<HTMLElement>('[data-design-name]')!
    const box = -NAME_PAD + Number.parseInt(name.style.paddingLeft, 10)
    expect(box).toBe(LEFT_PANEL_W - HEADER_EDGE)
  })

  it('leaves the name where the header put it once the layers are away', () => {
    useHeaderSlot.setState({ corner: 206 })
    const held = slots()
    render(stand(board(), NEITHER))

    const name = held.left.querySelector<HTMLElement>('[data-design-name]')!
    expect(name.style.paddingLeft).toBe('0px')
    expect(name.style.marginLeft).toBe(`-${NAME_PAD}px`)
  })

  it('stands the view controls at the canvas edge, in front of the faces', () => {
    useHeaderSlot.setState({ own: 180 })
    const held = slots()
    render(stand(board(), BOTH))

    const tools = held.right.querySelector<HTMLElement>('[data-design-tools]')!
    expect(tools.style.paddingRight).toBe(`${RIGHT_PANEL_W - HEADER_EDGE - 180}px`)
  })

  it('closes the view controls up on the faces once the chat is away', () => {
    useHeaderSlot.setState({ own: 180 })
    const held = slots()
    render(stand(board(), NEITHER))

    const tools = held.right.querySelector<HTMLElement>('[data-design-tools]')!
    expect(tools.style.paddingRight).toBe('0px')
  })

  it('never pulls a control back past the edge it is measured from', () => {
    useHeaderSlot.setState({ own: 400, corner: 900 })
    const held = slots()
    render(stand(board(), BOTH))

    const name = held.left.querySelector<HTMLElement>('[data-design-name]')!
    const tools = held.right.querySelector<HTMLElement>('[data-design-tools]')!
    expect(name.style.paddingLeft).toBe('0px')
    expect(tools.style.paddingRight).toBe('0px')
  })
})
