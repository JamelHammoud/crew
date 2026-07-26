// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { playSound } from '../src/renderer/src/media/sounds'
import { useCrew } from '../src/renderer/src/state/store'

vi.mock('../src/renderer/src/media/sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/renderer/src/media/sounds')>()
  return { ...actual, playSound: vi.fn() }
})

const heard = playSound as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  heard.mockClear()
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
      expect(el.className).not.toMatch(/text-fg-(muted|faint)/)
    }
  })

  it('sets Leave apart from what comes before it', () => {
    show()
    openMenu()
    const leave = screen.getByRole('button', { name: 'Leave' })
    expect(leave.previousElementSibling?.className).toContain('h-px')
  })
})
