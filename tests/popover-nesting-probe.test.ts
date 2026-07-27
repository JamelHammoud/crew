// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popover } from '../src/renderer/src/components/Popover'

afterEach(cleanup)

const stack = () => {
  const onOuter = vi.fn()
  const onInner = vi.fn()
  render(
    h(
      'div',
      null,
      h('button', null, 'anchor'),
      h(
        Popover,
        { open: true, onClose: onOuter },
        h('span', { 'data-testid': 'under' }, 'under'),
        h(Popover, { open: true, onClose: onInner }, h('span', { 'data-testid': 'over' }, 'over'))
      )
    )
  )
  return { onOuter, onInner }
}

describe('a popover opened from inside a popover', () => {
  it('stands beside the one underneath rather than inside it', () => {
    stack()
    const panels = document.querySelectorAll('.glass.fixed')
    expect(panels).toHaveLength(2)
    expect(panels[0].contains(panels[1])).toBe(false)
  })

  it('leaves the one underneath open when it is clicked', () => {
    const { onOuter, onInner } = stack()
    fireEvent.pointerDown(screen.getByTestId('over'))
    expect(onOuter).not.toHaveBeenCalled()
    expect(onInner).not.toHaveBeenCalled()
  })

  it('leaves it open when it is scrolled', () => {
    const { onOuter } = stack()
    fireEvent.scroll(screen.getByTestId('over'))
    expect(onOuter).not.toHaveBeenCalled()
  })

  it('takes both away on a click that lands in neither', () => {
    const { onOuter, onInner } = stack()
    fireEvent.pointerDown(document.body)
    expect(onOuter).toHaveBeenCalled()
    expect(onInner).toHaveBeenCalled()
  })
})
