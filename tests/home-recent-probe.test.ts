// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCrew } from '../src/renderer/src/state/store'
import { useBrowser } from '../src/renderer/src/state/browser'
import Home from '../src/renderer/src/views/Home'
import type { RecentJoin } from '../src/shared/recent'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()

function installBridge(recentJoins: RecentJoin[]) {
  const join = vi.fn().mockResolvedValue({ wsUrl: 'ws://192.0.2.10:2739/ws' })
  const recent = vi.fn().mockResolvedValue(recentJoins)
  const projects = vi.fn().mockResolvedValue([])
  const forgetJoin = vi.fn().mockResolvedValue(undefined)
  const forgetProject = vi.fn().mockResolvedValue(undefined)
  window.crew = {
    recentJoins: recent,
    projects,
    join,
    forgetJoin,
    forgetProject,
    pickFolder: vi.fn().mockResolvedValue(null)
  } as unknown as CrewBridge
  return { join, recent, projects, forgetJoin, forgetProject }
}

describe('Home places', () => {
  beforeEach(() => {
    storage.clear()
    storage.setItem('crew.name', 'Jamel')
    Element.prototype.getAnimations = vi.fn().mockReturnValue([])
    useCrew.setState({ connection: 'home', connect: vi.fn() })
    useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('reads both kinds of place into the one list', async () => {
    const { recent, projects } = installBridge([])
    render(createElement(Home))

    await waitFor(() => expect(recent).toHaveBeenCalledOnce())
    expect(projects).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /192\.0\.2\.10/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Open a folder/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Join with a link/ })).toBeTruthy()
  })

  it('opens the file Finder handed over after its project', async () => {
    installBridge([])
    const session = { folder: '/work/repo', name: 'Jamel' }
    const start = vi.fn().mockResolvedValue(session)
    const connect = vi.fn()
    useCrew.setState({ connection: 'home', connect })
    Object.assign(window.crew, {
      opening: vi.fn().mockResolvedValue({ folder: '/work/repo', file: 'src/main.ts' }),
      projectPlan: vi.fn().mockResolvedValue({
        home: 'private',
        tracked: true,
        known: true,
        crewRemote: null,
        crewHere: false
      }),
      start
    })

    render(createElement(Home))

    await waitFor(() => expect(start).toHaveBeenCalledWith('/work/repo', 'Jamel', { share: undefined }))
    expect(connect).toHaveBeenCalledWith(session)
    expect(useBrowser.getState().tabs).toEqual([
      expect.objectContaining({ kind: 'file', path: 'src/main.ts' })
    ])
    expect(useBrowser.getState().open).toBe(true)
  })

  // Nothing can be opened without a name to open it under, so an empty one is
  // asked for rather than answered with a line of red under the button.
  it('asks for a name before it offers anywhere to go', async () => {
    storage.clear()
    installBridge([])
    render(createElement(Home))

    expect(await screen.findByRole('heading', { name: /What should we call you/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Open a folder/ })).toBeNull()
  })

  // You are one person, so a row is opened under the name you go by rather
  // than the one written down the last time you were there. It is handed to
  // the join rather than read back off state, which is a render behind.
  it('rejoins a crew from its own row, under the name you go by', async () => {
    const saved = {
      folder: 'C:\\work\\crew-project',
      name: 'Ali',
      link: 'crew://192.0.2.10:2739/abc123',
      joinedAt: Date.now()
    }
    const { join } = installBridge([saved])
    render(createElement(Home))

    fireEvent.click(await screen.findByRole('button', { name: /192\.0\.2\.10:2739/ }))

    await waitFor(() => expect(join).toHaveBeenCalledWith(saved.link, saved.folder, 'Jamel'))
    expect(storage.getItem('crew.link')).toBe(saved.link)
    expect(storage.getItem('crew.folder')).toBe(saved.folder)
    expect(storage.getItem('crew.name')).toBe('Jamel')
  })

  // Two Crews on one machine are two people only while each opens under its
  // own name, so a row can never write an older one back over it.
  it('asks for a name before a remembered crew with none set', async () => {
    storage.clear()
    const saved = {
      folder: '/tmp/crew-project',
      name: 'Ali',
      link: 'crew://192.0.2.10:2739/abc123',
      joinedAt: Date.now()
    }
    const { join } = installBridge([saved])
    render(createElement(Home))

    expect(await screen.findByRole('heading', { name: /What should we call you/ })).toBeTruthy()
    expect(join).not.toHaveBeenCalled()
  })

  // Taking a row off the list is a right click on it, and the list is read
  // again afterwards so what went is really gone.
  it('takes a place off the list from its own context menu', async () => {
    const saved = {
      folder: '/tmp/crew-project',
      name: 'Ali',
      link: 'crew://192.0.2.10:2739/abc123',
      joinedAt: Date.now()
    }
    const { forgetJoin, recent } = installBridge([saved])
    render(createElement(Home))

    const row = await screen.findByRole('button', { name: /192\.0\.2\.10:2739/ })
    expect(screen.queryByRole('button', { name: /Remove from the list/ })).toBeNull()

    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('button', { name: /Remove from the list/ }))

    await waitFor(() => expect(forgetJoin).toHaveBeenCalledWith(saved.link))
    await waitFor(() => expect(recent).toHaveBeenCalledTimes(2))
  })

  // The way in arrives from below, and the box that fills the window is not
  // what may carry it: padding is inside a height, so a box already the size of
  // the scroller overflows the moment it moves, and the scrollbar that answers
  // that takes ten pixels off the width for as long as the animation lasts.
  it('lands the way in without a scrollbar arriving under it', async () => {
    installBridge([])
    const { container } = render(createElement(Home))

    await waitFor(() => expect(container.querySelector('.animate-rise')).toBeTruthy())
    for (const box of container.querySelectorAll('.animate-rise')) {
      expect(box.classList.contains('min-h-full')).toBe(false)
    }
  })
})
