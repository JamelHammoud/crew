// @vitest-environment jsdom

import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SwipeActionRow from '../src/renderer/src/components/SwipeActionRow'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function row(onDelete = vi.fn(), onPress = vi.fn()) {
  const view = render(
    createElement(SwipeActionRow, {
      onDelete,
      className: 'rounded-xl',
      children: createElement('button', { type: 'button', onClick: onPress }, 'One row')
    })
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
    expect(root.dataset.offset).toBe('56')
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
    expect(root.dataset.offset).toBe('44')
    act(() => vi.advanceTimersByTime(120))
    expect(root.dataset.offset).toBe('56')
    expect(root.dataset.open).toBe('')
  })

  it('does not take a vertical wheel gesture', () => {
    const { root } = row()
    const gesture = createEvent.wheel(root, { deltaX: 3, deltaY: 30, cancelable: true })
    fireEvent(root, gesture)
    expect(gesture.defaultPrevented).toBe(false)
    expect(root.dataset.offset).toBe('0')
  })

  it('leaves an ordinary row click intact', () => {
    const { onPress, surface } = row()
    const capture = vi.fn()
    const release = vi.fn()
    surface.setPointerCapture = capture
    surface.releasePointerCapture = release

    fireEvent.pointerDown(surface, { button: 0, isPrimary: true, pointerId: 10, clientX: 50, clientY: 10 })
    fireEvent.pointerUp(surface, { pointerId: 10, clientX: 50, clientY: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'One row' }))

    expect(capture).not.toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete from the labelled Crew action after it is revealed', () => {
    const { onDelete, root } = row()
    const action = screen.getByRole('button', { name: 'Delete' })
    expect(action.querySelector('svg')).toBeTruthy()
    fireEvent.wheel(root, { deltaX: 56, deltaY: 0 })
    expect(root.dataset.open).toBe('')
    expect(action.tabIndex).toBe(0)
    expect((root.querySelector('[data-swipe-surface]') as HTMLDivElement).style.getPropertyValue('--swipe-inset')).toBe(
      '6px'
    )
    fireEvent.click(action)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(root.dataset.offset).toBe('0')
  })

  it('keeps the delete action invisible while the row is closed', () => {
    row()

    const action = screen.getByRole('button', { name: 'Delete' })
    const surface = document.querySelector('[data-swipe-surface]') as HTMLDivElement
    expect(action.style.clipPath).toBe('inset(0 0 0 56px)')
    expect(action.tabIndex).toBe(-1)
    expect(action.className).toContain('rounded-full')
    expect(action.className).toContain('h-9')
    expect(action.className).toContain('w-9')
    expect(surface.style.getPropertyValue('--swipe-inset')).toBe('12px')
  })

  it('closes an open action with Escape', () => {
    const { root } = row()
    fireEvent.wheel(root, { deltaX: 56, deltaY: 0 })
    fireEvent.keyDown(root, { key: 'Escape' })
    expect(root.dataset.offset).toBe('0')
  })
})
