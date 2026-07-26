// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HuddleStage from '../src/renderer/src/components/huddle/HuddleStage'
import { useHuddle } from '../src/renderer/src/state/huddle'
import type { HuddlePeer } from '../src/shared/huddle'
import { installLocalStorage } from './helpers/local-storage'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []
Object.assign(window, {
  crew: {
    screenSources: () => Promise.resolve([]),
    pickScreenSource: () => Promise.resolve(),
    askForMedia: () => Promise.resolve(true),
    openMediaSettings: () => Promise.resolve()
  }
})

installLocalStorage()

const FRAME = { width: 1000, height: 600 }
const SCREEN = { width: 2000, height: 1000 }

const peer = (peerId: string, name: string, extra: Partial<HuddlePeer> = {}): HuddlePeer => ({
  peerId,
  memberId: `m-${peerId}`,
  name,
  muted: false,
  camera: false,
  sharing: false,
  joinedAt: 1,
  ...extra
})

const shared = (): MediaStream => {
  const track = Object.assign(new EventTarget(), { kind: 'video', muted: false, readyState: 'live' })
  return { id: 'screen-1', getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream
}

const stage = () => {
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: FRAME.width })
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', { configurable: true, value: FRAME.height })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: SCREEN.width })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: SCREEN.height })

  useHuddle.setState({
    room: { id: 'call-1', peers: [peer('me', 'Jamel'), peer('a', 'Ali', { sharing: true })], startedAt: 10 },
    peerId: 'me',
    joined: true,
    expanded: true,
    picking: false,
    speaking: [],
    problem: null,
    localCamera: null,
    localScreen: null,
    remote: { a: { mic: null, camera: null, screen: shared() } },
    link: { a: 'connected' }
  })

  const { container } = render(createElement(HuddleStage))
  const frame = container.querySelector('[data-zoom-frame]') as HTMLElement
  frame.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: FRAME.width, height: FRAME.height }) as DOMRect
  const video = container.querySelector('video') as HTMLVideoElement
  act(() => void video.dispatchEvent(new Event('loadedmetadata')))
  return { container, frame, drawn: container.querySelector('[data-zoom-content]') as HTMLElement }
}

const scaleOf = (drawn: HTMLElement): number =>
  Number(/scale\(([\d.]+)\)/.exec(drawn.style.transform)?.[1] ?? 0)

const offsetOf = (drawn: HTMLElement): { x: number; y: number } => {
  const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(drawn.style.transform)
  return { x: Number(match?.[1]), y: Number(match?.[2]) }
}

describe('zooming a shared screen', () => {
  beforeEach(() => {
    useHuddle.setState({ remote: {}, link: {} })
  })

  afterEach(() => {
    cleanup()
  })

  it('draws the screen in a view that can be zoomed', () => {
    const { container, drawn } = stage()

    expect(container.querySelector('[data-zoom-frame] video')).not.toBeNull()
    expect(scaleOf(drawn)).toBe(1)
  })

  it('pinches on the trackpad, either way', () => {
    const { frame, drawn } = stage()

    fireEvent.wheel(frame, { deltaY: -100, ctrlKey: true, clientX: 500, clientY: 300 })
    expect(scaleOf(drawn)).toBeCloseTo(Math.E, 4)

    fireEvent.wheel(frame, { deltaY: 100, ctrlKey: true, clientX: 500, clientY: 300 })
    expect(scaleOf(drawn)).toBeCloseTo(1, 4)
  })

  it('reads the percentage against their real pixels, not the fit', () => {
    const { container, frame, drawn } = stage()

    expect(container.querySelector('button[class*="glass"]')).toBeNull()

    fireEvent.doubleClick(frame, { clientX: 500, clientY: 300 })
    expect(scaleOf(drawn)).toBe(2.5)
    expect(container.querySelector('button[class*="glass"]')?.textContent).toBe('125%')
  })

  it('moves a zoomed screen and holds it inside the frame', () => {
    const { frame, drawn } = stage()

    fireEvent.wheel(frame, { deltaX: 40, deltaY: 40, ctrlKey: false, clientX: 500, clientY: 300 })
    expect(offsetOf(drawn)).toEqual({ x: 0, y: 0 })

    fireEvent.doubleClick(frame, { clientX: 500, clientY: 300 })
    fireEvent.pointerDown(frame, { clientX: 500, clientY: 300, button: 0 })
    fireEvent.pointerMove(frame, { clientX: 470, clientY: 280 })
    expect(offsetOf(drawn)).toEqual({ x: -30, y: -20 })

    fireEvent.wheel(frame, { deltaX: 9000, deltaY: 9000, ctrlKey: false, clientX: 500, clientY: 300 })
    expect(offsetOf(drawn)).toEqual({ x: -750, y: -325 })
  })

  it('goes back to the fit from the percentage', () => {
    const { container, frame, drawn } = stage()

    fireEvent.doubleClick(frame, { clientX: 500, clientY: 300 })
    expect(scaleOf(drawn)).toBeGreaterThan(1)

    fireEvent.click(container.querySelector('button[class*="glass"]') as HTMLElement)
    expect(scaleOf(drawn)).toBe(1)
    expect(offsetOf(drawn)).toEqual({ x: 0, y: 0 })
  })

  it('leaves the waiting card alone until the screen arrives', () => {
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('me', 'Jamel'), peer('a', 'Ali', { sharing: true })], startedAt: 10 },
      peerId: 'me',
      joined: true,
      expanded: true,
      remote: { a: { mic: null, camera: null, screen: null } },
      link: { a: 'connected' }
    })
    const { container } = render(createElement(HuddleStage))

    expect(container.querySelector('[data-zoom-frame]')).toBeNull()
    expect(container.textContent).toContain("Waiting for Ali's screen")
  })
})
