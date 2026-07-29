// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentIcon from '../src/renderer/src/components/AgentIcon'
import Avatar from '../src/renderer/src/components/Avatar'
import TopBar from '../src/renderer/src/components/TopBar'
import { useCrew } from '../src/renderer/src/state/store'

const PHOTO = 'http://10.0.0.2:2739/attachments/me.png'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear()
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useCrew.setState({
    selfName: 'Jamel',
    connection: 'online',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    httpBase: ''
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const faces = [
  createElement(Avatar, { name: 'Jamel', photo: PHOTO }),
  createElement(AgentIcon, { seed: 'jamel/claude', photo: PHOTO })
]

describe('the box a face stands in', () => {
  it('holds no line of text, so a face wearing a photo is as tall as it is wide', () => {
    for (const face of faces) {
      const { container } = render(face)
      const box = container.firstElementChild as HTMLElement
      const picture = container.querySelector('img') as HTMLImageElement

      expect(box.className).toContain('align-middle')
      expect(picture.className).toContain('block')
      cleanup()
    }
  })

  it('leaves a cut out picture its transparency rather than filling the circle', () => {
    for (const face of faces) {
      const { container } = render(face)
      const picture = container.querySelector('img') as HTMLImageElement

      expect(picture.className).toContain('rounded-full')
      expect(picture.className).not.toMatch(/\bbg-/)
      expect(picture.style.backgroundColor).toBe('')
      cleanup()
    }
  })

  it('is a circle where the profile button rings it', () => {
    render(createElement(TopBar, { tab: 'chat' as const, onTab: vi.fn(), tasksOpen: false, onToggleTasks: vi.fn() }))

    const button = screen.getByRole('button', { name: 'Settings' })
    expect(button.className).toContain('flex')
    expect(button.className).not.toMatch(/(?:^|\s)block(?:\s|$)/)
  })
})
