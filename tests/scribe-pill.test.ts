// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScribePill from '../src/renderer/src/components/scribe/ScribePill'
import { useScribe } from '../src/renderer/src/state/scribe'
import { defaultSettings, type ScribeSettings } from '../src/shared/scribe'

// What the pill draws, and the one state it must not: the mark on its own.
//
// The pill only rests on screen where somebody asked it to. Everywhere else the
// window is up for the length of a dictation, and it is put away once the words
// have gone somewhere, which is a paste after the sound has been read. The phase
// is back to off for the whole of that wait, so a pill that drew its resting mark
// there would flash small over the window it had just written into.

const on = (extra: Partial<ScribeSettings> = {}): ScribeSettings => ({
  ...defaultSettings('darwin'),
  on: true,
  ...extra
})

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('crew', { copyScribeHeld: vi.fn(), letGoScribeHeld: vi.fn() })
  useScribe.setState({ held: '', phase: 'off', problem: null, settings: on() })
})

afterEach(() => {
  cleanup()
  useScribe.setState({ held: '', phase: 'off', problem: null, settings: defaultSettings('darwin') })
  vi.unstubAllGlobals()
})

describe('the pill at rest', () => {
  it('draws nothing where it does not rest on screen', () => {
    const view = render(createElement(ScribePill))
    expect(view.container.firstChild).toBeNull()
  })

  it('draws nothing with dictation turned off', () => {
    useScribe.setState({ settings: on({ on: false, always: true }) })
    const view = render(createElement(ScribePill))
    expect(view.container.firstChild).toBeNull()
  })

  it('is the mark where somebody asked for it on screen all day', () => {
    useScribe.setState({ settings: on({ always: true }) })
    const view = render(createElement(ScribePill))
    expect(view.container.firstChild).not.toBeNull()
  })
})

describe('the pill while something is happening', () => {
  it('draws while a dictation is being heard, whatever the setting', () => {
    useScribe.setState({ phase: 'hearing' })
    const view = render(createElement(ScribePill))
    expect(view.container.firstChild).not.toBeNull()
  })

  it('draws while whisper finishes', () => {
    useScribe.setState({ phase: 'reading' })
    const view = render(createElement(ScribePill))
    expect(view.container.firstChild).not.toBeNull()
  })

  // A failure holds the sound and the way to read it again, so it stands however
  // the pill was set: nothing here may take away the only way out of it.
  it('stands on a failure', () => {
    useScribe.setState({ phase: 'failed', problem: 'Crew could not read that.' })
    render(createElement(ScribePill))
    expect(screen.getByText('Crew could not read that.')).toBeTruthy()
  })

  // Words that had nowhere to land are the one thing that outranks the setting.
  // They are on screen and not copied yet, and the card is the only copy there is.
  it('stands on a card of held words', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribePill))
    expect(screen.getByText('Hello.')).toBeTruthy()
    expect(screen.getByText('Copy')).toBeTruthy()
  })
})
