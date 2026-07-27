// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicView from '../src/renderer/src/components/music/MusicView'
import { useMusic } from '../src/renderer/src/state/music'
import { useCrew } from '../src/renderer/src/state/store'
import { emptyMusic, type MusicUpload } from '../src/shared/music'

// What a row says, and what it keeps for the menu at the end of it. A row is the
// name of the track and nothing else, so whose it is has somewhere to be said in
// words rather than in a line of small grey text under every song there is.

Element.prototype.getAnimations ??= () => []

const upload: MusicUpload = {
  id: 'u1',
  name: 'Rooftop Take',
  file: 'rooftop-take.mp3',
  seconds: 120,
  by: 'Ali Hammoud',
  ts: 1
}

const panel = () => render(createElement(MusicView))

const menuFor = (name: string) => fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }))

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useCrew.setState({ selfName: 'Jamel' })
  useMusic.setState({ room: emptyMusic(), uploads: [upload], playlists: [], trouble: null })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('a song in the list', () => {
  it('says its name and nothing under it', () => {
    panel()

    const row = screen.getByRole('button', { name: /Night Bus/ })

    expect(row.textContent).toBe('Night Bus')
  })

  it('says nothing under an upload either, whoever added it', () => {
    panel()

    const row = screen.getByRole('button', { name: /Rooftop Take/ })

    expect(row.textContent).toBe('Rooftop Take')
    expect(row.textContent).not.toContain('Ali Hammoud')
  })

  it('names whoever added it in the menu', () => {
    panel()
    menuFor('Rooftop Take')

    expect(screen.getByText('Added by')).toBeTruthy()
    expect(screen.getByText('Ali Hammoud')).toBeTruthy()
  })

  it('calls one of the app's own built-in', () => {
    panel()
    menuFor('Night Bus')

    expect(screen.getByText('Built-in')).toBeTruthy()
    expect(screen.queryByText('Added by')).toBeNull()
  })
})

describe('the bar at the foot of the panel', () => {
  it('says the name of what is playing and nothing else', () => {
    useMusic.setState({ room: { ...emptyMusic(), trackId: 'night-bus', playing: true } })
    panel()

    expect(screen.getByText('Night Bus')).toBeTruthy()
    expect(screen.queryByText('mellow')).toBeNull()
  })

  it('still says so when the track will not play', () => {
    useMusic.setState({
      room: { ...emptyMusic(), trackId: upload.id, playing: true },
      trouble: 'That track will not play'
    })
    panel()

    expect(screen.getByText('That track will not play')).toBeTruthy()
  })
})
