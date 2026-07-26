// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Popover } from '../src/renderer/src/components/Popover'
import FontPicker from '../src/renderer/src/design/FontPicker'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(): number {
    const own = (this as HTMLElement).dataset.tall
    if (own) return Number(own)
    return Array.from((this as HTMLElement).children).reduce(
      (total, kid) => total + (Number((kid as HTMLElement).offsetHeight) || 0),
      0
    )
  }
})

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value(this: HTMLElement): DOMRect {
    const top = Number((this as HTMLElement).dataset.at)
    if (Number.isNaN(top)) return new DOMRect()
    return { top, bottom: top + 32, left: 100, right: 300, width: 200, height: 32 } as DOMRect
  }
})

function harness(at: number, tall: number) {
  return createElement(
    'div',
    { 'data-at': at },
    createElement(Popover, {
      open: true,
      onClose: () => {},
      align: 'start',
      children: createElement('div', { 'data-tall': tall })
    })
  )
}

function placed(): { top: number; bottom: number } {
  const pop = document.querySelector('.glass') as HTMLElement
  const top = Number.parseInt(pop.style.top, 10)
  return { top, bottom: top + pop.offsetHeight }
}

afterEach(cleanup)

describe('popover placement', () => {
  it('keeps its bottom against a trigger it opens above as the content shrinks', () => {
    const { rerender } = render(harness(700, 400))
    expect(placed()).toEqual({ top: 292, bottom: 692 })
    rerender(harness(700, 120))
    expect(placed()).toEqual({ top: 572, bottom: 692 })
  })

  it('keeps its top against a trigger it opens below as the content shrinks', () => {
    const { rerender } = render(harness(100, 200))
    expect(placed().top).toBe(140)
    rerender(harness(100, 80))
    expect(placed().top).toBe(140)
  })

  it('stays on the side it opened on once the content would fit the other way', () => {
    const { rerender } = render(harness(700, 400))
    rerender(harness(700, 10))
    expect(placed()).toEqual({ top: 682, bottom: 692 })
  })
})

describe('font picker', () => {
  it('lists every font without a category filter and narrows as you type', () => {
    render(createElement(FontPicker, { value: 'sans', onChange: () => {} }))
    fireEvent.click(screen.getByLabelText('Font'))
    expect(screen.queryByText('All fonts')).toBeNull()
    expect(screen.queryByText('Sans serif')).toBeNull()
    expect(screen.queryByText('Monospace')).toBeNull()
    expect(screen.getByText('System Mono')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Find a font'), { target: { value: 'jakarta' } })
    const shown = Array.from(document.querySelectorAll('.glass button')).map(button => button.textContent)
    expect(shown).toEqual(['Plus Jakarta Sans'])
  })
})
