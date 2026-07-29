// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RunStatus from '../src/renderer/src/components/RunStatus'
import { setPref } from '../src/renderer/src/state/prefs'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear()
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const line = () =>
  render(createElement(RunStatus, { startedAt: Date.now(), tokens: 12_400, cost: 0.42, steps: [] })).container
    .textContent ?? ''

describe('what a working run says about itself', () => {
  it('counts the tokens and holds the price back', () => {
    expect(line()).toContain('12k tokens')
    expect(line()).not.toContain('$')
  })

  it('says the price once it is asked for', () => {
    setPref('cost', true)
    expect(line()).toContain('$0.42')
  })

  it('drops the count without dropping the run', () => {
    setPref('tokens', false)
    expect(line()).not.toContain('tokens')
    expect(screen.getAllByText(/^\d+s$/).length).toBeGreaterThan(0)
  })

  // A run priced at less than a cent is still a run that cost something, and
  // rounding it to nothing reads as a run that was free.
  it('says under a cent rather than nothing at all', () => {
    setPref('cost', true)
    const shown =
      render(createElement(RunStatus, { startedAt: Date.now(), tokens: 20, cost: 0.0004, steps: [] })).container
        .textContent ?? ''
    expect(shown).toContain('<$0.01')
  })

  // A run whose model nobody has priced draws no price at all rather than a
  // zero, which would read as a run that cost nothing.
  it('draws no price for a run that has none', () => {
    setPref('cost', true)
    const shown =
      render(createElement(RunStatus, { startedAt: Date.now(), tokens: 20, steps: [] })).container.textContent ?? ''
    expect(shown).not.toContain('$')
  })
})
