// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicView from '../src/renderer/src/components/music/MusicView'
import { useMusic } from '../src/renderer/src/state/music'
import { useCrew } from '../src/renderer/src/state/store'
import { emptyMusic, MUSIC_SETS, type MusicPlaylist } from '../src/shared/music'

// How the music panel moves from one screen to the next. Two tabs stand beside
// each other and a list stands inside them, so every move has a direction, and
// the screen being left has to be seen to go rather than blinking out from under
// the one arriving.

Element.prototype.getAnimations ??= () => []

const SET = MUSIC_SETS[0].id

const mine: MusicPlaylist = { id: 'l1', name: 'Heads Down', by: 'Jamel', trackIds: ['night-bus'], ts: 1 }

const panel = () => render(createElement(MusicView))

const layer = (name: string): HTMLElement | null => document.querySelector(`[data-screen="${name}"]`)

const classes = (name: string): string => layer(name)?.className ?? ''

const scroller = (name: string): HTMLElement => layer(name)?.firstElementChild as HTMLElement

const settle = () => act(() => void vi.advanceTimersByTime(400))

const press = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useCrew.setState({ selfName: 'Jamel' })
  useMusic.setState({ room: emptyMusic(), uploads: [], playlists: [mine] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('moving through the music panel', () => {
  it('opens on the songs without playing an animation at nothing', () => {
    panel()

    expect(classes('songs')).not.toContain('animate-screen')
    expect(layer('playlists')).toBeNull()
  })

  it('travels the way you are going, and holds the screen you are leaving on while it goes', () => {
    panel()
    press(/^Playlists$/)

    expect(classes('playlists')).toContain('animate-screen')
    expect(classes('songs')).toContain('animate-screen-out')
    expect(layer('songs')?.textContent).toContain('Add a track')

    settle()

    expect(layer('songs')).toBeNull()
    expect(layer('playlists')).not.toBeNull()
  })

  it('comes back the other way', () => {
    panel()
    press(/^Playlists$/)
    settle()
    press(/^Songs$/)

    expect(classes('songs')).toContain('animate-screen-back')
    expect(classes('playlists')).toContain('animate-screen-out-back')
  })

  it('goes deeper into a playlist and back out of it', () => {
    panel()
    press(/^Playlists$/)
    settle()
    press(/^Heads Down/)

    expect(classes(`playlist:${mine.id}`)).toContain('animate-screen')
    expect(classes('playlists')).toContain('animate-screen-out')

    settle()
    press(/All playlists/)

    expect(classes('playlists')).toContain('animate-screen-back')
    expect(classes(`playlist:${mine.id}`)).toContain('animate-screen-out-back')
  })

  it('takes a list that was deleted under you back out to the shelf', () => {
    panel()
    press(/^Playlists$/)
    settle()
    press(/^Heads Down/)
    settle()
    act(() => useMusic.setState({ playlists: [] }))

    expect(classes('playlists')).toContain('animate-screen-back')
  })

  it('keeps each screen where you left it', () => {
    panel()
    scroller('songs').scrollTop = 240
    press(/^Playlists$/)
    settle()

    expect(layer('songs')).toBeNull()

    press(/^Songs$/)
    settle()

    expect(scroller('songs').scrollTop).toBe(240)
  })

  it('starts a list you have not opened before at the top of it', () => {
    panel()
    press(/^Playlists$/)
    settle()
    scroller('playlists').scrollTop = 120
    press(/^Crew/)
    settle()

    expect(scroller(`playlist:${SET}`).scrollTop).toBe(0)

    press(/All playlists/)
    settle()

    expect(scroller('playlists').scrollTop).toBe(120)
  })
})
