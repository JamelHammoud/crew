// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SwipeActionRow from '../src/renderer/src/components/SwipeActionRow'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function row(onDelete = vi.fn(), onPress = vi.fn()) {
  const view = render(
    createElement(
      SwipeActionRow,
      { onDelete, className: 'rounded-xl' },
      createElement('button', { type: 'button', onClick: onPress }, 'One row')
    )
  )
  const root = view.container.querySelector('[data-swipe-action-row]') as HTMLDivElement
  const surface = view.container.querySelector('[data-swipe-surface]') as HTMLDivElement
  return { ...view, onDelete, onPress, root, surface }
}

describe('SwipeActionRow', () => {
  it('reveals Delete after a left pointer drag', () => {
    const { root, surface } = row()
    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 1, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 52, clientY: 12 })
    expect(root.dataset.offset).toBe('48')
    expect(surface.dataset.moving).toBe('')
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 52, clientY: 12 })
    expect(root.dataset.offset).toBe('64')
    expect(root.dataset.open).toBe('')
  })

  it('closes after a right pointer drag', () => {
    const { root, surface } = row()
    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 2, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 2, clientX: 40, clientY: 10 })
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 40, clientY: 10 })
    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 3, clientX: 40, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 3, clientX: 100, clientY: 10 })
    fireEvent.pointerUp(surface, { pointerId: 3, clientX: 100, clientY: 10 })
    expect(root.dataset.offset).toBe('0')
    expect(root.dataset.open).toBeUndefined()
  })

  it('leaves a vertical pointer gesture to the list', () => {
    const { root, surface } = row()
    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 4, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 4, clientX: 96, clientY: 40 })
    expect(root.dataset.offset).toBe('0')
    expect(surface.dataset.moving).toBeUndefined()
  })

  it('suppresses the press produced by a completed drag', () => {
    vi.useFakeTimers()
    const { onPress, surface } = row()
    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 5, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 5, clientX: 40, clientY: 10 })
    fireEvent.pointerUp(surface, { pointerId: 5, clientX: 40, clientY: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'One row' }))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('opens from a horizontal trackpad wheel gesture', () => {
    vi.useFakeTimers()
    const { root } = row()
    const gesture = createEvent.wheel(root, { deltaX: 44, deltaY: 2, cancelable: true })
    fireEvent(root, gesture)
    expect(gesture.defaultPrevented).toBe(true)
    expect(root.dataset.offset).toBe('44')
    vi.advanceTimersByTime(120)
    expect(root.dataset.offset).toBe('64')
    expect(root.dataset.open).toBe('')
  })

  it('does not take a vertical wheel gesture', () => {
    const { root } = row()
    const gesture = createEvent.wheel(root, { deltaX: 3, deltaY: 30, cancelable: true })
    fireEvent(root, gesture)
    expect(gesture.defaultPrevented).toBe(false)
    expect(root.dataset.offset).toBe('0')
  })

  it('opens for keyboard focus and calls onDelete from the labelled Crew action', () => {
    const { onDelete, root } = row()
    const action = screen.getByRole('button', { name: 'Delete' })
    expect(action.querySelector('svg')).toBeTruthy()
    fireEvent.focus(action)
    expect(root.dataset.open).toBe('')
    fireEvent.click(action)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(root.dataset.offset).toBe('0')
  })

  it('closes an open action with Escape', () => {
    const { root } = row()
    fireEvent.focus(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.keyDown(root, { key: 'Escape' })
    expect(root.dataset.offset).toBe('0')
  })
})
