// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import UpdatePill from '../src/renderer/src/components/UpdatePill'
import { watchUpdates } from '../src/renderer/src/state/update'
import { NO_UPDATE, type UpdateState } from '../src/shared/update'

// The pill as somebody in the top bar sees it. A new Crew is the one thing in
// that row worth pressing, so it is solid white the way every other action in
// the app is, and the fill is the whole of what says how far the download has
// come. That fill is what this holds: the word is written on each side of it, or
// it vanishes the moment the white passes under it.

const said = vi.fn()
const failed = vi.fn()
vi.mock('../src/renderer/src/state/toast', () => ({
  toast: Object.assign((text: string, opts?: unknown) => said(text, opts), {
    fail: (text: string, opts?: unknown) => failed(text, opts)
  })
}))

const pressed = vi.fn()
let drive: (state: UpdateState) => void = () => {}

beforeAll(() => {
  vi.stubGlobal('crew', {
    onUpdate: (fn: (state: UpdateState) => void) => {
      drive = fn
      return () => {}
    },
    updateState: () => Promise.resolve(NO_UPDATE),
    pressUpdate: pressed
  })
  watchUpdates()
})

afterEach(() => {
  cleanup()
  pressed.mockClear()
  said.mockClear()
  failed.mockClear()
  act(() => drive(NO_UPDATE))
})

function put(state: Partial<UpdateState>): void {
  act(() => drive({ ...NO_UPDATE, ...state }))
}

function pill(): HTMLButtonElement | null {
  return document.querySelector('button')
}

describe('the update pill', () => {
  it('stands only when an update is ready', () => {
    render(createElement(UpdatePill))
    expect(pill()).toBeNull()
    put({ stage: 'found', version: '0.1.1' })
    expect(pill()).toBeNull()
    put({ stage: 'getting', version: '0.1.1', percent: 40 })
    expect(pill()).toBeNull()
    put({ stage: 'ready', version: '0.1.1', percent: 100 })
    expect(pill()?.textContent).toBe('Restart to update')
  })

  it('is the white action in the row once the update is ready', () => {
    render(createElement(UpdatePill))
    put({ stage: 'ready', version: '0.1.1', percent: 100 })
    expect(pill()?.className).toContain('bg-fg ')
    expect(pill()?.className).toContain('text-ink-900')
    expect(pill()?.disabled).toBe(false)
  })

  it('applies the update when pressed', () => {
    render(createElement(UpdatePill))
    put({ stage: 'ready', version: '0.1.1', percent: 100 })
    expect(pill()?.textContent).toBe('Restart to update')
    pill()?.click()
    expect(pressed).toHaveBeenCalled()
  })

  it('keeps a failed background download out of the row', () => {
    render(createElement(UpdatePill))
    put({ stage: 'failed', version: '0.1.1' })
    expect(pill()).toBeNull()
  })
})

// The three ways an update does not happen are three different sentences, and a
// press that was held is worth a word every time it is pressed.
describe('the word about an update that did not happen', () => {
  it('says nothing at all while it is going well', () => {
    put({ stage: 'found', version: '0.1.1' })
    put({ stage: 'getting', percent: 40 })
    put({ stage: 'ready', version: '0.1.1', percent: 100 })
    expect(said).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
  })

  it('keeps a background download failure quiet', () => {
    put({ stage: 'failed', version: '0.1.1' })
    expect(said).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
  })

  it('says an update that came down and would not go on', () => {
    put({ stage: 'failed', version: '0.1.1', why: 'install', told: 1 })
    expect(failed).toHaveBeenCalledWith('Crew did not update', { key: 'update' })
  })

  it('asks for the other Crews rather than taking their work down', () => {
    put({ stage: 'ready', version: '0.1.1', percent: 100, why: 'others', told: 1 })
    expect(said).toHaveBeenCalledWith('Quit your other Crews to update', { key: 'update' })
    expect(failed).not.toHaveBeenCalled()
  })

  it('says it again on the next press, and never for the same word twice', () => {
    put({ stage: 'ready', version: '0.1.1', percent: 100, why: 'others', told: 1 })
    put({ stage: 'ready', version: '0.1.1', percent: 100, why: 'others', told: 1 })
    expect(said).toHaveBeenCalledTimes(1)
    put({ stage: 'ready', version: '0.1.1', percent: 100, why: 'others', told: 2 })
    expect(said).toHaveBeenCalledTimes(2)
  })

  // Held, the pill has not changed what it is offering, and the word about it is
  // a toast rather than a stage. A pill that fell back to Update available read
  // as the download coming undone.
  it('keeps offering the restart after an install that was held', () => {
    render(createElement(UpdatePill))
    put({ stage: 'ready', version: '0.1.1', percent: 100, why: 'others', told: 1 })
    expect(pill()?.textContent).toBe('Restart to update')
    pill()?.click()
    expect(pressed).toHaveBeenCalled()
  })
})
