// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScribeHeld from '../src/renderer/src/components/scribe/ScribeHeld'
import ScribePill from '../src/renderer/src/components/scribe/ScribePill'
import { useScribe } from '../src/renderer/src/state/scribe'

// The card a dictation with nowhere to land is held on, as somebody standing in
// front of it sees it: the words they just said, a way to copy them, and a way to
// close it. Nothing here goes near a microphone or a keyboard.
//
// Main is what holds the words and what owns the clipboard, so the two buttons are
// covered by what they ask main for. A window that never takes focus cannot reach a
// clipboard on its own, which is the whole reason it is asked rather than done.

const asked = {
  copy: vi.fn(),
  letGo: vi.fn()
}

beforeEach(() => {
  asked.copy.mockClear()
  asked.letGo.mockClear()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('crew', {
    copyScribeHeld: asked.copy,
    letGoScribeHeld: asked.letGo
  })
  useScribe.setState({ held: '', phase: 'off', problem: null })
})

afterEach(() => {
  cleanup()
  useScribe.setState({ held: '', phase: 'off', problem: null })
  vi.unstubAllGlobals()
})

describe('the card', () => {
  it('says the whole of what was just dictated', () => {
    useScribe.setState({ held: 'Hello, hello, hello, hello.' })
    render(createElement(ScribeHeld))
    expect(screen.getByText('Hello, hello, hello, hello.')).toBeTruthy()
  })

  // The line says what to do about it rather than what went wrong, and it never
  // names the caret, the paste or the window: a person knows what they were about
  // to type into.
  it('says what to do about it', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribeHeld))
    expect(screen.getByText('Click into a text box, then dictate')).toBeTruthy()
  })

  // The words are content, so they are selectable, which is the one thing on this
  // card somebody may want to take away by hand.
  it('lets the words be selected', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribeHeld))
    expect(screen.getByText('Hello.').className).toContain('select-text')
  })

  it('asks main for the clipboard, because this window cannot reach one', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribeHeld))
    screen.getByText('Copy').click()
    expect(asked.copy).toHaveBeenCalledTimes(1)
  })

  // One press, and the button is the only thing that can say the clipboard took
  // it: there is no toast over another application's window.
  it('says it copied them', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribeHeld))
    act(() => screen.getByText('Copy').click())
    expect(screen.getByText('Copied')).toBeTruthy()
  })

  it('lets go of the words when it is closed', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribeHeld))
    screen.getByLabelText('Close').click()
    expect(asked.letGo).toHaveBeenCalledTimes(1)
  })
})

describe('when the card stands in for the pill', () => {
  it('is the pill and no card while nothing is being held', () => {
    render(createElement(ScribePill))
    expect(screen.queryByText('Copy')).toBeNull()
  })

  it('is the card once a dictation has been held', () => {
    useScribe.setState({ held: 'Hello.' })
    render(createElement(ScribePill))
    expect(screen.getByText('Hello.')).toBeTruthy()
    expect(screen.getByText('Copy')).toBeTruthy()
  })

  // Stretches arrive while somebody is still talking, and the bars are the whole
  // of what says Scribe is still listening. A card opening over them mid sentence
  // takes that away, so it waits for the dictation to be over.
  it('keeps the bars while there is still a voice to draw', () => {
    useScribe.setState({ held: 'Hello.', phase: 'hearing' })
    render(createElement(ScribePill))
    expect(screen.queryByText('Copy')).toBeNull()
  })

  it('opens the card the moment the dictation ends', () => {
    useScribe.setState({ held: 'Hello.', phase: 'hearing' })
    const view = render(createElement(ScribePill))
    useScribe.setState({ phase: 'off' })
    view.rerender(createElement(ScribePill))
    expect(screen.getByText('Copy')).toBeTruthy()
  })
})
