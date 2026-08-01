// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/renderer/src/components/settings/Settings'
import { SETTINGS_TABS, tabLabel } from '../src/renderer/src/components/settings/tabs'
import TopBar from '../src/renderer/src/components/TopBar'
import { playSound } from '../src/renderer/src/media/sounds'
import { awake } from '../src/renderer/src/state/awake'
import { prefs } from '../src/renderer/src/state/prefs'
import { closeSettings, openSettings } from '../src/renderer/src/state/settings'
import { setScribeSettings } from '../src/renderer/src/state/scribeSettings'
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
    appVersion: vi.fn().mockResolvedValue('0.1.0'),
    commandState: vi.fn().mockResolvedValue({ kind: 'missing', where: '/usr/local/bin/crew' }),
    installCommand: vi.fn().mockResolvedValue({ ok: true }),
    removeCommand: vi.fn().mockResolvedValue({ ok: true }),
    applyScribe: vi.fn().mockResolvedValue({ hooked: true, trusted: true }),
    onScribeSaid: vi.fn().mockReturnValue(() => {}),
    scribeSaid: vi.fn().mockResolvedValue([]),
    scribeState: vi.fn().mockResolvedValue({ hooked: true, trusted: true }),
    setTheme: vi.fn(),
    keepAwake: vi.fn(),
    rename: vi.fn().mockResolvedValue(null)
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

  it('keeps the main navigation hidden', () => {
    render(createElement(TopBar, { tab: 'chat' as const, onTab: vi.fn(), tasksOpen: false, onToggleTasks: () => {} }))
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const labels = within(navigation)
      .getAllByRole('button')
      .map(tab => tab.getAttribute('aria-label'))
    expect(navigation.classList.contains('hidden')).toBe(true)
    expect(labels).toEqual(['Chat', 'Docs', 'Design'])
  })

  it('stands your own pages beside the crew’s, and opens on you by name', () => {
    show()
    const rows = within(rail())
      .getAllByRole('button')
      .map(row => row.getAttribute('aria-label'))
    // Read off the one table rather than written out again here, or the rail
    // grows a page and this quietly says it did not.
    expect(rows).toEqual(SETTINGS_TABS.map(tab => tabLabel(tab, 'Jamel')))
    expect(rows[0]).toBe('Jamel')
    expect(within(rail()).getByText('Crew')).toBeTruthy()
    expect(page('Jamel')).toBeTruthy()
  })

  it('keeps the caret while you type and renames you from your own page', () => {
    useCrew.setState({
      selfName: 'Jamel (dev)',
      members: [{ id: 'jamel', name: 'Jamel (dev)', connected: true }]
    })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Rename yourself' }))
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' })
    fireEvent.change(input, { target: { value: 'J', selectionStart: 1, selectionEnd: 1 } })
    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(1)
    fireEvent.change(input, { target: { value: 'Jamel', selectionStart: 5, selectionEnd: 5 } })
    expect(input.selectionStart).toBe(5)
    expect(input.selectionEnd).toBe(5)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useCrew.getState().selfName).toBe('Jamel')
    expect(window.crew.rename).toHaveBeenCalledWith('Jamel')
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
    for (const tab of ['you', 'appearance', 'sound', 'machine', 'people', 'agents', 'files'] as const) {
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

  // The numbers are gathered whichever way these are set. All they decide is
  // what a working run draws, so the count is on and the price is off.
  it('shows a run its count by default and its price only when asked', () => {
    show('appearance')
    const count = screen.getByRole('switch', { name: 'Token count' })
    const price = screen.getByRole('switch', { name: 'Estimated cost' })
    expect(count.getAttribute('aria-checked')).toBe('true')
    expect(price.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(price)
    fireEvent.click(count)
    expect(prefs()).toEqual({ tokens: false, cost: true })
  })

  // The size limit is the crew's, so the page says the number everyone is on
  // and asking for another one goes to the host rather than being set here.
  it('says how big a file may be, and asks the crew for another number', () => {
    const asked = vi.fn()
    act(() => useCrew.setState({ attachmentMb: 10, setAttachmentLimit: asked }))
    show('files')
    expect(page('Files')).toBeTruthy()

    fireEvent.click(within(card()).getByRole('button', { name: /10 MB/ }))
    fireEvent.click(screen.getByRole('button', { name: '25 MB' }))
    expect(asked).toHaveBeenCalledWith(25)
  })

  // A file is pulled by every machine in the crew and lands in the history they
  // sync, so the biggest sizes stand only while the crew is this one's own.
  it('offers no limit on your own crew and stops at 500 MB on a shared one', () => {
    act(() => useCrew.setState({ attachmentMb: 10, shared: false }))
    show('files')
    fireEvent.click(within(card()).getByRole('button', { name: /10 MB/ }))
    expect(screen.getByRole('button', { name: 'No limit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '10 GB' })).toBeTruthy()

    act(() => useCrew.setState({ shared: true }))
    expect(screen.queryByRole('button', { name: 'No limit' })).toBeNull()
    expect(screen.queryByRole('button', { name: '10 GB' })).toBeNull()
    expect(screen.getByRole('button', { name: '500 MB' })).toBeTruthy()
  })

  it('keeps Scribe on screen or shows it only while dictating', () => {
    setScribeSettings({ always: true })
    show('scribe')
    const visibility = screen.getByRole('switch', { name: 'Keep Scribe on screen' })
    expect(visibility.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(visibility)
    expect(visibility.getAttribute('aria-checked')).toBe('false')
    expect(window.crew.applyScribe).toHaveBeenLastCalledWith(
      expect.objectContaining({ always: false })
    )
  })

  // The command comes with the app, so this row is the one press that puts it
  // on PATH. The row turning over is what says it worked, so nothing else does.
  it('puts crew on your path in one press, and says where it went', async () => {
    window.crew.commandState = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'missing', where: '/usr/local/bin/crew' })
      .mockResolvedValue({ kind: 'linked', where: '/usr/local/bin/crew' })
    show('machine')

    fireEvent.click(await screen.findByRole('button', { name: 'Install' }))
    expect(window.crew.installCommand).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeTruthy()
    expect(within(card()).getByText('/usr/local/bin/crew')).toBeTruthy()
  })

  // Windows has no folder every shell already reads, so the machine says it has
  // nowhere to put the command and the row is left out rather than standing
  // there greyed. The machine answers that, never the renderer guessing.
  it('leaves the command row out where there is nowhere to put it', async () => {
    window.crew.commandState = vi.fn().mockResolvedValue({ kind: 'off', where: '/usr/local/bin/crew' })
    show('machine')

    expect(await screen.findByRole('switch', { name: 'Keep this computer awake' })).toBeTruthy()
    expect(within(card()).queryByText('The crew command')).toBeNull()
  })

  // The three things a machine answers for stand on one page, because they are
  // one idea: what this computer does while Crew is open.
  it('holds what this computer does on one page', async () => {
    show('machine')
    expect(page('This computer')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Keep this computer awake' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Let agents send work out' })).toBeTruthy()
    expect(await within(card()).findByText('The crew command')).toBeTruthy()
  })

  // Whether this machine sleeps is yours alone, so it is written down where you
  // sit and main is told in the same breath as the switch being turned.
  it('lets this machine sleep until you say otherwise', () => {
    show('machine')
    const row = screen.getByRole('switch', { name: 'Keep this computer awake' })
    expect(row.getAttribute('aria-checked')).toBe('false')
    expect(awake()).toBe(false)

    fireEvent.click(row)
    expect(row.getAttribute('aria-checked')).toBe('true')
    expect(awake()).toBe(true)
    expect(window.crew.keepAwake).toHaveBeenLastCalledWith(true)

    fireEvent.click(row)
    expect(awake()).toBe(false)
    expect(window.crew.keepAwake).toHaveBeenLastCalledWith(false)
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
