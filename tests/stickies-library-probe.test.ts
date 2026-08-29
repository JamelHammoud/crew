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
vi.mock('../src/renderer/src/state/prefs', () => ({ usePrefs: () => ({ glassSidebar: false }) }))
vi.mock('../src/renderer/src/state/windowShape', () => ({ useFullScreen: () => false }))

const { default: StickiesWindow } = await import('../src/renderer/src/views/StickiesWindow')

beforeEach(() => {
  window.location.hash = '#stickies'
  vi.stubGlobal('crypto', { randomUUID: () => 'draft-one' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the Stickies library', () => {
  it('switches from the fresh draft to a saved sticky when its row is clicked', () => {
    const view = render(createElement(StickiesWindow))

    expect(view.container.querySelector('[data-editor-id]')?.getAttribute('data-editor-id')).toBe('draft:draft-one')
    expect(screen.getByRole('button', { name: /First sticky/ }).className).toContain('min-h-14')
    const row = screen.getByRole('button', { name: /Second sticky/ })
    expect(row.className).toContain('min-h-14')
    fireEvent.click(row)
    expect(view.container.querySelector('[data-editor-id]')?.getAttribute('data-editor-id')).toBe('second')
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
