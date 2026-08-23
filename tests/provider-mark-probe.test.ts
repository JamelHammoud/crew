// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import ProviderMark from '../src/renderer/src/components/ProviderMark'
import { STROKE, wearWeight } from '../src/renderer/src/icons'

// A server somebody wrote down themselves is the one provider with no logo of
// its own, so it is the one place this mark is Crew speaking rather than a
// vendor. The tile and the rim belong to the artwork: both are there for a
// picture that runs to its own edge, and under a line drawing they are a swatch
// nobody asked for and a box drawn around nothing.
describe('the mark a server somebody wrote down wears', () => {
  const custom = 'server:http://192.0.2.10:8080/v1'
  const drawn = (provider: string, className?: string) =>
    render(createElement(ProviderMark, { provider, className })).container

  it("is one mark of Crew's own rather than a picture per address", () => {
    const container = drawn(custom)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
    const mark = container.querySelector('svg')
    expect(mark?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(mark?.getAttribute('stroke')).toBe('currentColor')
  })

  it('stands bare, in the foreground at an opacity', () => {
    const container = drawn(custom)
    expect(container.innerHTML).not.toMatch(/ring-inset|rounded-\[22%\]|bg-fg|bg-ink/)
    const className = container.querySelector('svg')?.getAttribute('class') ?? ''
    expect(className).toMatch(/text-fg\/\d+/)
    expect(className).not.toMatch(/text-fg-(faint|muted|secondary)/)
  })

  // A stroke does not scale with the icon, so one number is spindly at 16 and
  // chunky at 48. The size is read off the class the caller already writes.
  it('takes its weight off the size it is worn at', () => {
    const weight = (className?: string) => drawn(custom, className).querySelector('svg')?.getAttribute('stroke-width')
    expect(weight()).toBe(String(wearWeight(STROKE, 'w-4 h-4')))
    expect(weight('w-12 h-12 rounded-2xl')).toBe(String(wearWeight(STROKE, 'w-12 h-12')))
    expect(weight()).not.toBe(weight('w-12 h-12 rounded-2xl'))
  })

  it('leaves a vendor wearing its own artwork in its own tile', () => {
    const container = drawn('claude')
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.innerHTML).toMatch(/rounded-\[22%\]/)
    expect(container.innerHTML).toMatch(/ring-inset/)
  })
})
