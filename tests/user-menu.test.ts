// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { playSound } from '../src/renderer/src/media/sounds'
import { setSounds } from '../src/renderer/src/state/sound'
import { useCrew } from '../src/renderer/src/state/store'

vi.mock('../src/renderer/src/media/sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/renderer/src/media/sounds')>()
  return { ...actual, playSound: vi.fn() }
})

const heard = playSound as unknown as ReturnType<typeof vi.fn>

const store = new Map<string, string>()

beforeEach(() => {
  heard.mockClear()
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear()
  })
  setSounds(true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useCrew.setState({ selfName: 'Jamel', joinLink: 'https://crew.test/join', connection: 'online' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useCrew.setState({ selfName: '', joinLink: null, connection: 'booting' })
})

const show = (onTab = vi.fn()) => {
  render(createElement(TopBar, { tab: 'chat' as const, onTab, tasksOpen: false, onToggleTasks: () => {} }))
  return onTab
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }))

describe('the user menu', () => {
  it('leaves the main navigation with Chat, Docs and Design', () => {
    show()
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const labels = within(navigation)
      .getAllByRole('button')
      .map(tab => tab.getAttribute('aria-label'))
    expect(labels).toEqual(['Chat', 'Docs', 'Design'])
  })

  it('is the way to Crew', () => {
    const onTab = show()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Crew' }))
    expect(onTab).toHaveBeenCalledWith('agents')
  })

  it('says nothing when you enter Crew, and still sounds the tabs', () => {
    show()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Crew' }))
    expect(heard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Docs' }))
    expect(heard).toHaveBeenCalledWith('tab.docs')
  })

  it('opens on who you are and where you stand', () => {
    show()
    openMenu()
    const menu = document.querySelector('.glass.fixed') as HTMLElement
    expect(within(menu).getByText('Jamel')).toBeTruthy()
    expect(within(menu).getByText('Hosting')).toBeTruthy()
    expect(menu.querySelector('span.rounded-full')).toBeTruthy()
  })

  it('holds no solid grey on the glass', () => {
    show()
    openMenu()
    const menu = document.querySelector('.glass.fixed') as HTMLElement
    for (const el of menu.querySelectorAll('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/text-fg-(muted|faint)/)
    }
  })

  it('says nothing when you mute, and says so when you turn sound back on', () => {
    show()
    openMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Mute sounds' }))
    expect(heard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Unmute sounds' }))
    expect(heard).toHaveBeenCalledWith('sound.on')
  })

  it('turns the word over with the mark it wears', () => {
    show()
    openMenu()
    const row = screen.getByRole('button', { name: 'Mute sounds' })
    expect(row.querySelector('.word-swap')).toBe(null)

    fireEvent.click(row)
    const turned = screen.getByRole('button', { name: 'Unmute sounds' })
    expect(turned.querySelectorAll('.word-swap').length).toBe(2)
  })

  it('leaves a row that never changes its word still', () => {
    show()
    openMenu()
    expect(screen.getByRole('button', { name: 'Crew' }).querySelector('.word-swap')).toBe(null)
  })

  it('is the way to your own photo, and only says remove once there is one', () => {
    const setMyPhoto = vi.fn()
    useCrew.setState({ selfId: 'jamel', members: [{ id: 'jamel', name: 'Jamel', connected: true }], setMyPhoto })
    show()
    openMenu()
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull()

    useCrew.setState({ members: [{ id: 'jamel', name: 'Jamel', connected: true, avatar: 'me.png' }] })
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(setMyPhoto).toHaveBeenCalledWith(null)
  })

  it('sets Leave apart from what comes before it', () => {
    show()
    openMenu()
    const leave = screen.getByRole('button', { name: 'Leave' })
    expect(leave.previousElementSibling?.className).toContain('h-px')
  })
})
