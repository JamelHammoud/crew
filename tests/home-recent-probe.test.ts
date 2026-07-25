// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCrew } from '../src/renderer/src/state/store'
import Home from '../src/renderer/src/views/Home'
import type { RecentJoin } from '../src/shared/recent'

function installBridge(recentJoins: RecentJoin[]) {
  const join = vi.fn().mockResolvedValue({ wsUrl: 'ws://10.0.0.2:2739/ws' })
  const recent = vi.fn().mockResolvedValue(recentJoins)
  window.crew = {
    recentJoins: recent,
    join,
    pickFolder: vi.fn().mockResolvedValue(null)
  } as unknown as CrewBridge
  return { join, recent }
}

describe('Home recent sessions', () => {
  beforeEach(() => {
    localStorage.clear()
    useCrew.setState({ connection: 'home', connect: vi.fn() })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('does not show recent sessions before the first join', async () => {
    const { recent } = installBridge([])
    render(createElement(Home))

    await waitFor(() => expect(recent).toHaveBeenCalledOnce())
    expect(screen.queryByRole('region', { name: 'Recently joined' })).toBeNull()
  })

  it('rejoins a saved session from its recent row', async () => {
    const saved = {
      folder: 'C:\\work\\crew-project',
      name: 'Ali',
      link: 'crew://10.0.0.2:2739/abc123',
      joinedAt: Date.now()
    }
    const { join } = installBridge([saved])
    render(createElement(Home))

    fireEvent.click(await screen.findByRole('button', { name: /10\.0\.0\.2:2739/ }))

    await waitFor(() => expect(join).toHaveBeenCalledWith(saved.link, saved.folder, saved.name))
    expect(localStorage.getItem('crew.link')).toBe(saved.link)
    expect(localStorage.getItem('crew.folder')).toBe(saved.folder)
    expect(localStorage.getItem('crew.name')).toBe(saved.name)
  })
})
