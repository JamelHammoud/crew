// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GeneratedField from '../src/renderer/src/components/art/GeneratedField'
import { coverFor } from '../src/renderer/src/components/art/coverArt'

vi.mock('../src/renderer/src/components/art/coverArt', () => ({
  coverFor: vi.fn(() => document.createElement('canvas'))
}))

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('a generated field', () => {
  it('draws the same photographed scene at small and large sizes', () => {
    const small = render(createElement(GeneratedField, { seed: 'jamel/codex', box: 20 }))
    expect(small.container.querySelector('canvas')).not.toBeNull()
    small.unmount()

    const large = render(createElement(GeneratedField, { seed: 'jamel/codex', box: 48 }))
    expect(large.container.querySelector('canvas')).not.toBeNull()
    expect(coverFor).toHaveBeenCalledTimes(2)
  })
})
