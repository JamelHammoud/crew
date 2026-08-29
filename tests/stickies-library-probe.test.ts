import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sticky } from '../src/shared/stickies'

const saved: Sticky[] = [
  {
    id: 'first',
    title: 'First sticky',
    body: 'One',
    color: 'yellow',
    pinned: false,
    createdAt: 1,
    updatedAt: 2
  },
  {
    id: 'second',
    body: 'Second sticky\nTwo',
    color: 'blue',
    pinned: false,
    createdAt: 1,
    updatedAt: 1
  }
]

vi.mock('../src/renderer/src/state/stickies', () => ({
  deleteSticky: vi.fn(),
  updateSticky: vi.fn(),
  useStickies: () => saved,
  useStickiesLoaded: () => true
}))

vi.mock('../src/renderer/src/components/StickyEditor', () => ({
  default: ({ sticky }: { sticky: Sticky }) => createElement('div', { 'data-editor-id': sticky.id }, sticky.id)
}))

vi.mock('../src/renderer/src/state/windowName', () => ({ useWindowName: vi.fn() }))
vi.mock('../src/renderer/src/state/prefs', () => ({ usePrefs: () => ({ glassSidebar: true }) }))
vi.mock('../src/renderer/src/state/windowShape', () => ({ useFullScreen: () => false }))

const { default: StickiesWindow } = await import('../src/renderer/src/views/StickiesWindow')

beforeEach(() => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  window.location.hash = '#stickies'
  vi.stubGlobal('crypto', { randomUUID: () => 'draft-one' })
})

afterEach(() => {
  cleanup()
  document.getElementById('root')?.remove()
  vi.unstubAllGlobals()
})

describe('the Stickies library', () => {
  it('leaves the window clear behind its glass list', () => {
    const view = render(createElement(StickiesWindow))

    expect(view.container.querySelector('[data-stickies-library]')?.classList.contains('bg-transparent')).toBe(true)
    expect(view.container.querySelector('main')?.classList.contains('bg-ink-900')).toBe(true)
    expect(document.getElementById('root')?.classList.contains('sidebar-window-glass')).toBe(true)
  })

  it('keeps the top of the editor available for moving the window', () => {
    const view = render(createElement(StickiesWindow))

    const dragRegion = view.container.querySelector('[data-stickies-drag-region]')
    expect(dragRegion?.classList.contains('app-drag')).toBe(true)
    expect(dragRegion?.classList.contains('inset-x-0')).toBe(true)
    expect(dragRegion?.classList.contains('h-[70px]')).toBe(true)
    expect(dragRegion?.classList.contains('pointer-events-none')).toBe(true)
  })

  it('switches from the fresh draft to a saved sticky when its row is clicked', () => {
    const view = render(createElement(StickiesWindow))

    expect(view.container.querySelector('[data-editor-id]')?.getAttribute('data-editor-id')).toBe('draft:draft-one')
    expect(screen.getByRole('button', { name: /First sticky/ }).className).toContain('min-h-14')
    const row = screen.getByRole('button', { name: /Second sticky/ })
    expect(row.className).toContain('min-h-14')
    fireEvent.click(row)
    expect(view.container.querySelector('[data-editor-id]')?.getAttribute('data-editor-id')).toBe('second')
  })

  it('restores the list with its real border already in place', () => {
    const view = render(createElement(StickiesWindow))
    const sidebar = view.container.querySelector('[data-sticky-sidebar]') as HTMLElement

    fireEvent.click(screen.getByRole('button', { name: 'Hide sticky list' }))
    expect(sidebar.classList.contains('w-0')).toBe(true)
    expect(sidebar.classList.contains('border-transparent')).toBe(true)
    expect(sidebar.className).toContain('transition-[width]')
    expect(sidebar.className).not.toContain('border-color')

    fireEvent.click(screen.getByRole('button', { name: 'Show sticky list' }))
    expect(sidebar.classList.contains('w-[300px]')).toBe(true)
    expect(sidebar.classList.contains('border-[var(--glass-line)]')).toBe(true)
    expect(sidebar.classList.contains('border-transparent')).toBe(false)
  })

  it('opens the individual sticky actions from its background without a header', async () => {
    window.location.hash = '#sticky=first'
    const view = render(createElement(StickiesWindow))

    const windowBackground = view.container.querySelector('[data-sticky-window]') as HTMLElement
    expect(windowBackground).not.toBeNull()
    expect(windowBackground.querySelector('header')).toBeNull()
    fireEvent.contextMenu(windowBackground, { clientX: 180, clientY: 160 })

    await waitFor(() => expect(screen.getByText('Keep on top')).toBeTruthy())
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText('Delete sticky')).toBeTruthy()
  })
})
