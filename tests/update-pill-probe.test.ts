// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
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
  toast: Object.assign(
    (text: string, opts?: unknown) => said(text, opts),
    { fail: (text: string, opts?: unknown) => failed(text, opts) }
  )
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

function fill(): HTMLElement | null {
  return document.querySelector('[aria-hidden]')
}

describe('the update pill', () => {
  it('stands only when there is an update', () => {
    render(createElement(UpdatePill))
    expect(pill()).toBeNull()
    put({ stage: 'found', version: '0.1.1' })
    expect(pill()?.textContent).toBe('Update available')
  })

  it('is the one white thing in the row while it is asking to be pressed', () => {
    render(createElement(UpdatePill))
    put({ stage: 'found', version: '0.1.1' })
    expect(pill()?.className).toContain('bg-fg ')
    expect(pill()?.className).toContain('text-ink-900')
    expect(pill()?.disabled).toBe(false)
  })

  it('writes the word on each side of the fill while the new Crew comes down', () => {
    render(createElement(UpdatePill))
    put({ stage: 'getting', percent: 40 })
    expect(screen.getAllByText('Updating')).toHaveLength(2)
    expect(fill()?.style.width).toBe('40%')
  })

  it('fills as far as the download has come', () => {
    render(createElement(UpdatePill))
    put({ stage: 'getting', percent: 12 })
    expect(fill()?.style.width).toBe('12%')
    put({ stage: 'getting', percent: 91 })
    expect(fill()?.style.width).toBe('91%')
  })

  it('has nothing to fill and nothing to press once it is working', () => {
    render(createElement(UpdatePill))
    put({ stage: 'found', version: '0.1.1' })
    expect(fill()).toBeNull()
    put({ stage: 'getting', percent: 40 })
    expect(pill()?.disabled).toBe(true)
    pill()?.click()
    expect(pressed).not.toHaveBeenCalled()
  })

  it('offers the restart the moment it lands', () => {
    render(createElement(UpdatePill))
    put({ stage: 'ready', version: '0.1.1', percent: 100 })
    expect(pill()?.textContent).toBe('Restart to update')
    expect(fill()).toBeNull()
    pill()?.click()
    expect(pressed).toHaveBeenCalled()
  })

  it('offers the same thing again after a download that did not arrive', () => {
    render(createElement(UpdatePill))
    put({ stage: 'failed', version: '0.1.1' })
    expect(pill()?.textContent).toBe('Update available')
    expect(pill()?.className).toContain('bg-fg ')
    pill()?.click()
    expect(pressed).toHaveBeenCalled()
  })
})
