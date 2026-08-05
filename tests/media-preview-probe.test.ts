// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import MediaView from '../src/renderer/src/components/MediaView'
import { clock } from '../src/renderer/src/components/music/say'
import { mediaSound, setMediaMuted, setMediaVolume } from '../src/renderer/src/state/mediaVolume'
import { mediaType } from '../src/shared/files'

// A track or a clip opened in the side panel. Nothing here starts on its own,
// a file that will not play says so rather than sitting silent, and the bar
// that says where it has got to gets out of the way of a picture that is
// playing.

Element.prototype.getAnimations ??= () => []

let length = 0
let paused = true

function drive(): HTMLVideoElement {
  const element = document.querySelector('video')
  if (!element) throw new Error('no media element')
  return element as HTMLVideoElement
}

const ready = (seconds: number) => {
  length = seconds
  act(() => {
    fireEvent.loadedMetadata(drive())
  })
}

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => length
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => paused
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value(this: HTMLVideoElement) {
      paused = false
      fireEvent.play(this)
      return Promise.resolve()
    }
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value(this: HTMLVideoElement) {
      paused = true
      fireEvent.pause(this)
    }
  })
})

afterEach(() => {
  cleanup()
  length = 0
  paused = true
  globalThis.localStorage?.clear()
})

const clip = (video: boolean) =>
  render(
    createElement(MediaView, {
      path: video ? 'demo/clip.mp4' : 'demo/song.mp3',
      src: 'crew-media://m/abc',
      video
    })
  )

describe('what a file is played through', () => {
  it('plays a format this machine can really play and passes over one it cannot', () => {
    expect(mediaType('song.mp3')).toEqual({ type: 'audio/mpeg', video: false })
    expect(mediaType('clip.MP4')).toEqual({ type: 'video/mp4', video: true })
    expect(mediaType('reel.mkv')).toBeNull()
    expect(mediaType('notes')).toBeNull()
  })

  it('never starts on its own', () => {
    clip(true)
    expect(drive().hasAttribute('autoplay')).toBe(false)
    expect(drive().paused).toBe(true)
  })

  it('reads a length past an hour as hours', () => {
    expect(clock(65)).toBe('1:05')
    expect(clock(3725)).toBe('1:02:05')
    expect(clock(Number.NaN)).toBe('0:00')
  })

  it('says so when a file will not play, and takes the bar away with it', () => {
    clip(false)
    ready(12)
    expect(screen.getByLabelText('Play')).toBeTruthy()
    act(() => {
      fireEvent.error(drive())
    })
    expect(screen.getByText('This file will not play')).toBeTruthy()
    expect(screen.queryByLabelText('Play')).toBeNull()
  })

  it('gives a track a picture of its own and a clip the picture it already has', () => {
    const { container, unmount } = clip(false)
    ready(30)
    expect(container.querySelector('canvas, [style*="background"]')).toBeTruthy()
    expect(drive().className).toContain('sr-only')
    unmount()

    const shown = clip(true)
    ready(30)
    expect(shown.container.querySelector('video')?.className).toContain('object-contain')
  })

  it('holds the bar over a clip that is paused and takes it off one that is playing', () => {
    const { container } = clip(true)
    ready(30)
    expect(screen.getByLabelText('Play')).toBeTruthy()

    act(() => {
      fireEvent.click(drive())
    })
    expect(screen.queryByLabelText('Pause')).toBeNull()

    act(() => {
      fireEvent.pointerEnter(container.firstElementChild as Element)
    })
    expect(screen.getByLabelText('Pause')).toBeTruthy()
  })

  it('keeps a bar on a track the whole time, since there is no picture to cover', () => {
    clip(false)
    ready(30)
    act(() => {
      fireEvent.click(screen.getByLabelText('Play'))
    })
    expect(screen.getByLabelText('Pause')).toBeTruthy()
  })

  it('keeps how loud it is on this machine and never beside the music', () => {
    setMediaVolume(0.4)
    expect(mediaSound().volume).toBeCloseTo(0.4)
    setMediaMuted(true)
    expect(mediaSound().muted).toBe(true)
    expect(globalThis.localStorage?.getItem('crew.music.volume')).toBeNull()
  })
})
