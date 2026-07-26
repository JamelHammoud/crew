// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

const { FIT, panBy, pinchFactor, settle, zoomBy, zoomPercent } = await import(
  '../src/renderer/src/components/imageZoom'
)
const ImageView = (await import('../src/renderer/src/components/ImageView')).default

const IMAGE = { width: 400, height: 200 }
const FRAME = { width: 800, height: 600 }
const CENTER = { x: 0, y: 0 }

function view() {
  Object.defineProperty(HTMLImageElement.prototype, 'offsetWidth', { configurable: true, value: 400 })
  Object.defineProperty(HTMLImageElement.prototype, 'offsetHeight', { configurable: true, value: 200 })
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', { configurable: true, value: 600 })
  const { container } = render(createElement(ImageView, { src: 'crew.png', alt: 'crew.png' }))
  const frame = container.querySelector('[data-image-frame]') as HTMLElement
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect
  const image = container.querySelector('img') as HTMLImageElement
  fireEvent.load(image)
  return { container, frame, image }
}

const scaleOf = (image: HTMLImageElement): number =>
  Number(/scale\(([\d.]+)\)/.exec(image.style.transform)?.[1] ?? 0)

const offsetOf = (image: HTMLImageElement): { x: number; y: number } => {
  const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(image.style.transform)
  return { x: Number(match?.[1]), y: Number(match?.[2]) }
}

describe('image zoom', () => {
  it('zooms in and out around the pointer', () => {
    const at = { x: 100, y: 50 }
    const zoomed = zoomBy(FIT, 2, at, IMAGE, FRAME)
    expect(zoomed.scale).toBe(2)
    expect(zoomed.x).toBe(-100)
    expect(zoomed.y).toBe(-50)

    const back = zoomBy(zoomed, 0.5, at, IMAGE, FRAME)
    expect(back).toEqual(FIT)
  })

  it('never shrinks below the fit and never passes the ceiling', () => {
    expect(zoomBy(FIT, 0.2, CENTER, IMAGE, FRAME).scale).toBe(1)
    expect(zoomBy({ scale: 30, x: 0, y: 0 }, 4, CENTER, IMAGE, FRAME).scale).toBe(32)
  })

  it('holds the picture inside the frame while panning', () => {
    const zoomed = zoomBy(FIT, 4, CENTER, IMAGE, FRAME)
    const far = panBy(zoomed, 5000, 5000, IMAGE, FRAME)
    expect(far.x).toBe(-400)
    expect(far.y).toBe(-100)

    const other = panBy(zoomed, -5000, -5000, IMAGE, FRAME)
    expect(other.x).toBe(400)
    expect(other.y).toBe(100)
  })

  it('pins the picture in the middle when it fits', () => {
    expect(panBy(FIT, 200, 200, IMAGE, FRAME)).toEqual(FIT)
    expect(settle({ scale: 1, x: 90, y: 90 }, IMAGE, FRAME)).toEqual(FIT)
  })

  it('reads a pinch as a zoom either way', () => {
    expect(pinchFactor(-10)).toBeGreaterThan(1)
    expect(pinchFactor(10)).toBeLessThan(1)
    expect(pinchFactor(0)).toBe(1)
  })

  it('counts the percentage against the real pixels, not the fit', () => {
    expect(zoomPercent(1, 0.5)).toBe(50)
    expect(zoomPercent(4, 0.5)).toBe(200)
  })

  it('pinches on the trackpad in the preview', () => {
    const { frame, image } = view()
    expect(scaleOf(image)).toBe(1)

    fireEvent.wheel(frame, { deltaY: -100, ctrlKey: true, clientX: 400, clientY: 300 })
    expect(scaleOf(image)).toBeCloseTo(Math.E, 4)

    fireEvent.wheel(frame, { deltaY: 100, ctrlKey: true, clientX: 400, clientY: 300 })
    expect(scaleOf(image)).toBeCloseTo(1, 4)
  })

  it('scrolls two fingers to move a zoomed picture, and not a fitted one', () => {
    const { frame, image } = view()

    fireEvent.wheel(frame, { deltaX: 30, deltaY: 30, ctrlKey: false, clientX: 400, clientY: 300 })
    expect(offsetOf(image)).toEqual({ x: 0, y: 0 })

    fireEvent.wheel(frame, { deltaY: -400, ctrlKey: true, clientX: 400, clientY: 300 })
    fireEvent.wheel(frame, { deltaX: 30, deltaY: 30, ctrlKey: false, clientX: 400, clientY: 300 })
    expect(offsetOf(image)).toEqual({ x: -30, y: -30 })
  })

  it('takes a double click back to the fit', () => {
    const { frame, image, container } = view()

    fireEvent.doubleClick(frame, { clientX: 400, clientY: 300 })
    expect(scaleOf(image)).toBe(2.5)
    expect(container.querySelector('button')?.textContent).toBe('125%')

    fireEvent.doubleClick(frame, { clientX: 400, clientY: 300 })
    expect(scaleOf(image)).toBe(1)
    expect(container.querySelector('button')).toBeNull()
  })

  it('drags a zoomed picture with the pointer', () => {
    const { frame, image } = view()

    fireEvent.pointerDown(frame, { clientX: 400, clientY: 300, button: 0 })
    fireEvent.pointerMove(frame, { clientX: 380, clientY: 290 })
    expect(offsetOf(image)).toEqual({ x: 0, y: 0 })

    fireEvent.wheel(frame, { deltaY: -400, ctrlKey: true, clientX: 400, clientY: 300 })
    fireEvent.pointerDown(frame, { clientX: 400, clientY: 300, button: 0 })
    fireEvent.pointerMove(frame, { clientX: 380, clientY: 290 })
    expect(offsetOf(image)).toEqual({ x: -20, y: -10 })

    fireEvent.pointerUp(frame, { clientX: 380, clientY: 290 })
    fireEvent.pointerMove(frame, { clientX: 300, clientY: 200 })
    expect(offsetOf(image)).toEqual({ x: -20, y: -10 })
  })

  it('goes back to the fit when another picture opens', () => {
    const { frame, image, container } = view()

    fireEvent.wheel(frame, { deltaY: -200, ctrlKey: true, clientX: 400, clientY: 300 })
    expect(scaleOf(image)).toBeGreaterThan(1)

    render(createElement(ImageView, { src: 'other.png', alt: 'other.png' }), { container })
    expect(scaleOf(container.querySelector('img') as HTMLImageElement)).toBe(1)
  })
})
