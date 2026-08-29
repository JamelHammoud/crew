// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrayPanel from '../src/renderer/src/views/TrayPanel'
import { useCrew } from '../src/renderer/src/state/store'
import { emptyPresence, type Present, type PresenceSnapshot } from '../src/shared/presence'

Element.prototype.getAnimations ??= () => []

const listeners = new Set<(snapshot: PresenceSnapshot) => void>()
const bridge = {
  onPresence: vi.fn((listener: (snapshot: PresenceSnapshot) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }),
  onTrayTheme: vi.fn(() => () => {}),
  resizeTray: vi.fn(),
  openWindow: vi.fn(),
  openChat: vi.fn(),
  openStickies: vi.fn(() => Promise.resolve(true)),
  closeTray: vi.fn()
}

class Observer {
  constructor(private ran: () => void) {}
  observe(): void {
    this.ran()
  }
  disconnect(): void {}
}

const show = (patch: Partial<PresenceSnapshot>): void => {
  act(() => {
    for (const listener of listeners) listener({ ...emptyPresence(), ...patch })
  })
}

const person = (id: string, name: string): Present => ({ id, name, agent: false, threads: 0 })
const working = (id: string, name: string, threads: number): Present => ({
  id,
  name,
  agent: true,
  threads
})

describe('tray panel', () => {
  beforeEach(() => {
    listeners.clear()
    for (const call of Object.values(bridge)) call.mockClear?.()
    useCrew.setState({ agents: [], httpBase: '' })
    Object.assign(globalThis, { ResizeObserver: Observer })
    Object.assign(window, { crew: bridge })
    render(createElement(TrayPanel))
  })

  afterEach(() => {
    cleanup()
  })

  it('says nothing is running before a session is started', () => {
    show({})

    expect(screen.queryByText('Online')).toBeNull()
    expect(screen.queryByText('Working')).toBeNull()
    expect(screen.getByRole('button', { name: 'New sticky' })).toBeTruthy()
  })

  it('says to open the app when no window is there to ask', () => {
    show({ sharing: true })

    expect(screen.queryByText('Online')).toBeNull()
    expect(screen.queryByText('Working')).toBeNull()
    expect(screen.getByRole('button', { name: 'New sticky' })).toBeTruthy()
  })

  it('lists the people online and the agents working', () => {
    show({ sharing: true, known: true, here: [person('m1', 'Ali'), working('a1', 'Bubbles', 2)] })

    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.getByText('Ali')).toBeTruthy()
    expect(screen.getByText('Working')).toBeTruthy()
    expect(screen.getByText('Bubbles')).toBeTruthy()
    expect(screen.getByText('2 threads')).toBeTruthy()
  })

  it('says so when everyone else has gone', () => {
    show({ sharing: true, known: true, here: [] })

    expect(screen.getByText('Just you here.')).toBeTruthy()
  })

  it('badges what is waiting and offers it as a way in', () => {
    show({ sharing: true, known: true, waiting: 3 })

    expect(screen.getByText('Review 3 tasks')).toBeTruthy()
  })

  it('puts chat above review work and a new sticky directly below it', () => {
    show({ sharing: true, known: true, waiting: 3 })

    const rows = screen.getAllByRole('button')
    expect(rows.slice(0, 3).map(row => row.textContent)).toEqual(['Open chat', 'Review 3 tasks', 'New sticky'])

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(bridge.openChat).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'New sticky' }))
    expect(bridge.openStickies).toHaveBeenCalledTimes(1)
  })

  it('names a single task in the singular and keeps the exact count', () => {
    show({ sharing: true, known: true, waiting: 1 })
    expect(screen.getByText('Review 1 task')).toBeTruthy()

    show({ sharing: true, known: true, waiting: 12 })
    expect(screen.getByText('Review 12 tasks')).toBeTruthy()

    show({ sharing: true, known: true, waiting: 140 })
    expect(screen.getByText('Review 140 tasks')).toBeTruthy()
  })

  it('leaves the badge off when nothing is waiting', () => {
    show({ sharing: true, known: true, waiting: 0 })

    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText(/Review \d+ tasks?/)).toBeNull()
  })

  it('clips the roster sideways and replaces the system focus outline with a Crew row', () => {
    show({ sharing: true, known: true, here: [person('m1', 'Ali')] })

    const panel = screen.getByText('Online').closest('div[class*="max-w-full"]') as HTMLElement
    const roster = screen.getByText('Online').parentElement?.parentElement as HTMLElement
    expect(panel.className).toContain('[&_button]:focus-visible:outline-none')
    expect(roster.className).toContain('overflow-x-hidden')
  })

  it('reports its own height, so the window is only as tall as the list', () => {
    expect(bridge.resizeTray).toHaveBeenCalled()
  })

  it('closes on escape', () => {
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(bridge.closeTray).toHaveBeenCalled()
  })
})
