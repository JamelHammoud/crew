// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Editor } from '../src/renderer/src/canvas'

const { default: SelectionOverlay } = await import('../src/renderer/src/design/SelectionOverlay')

const WIDTH = 200
const HEIGHT = 160

function boardWith(radius: number) {
  const shape = {
    id: 'shape:card',
    type: 'design-node',
    rotation: 0,
    props: { w: WIDTH, h: HEIGHT, radius: [radius, radius, radius, radius] }
  }
  const editor = {
    getEditingShapeId: () => null,
    overlays: { getOverlayUtil: () => ({ isActive: () => true }) },
    getSelectedShapes: () => [shape],
    getSelectionPageBounds: () => ({ minX: 0, minY: 0, maxX: WIDTH, maxY: HEIGHT, w: WIDTH, h: HEIGHT }),
    getShapePageBounds: () => ({ minX: 0, minY: 0, maxX: WIDTH, maxY: HEIGHT, w: WIDTH, h: HEIGHT }),
    pageToViewport: (point: { x: number; y: number }) => point,
    screenToPage: (point: { x: number; y: number }) => point,
    getZoomLevel: () => 1,
    getCurrentTheme: () => ({ colors: { light: { selectionStroke: '#0d99ff' } } }),
    getColorMode: () => 'light',
    markHistoryStoppingPoint: () => 'mark',
    squashToMark: () => undefined,
    updateShape: (partial: { props: { radius: number[] } }) => {
      shape.props.radius = partial.props.radius
    }
  } as unknown as Editor
  return { editor, radiusNow: () => shape.props.radius[0] }
}

function pointerAt(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

function press(handle: Element, x: number, y: number) {
  handle.dispatchEvent(pointerAt('pointerdown', x, y))
}

beforeAll(() => {
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
})

function topLeftHandle(container: HTMLElement) {
  return container.querySelector('[aria-label="Top left corner"]')!
}

describe('design corner radius handle', () => {
  it('stands where the radius is', () => {
    const { editor } = boardWith(40)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    const style = topLeftHandle(container).getAttribute('style') ?? ''
    expect(style).toContain('left: 40px')
    expect(style).toContain('top: 40px')
  })

  it('keeps its room at the corner when there is no radius to stand on', () => {
    const { editor } = boardWith(0)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    const style = topLeftHandle(container).getAttribute('style') ?? ''
    expect(style).toContain('left: 11px')
    expect(style).toContain('top: 11px')
  })

  it('does not jump when the handle is taken hold of', () => {
    const { editor, radiusNow } = boardWith(0)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 11, 11)
    window.dispatchEvent(pointerAt('pointermove', 12, 12))
    expect(radiusNow()).toBe(1)
    window.dispatchEvent(pointerAt('pointerup', 12, 12))
  })

  it('keeps the room it was given out of the radius it reports', () => {
    const { editor, radiusNow } = boardWith(5)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 11, 11)
    window.dispatchEvent(pointerAt('pointermove', 12, 12))
    expect(radiusNow()).toBe(6)
    window.dispatchEvent(pointerAt('pointerup', 12, 12))
  })

  it('follows the pointer down the diagonal, one for one', () => {
    const { editor, radiusNow } = boardWith(12)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 12, 12)
    window.dispatchEvent(pointerAt('pointermove', 32, 32))
    expect(radiusNow()).toBe(32)
    window.dispatchEvent(pointerAt('pointermove', 4, 4))
    expect(radiusNow()).toBe(4)
    window.dispatchEvent(pointerAt('pointerup', 4, 4))
  })

  it('reads a pointer off the diagonal as its place along it', () => {
    const { editor, radiusNow } = boardWith(0)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 11, 11)
    window.dispatchEvent(pointerAt('pointermove', 31, 11))
    expect(radiusNow()).toBe(10)
    window.dispatchEvent(pointerAt('pointerup', 31, 11))
  })

  it('holds the grab where it was taken, whichever corner it is', () => {
    const { editor, radiusNow } = boardWith(20)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    const handle = container.querySelector('[aria-label="Bottom right corner"]')!
    press(handle, WIDTH - 20, HEIGHT - 20)
    expect(radiusNow()).toBe(20)
    window.dispatchEvent(pointerAt('pointermove', WIDTH - 50, HEIGHT - 50))
    expect(radiusNow()).toBe(50)
    window.dispatchEvent(pointerAt('pointerup', WIDTH - 50, HEIGHT - 50))
  })

  it('stops at half the shorter side and never goes under nothing', () => {
    const { editor, radiusNow } = boardWith(0)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 11, 11)
    window.dispatchEvent(pointerAt('pointermove', 400, 400))
    expect(radiusNow()).toBe(HEIGHT / 2)
    window.dispatchEvent(pointerAt('pointermove', -200, -200))
    expect(radiusNow()).toBe(0)
    window.dispatchEvent(pointerAt('pointerup', -200, -200))
  })

  it('lets go of the pointer once the drag is over', () => {
    const { editor, radiusNow } = boardWith(0)
    const { container } = render(createElement(SelectionOverlay, { editor }))
    press(topLeftHandle(container), 11, 11)
    window.dispatchEvent(pointerAt('pointerup', 11, 11))
    window.dispatchEvent(pointerAt('pointermove', 91, 91))
    expect(radiusNow()).toBe(0)
  })
})
