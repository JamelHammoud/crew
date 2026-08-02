// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChatMessage from '../src/renderer/src/components/ChatMessage'
import { useAutoResize } from '../src/renderer/src/components/useAutoResize'
import type { ThreadItem } from '../src/renderer/src/components/thread'
import { useCrew } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const WROTE = 'Like a multiplayer game where you go fishing'

function boot(): void {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    docs: {},
    boards: []
  })
}

const mine = (): ThreadItem => ({
  key: 'm1',
  ts: Date.parse('2026-08-01T12:00:00Z'),
  kind: 'message',
  author: 'Jamel',
  authorId: 'jamel',
  self: true,
  text: WROTE,
  streaming: false,
  reactionTargetId: 'm1'
})

function edit(): HTMLTextAreaElement {
  boot()
  const { container } = render(createElement(ChatMessage, { item: mine(), editable: true }))
  fireEvent.contextMenu(container.firstElementChild!)
  fireEvent.click(screen.getByText('Edit message'))
  return container.querySelector('textarea')!
}

describe('editing a message', () => {
  it('never scrolls, so it never draws a bar down its side', () => {
    const box = edit()

    expect(box.style.overflowY).toBe('hidden')
    expect(box.className).toContain('overflow-hidden')
  })

  it('takes focus without carrying the view to it, caret at the end', () => {
    const took = vi.spyOn(HTMLTextAreaElement.prototype, 'focus')
    const box = edit()

    expect(took).toHaveBeenCalledWith({ preventScroll: true })
    expect(box.selectionStart).toBe(WROTE.length)
    expect(box.selectionEnd).toBe(WROTE.length)
  })

  it('grows to the whole message rather than capping it', () => {
    const box = edit()
    Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => 460 })

    fireEvent.change(box, { target: { value: `${WROTE}\nand another line` } })

    expect(box.style.height).toBe('460px')
    expect(box.style.overflowY).toBe('hidden')
  })
})

const ROW = 22
const ABOVE = 900
const VIEW = 400

function stand(box: HTMLTextAreaElement, page: HTMLElement, full: number): void {
  Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => full })
  let height = `${full}px`
  let top = 0
  const max = (): number =>
    Math.max(0, ABOVE + (height === 'auto' ? ROW : parseFloat(height) || 0) - VIEW)
  Object.defineProperty(box.style, 'height', {
    configurable: true,
    get: () => height,
    set: (asked: string) => {
      height = asked
      top = Math.min(top, max())
    }
  })
  Object.defineProperty(page, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (asked: number) => {
      top = Math.max(0, Math.min(asked, max()))
    }
  })
}

function Grower({ text, over = 'auto' }: { text: string; over?: string }): ReactElement {
  const ref = useAutoResize(text, Number.POSITIVE_INFINITY)
  return createElement(
    'div',
    { style: { overflowY: over }, 'data-page': true },
    createElement('textarea', { ref, value: text, rows: 1, readOnly: true })
  )
}

function Typing(): ReactElement {
  const [text, setText] = useState('one')
  return createElement(
    'div',
    null,
    createElement('button', { onClick: () => setText('one two') }, 'type'),
    createElement(Grower, { text })
  )
}

describe('a box that grows inside a scroller', () => {
  it('puts the scroll back where the measure found it', () => {
    const { container } = render(createElement(Typing))
    const page = container.querySelector('[data-page]') as HTMLElement
    const box = container.querySelector('textarea') as HTMLTextAreaElement
    stand(box, page, 500)
    page.scrollTop = ABOVE + 500 - VIEW
    const stood = page.scrollTop

    fireEvent.click(screen.getByText('type'))

    expect(box.style.height).toBe('500px')
    expect(page.scrollTop).toBe(stood)
  })

  it('leaves a box with no scroller over it alone', () => {
    const { container } = render(
      createElement('div', { style: { overflowY: 'visible' } }, createElement(Grower, { text: 'one' }))
    )
    const box = container.querySelector('textarea') as HTMLTextAreaElement

    expect(box.style.overflowY).toBe('hidden')
  })
})
