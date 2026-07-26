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

    expect(screen.getByText('Not in a session')).toBeTruthy()
    expect(screen.getByText('Open crew to start or join a session.')).toBeTruthy()
  })

  it('says to open the app when no window is there to ask', () => {
    show({ sharing: true })

    expect(screen.getByText('Sharing your agents')).toBeTruthy()
    expect(screen.getByText('Open crew to see who is here.')).toBeTruthy()
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

    expect(screen.getByText('Nobody else is here.')).toBeTruthy()
  })

  it('badges what is waiting and offers it as a way in', () => {
    show({ sharing: true, known: true, waiting: 3 })

    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('3 tasks need review')).toBeTruthy()
  })

  it('names a single task in the singular and stops the badge at nine', () => {
    show({ sharing: true, known: true, waiting: 1 })
    expect(screen.getByText('1 task needs review')).toBeTruthy()

    show({ sharing: true, known: true, waiting: 12 })
    expect(screen.getByText('9+')).toBeTruthy()
    expect(screen.getByText('12 tasks need review')).toBeTruthy()
  })

  it('leaves the badge off when nothing is waiting', () => {
    show({ sharing: true, known: true, waiting: 0 })

    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText(/needs? review/)).toBeNull()
  })

  it('opens the app from the panel', () => {
    show({ sharing: true, known: true })
    fireEvent.click(screen.getByText('Open crew'))

    expect(bridge.openWindow).toHaveBeenCalled()
  })

  it('reports its own height, so the window is only as tall as the list', () => {
    expect(bridge.resizeTray).toHaveBeenCalled()
  })

  it('closes on escape', () => {
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(bridge.closeTray).toHaveBeenCalled()
  })
})
