// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/renderer/src/components/settings/Settings'
import TopBar from '../src/renderer/src/components/TopBar'
import { playSound } from '../src/renderer/src/media/sounds'
import { closeSettings, openSettings } from '../src/renderer/src/state/settings'
import { setSounds } from '../src/renderer/src/state/sound'
import { useCrew } from '../src/renderer/src/state/store'
import { storedTheme } from '../src/renderer/src/state/theme'

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
  window.crew = {
    agentCapabilities: vi.fn().mockResolvedValue([]),
    setTheme: vi.fn()
  } as unknown as typeof window.crew
  useCrew.setState({
    selfId: 'jamel',
    selfName: 'Jamel',
    connection: 'online',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    activePrompts: {},
    hosting: true,
    shared: false,
    joinLink: null
  })
})

afterEach(() => {
  closeSettings()
  cleanup()
  vi.unstubAllGlobals()
  useCrew.setState({ selfName: '', joinLink: null, connection: 'booting', members: [], agents: [] })
})

const card = () => screen.getByRole('dialog', { name: 'Settings' })
const rail = () => screen.getByRole('navigation', { name: 'Settings' })
const page = (name: string) => screen.getByRole('heading', { name })

const show = (tab?: Parameters<typeof openSettings>[0]) => {
  openSettings(tab)
  render(createElement(Settings))
}

describe('the settings', () => {
  it('is what your own face opens, with no menu in between', () => {
    render(createElement(TopBar, { tab: 'chat' as const, onTab: vi.fn(), tasksOpen: false, onToggleTasks: () => {} }))
    render(createElement(Settings))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(card()).toBeTruthy()
    expect(document.querySelector('.glass.fixed')).toBeNull()
  })

  it('leaves the main navigation with Chat, Docs and Design', () => {
    render(createElement(TopBar, { tab: 'chat' as const, onTab: vi.fn(), tasksOpen: false, onToggleTasks: () => {} }))
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const labels = within(navigation)
      .getAllByRole('button')
      .map(tab => tab.getAttribute('aria-label'))
    expect(labels).toEqual(['Chat', 'Docs', 'Design'])
  })

  it('stands your own pages beside the crew’s, and opens on you by name', () => {
    show()
    const rows = within(rail())
      .getAllByRole('button')
      .map(row => row.textContent)
    expect(rows).toEqual(['Jamel', 'Appearance', 'Sound and video', 'People', 'Agents'])
    expect(within(rail()).getByText('Crew')).toBeTruthy()
    expect(page('Jamel')).toBeTruthy()
  })

  it('turns the page over when a row is picked', () => {
    show()
    fireEvent.click(within(rail()).getByRole('button', { name: 'Agents' }))
    expect(page('Agents')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Jamel' })).toBeNull()
  })

  it('is where the agents live now, and the way in stands with them', () => {
    show('agents')
    expect(within(card()).getByRole('button', { name: /Add an agent/ })).toBeTruthy()
  })

  it('holds no solid grey on the glass', () => {
    show()
    for (const tab of ['you', 'appearance', 'sound', 'people', 'agents'] as const) {
      act(() => openSettings(tab))
      for (const el of card().querySelectorAll('*')) {
        expect(el.getAttribute('class') ?? '').not.toMatch(/text-fg-(muted|faint|secondary)/)
      }
    }
  })

  it('says nothing when you mute, and says so when you turn sound back on', () => {
    show('sound')
    const row = screen.getByRole('switch', { name: 'App sounds' })
    expect(row.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(row)
    expect(heard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('switch', { name: 'App sounds' }))
    expect(heard).toHaveBeenCalledWith('sound.on')
  })

  it('picks a theme from the pair, and says which one is worn', () => {
    show('appearance')
    const light = screen.getByRole('button', { name: /Light/ })
    expect(screen.getByRole('button', { name: /Dark/ }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(light)
    expect(storedTheme()).toBe('light')
    expect(screen.getByRole('button', { name: /Light/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('never says photo in words: your face is where a photo is changed', () => {
    show()
    expect(card().textContent).not.toMatch(/photo/i)
    expect(within(card()).getByLabelText('Add a photo')).toBeTruthy()
  })

  it('closes on the way out it draws', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
  })
})
