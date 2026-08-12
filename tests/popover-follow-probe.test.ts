// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement as h } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popover } from '../src/renderer/src/components/Popover'

afterEach(cleanup)

let nextFrame = 1
const pending = new Map<number, FrameRequestCallback>()
global.requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = nextFrame++
  pending.set(id, cb)
  return id
}
global.cancelAnimationFrame = (id: number) => {
  pending.delete(id)
}
const frame = (): void => {
  const due = [...pending.values()]
  pending.clear()
  act(() => {
    for (const cb of due) cb(0)
  })
}

const tops = new WeakMap<Element, number>()
Element.prototype.getBoundingClientRect = function (this: Element) {
  const top = tops.get(this) ?? 0
  return {
    x: 0,
    y: top,
    top,
    bottom: top + 20,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
    toJSON: () => ({})
  } as DOMRect
}

const panel = (): HTMLElement => document.querySelector('.glass.fixed') as HTMLElement

describe('a popover while the page under it moves', () => {
  it('follows the anchor it hangs off rather than closing', () => {
    const onClose = vi.fn()
    const view = render(
      h(
        'div',
        { 'data-testid': 'row' },
        h('button', null, 'anchor'),
        h(Popover, { open: true, onClose, children: 'menu' })
      )
    )
    expect(panel().style.top).toBe('28px')

    tops.set(view.getByTestId('row'), 300)
    frame()

    expect(panel().style.top).toBe('328px')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open when something else on the page scrolls', () => {
    const onClose = vi.fn()
    const view = render(
      h(
        'div',
        null,
        h('div', { 'data-testid': 'feed' }, 'thread'),
        h('button', null, 'anchor'),
        h(Popover, { open: true, onClose, children: 'menu' })
      )
    )
    fireEvent.scroll(view.getByTestId('feed'))
    expect(onClose).not.toHaveBeenCalled()
    expect(panel()).toBeTruthy()
  })

  it('carries a menu opened on a point along with what it was opened on', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    tops.set(target, 100)
    document.elementFromPoint = () => target
    const onClose = vi.fn()
    render(h(Popover, { open: true, onClose, at: { x: 10, y: 110 }, children: 'menu' }))
    expect(panel().style.top).toBe('110px')

    tops.set(target, 40)
    frame()

    expect(panel().style.top).toBe('50px')
    expect(onClose).not.toHaveBeenCalled()
    target.remove()
    delete (document as { elementFromPoint?: unknown }).elementFromPoint
  })
})
