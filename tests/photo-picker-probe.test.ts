// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgentIcon from '../src/renderer/src/components/AgentIcon'
import Avatar from '../src/renderer/src/components/Avatar'
import PhotoPicker from '../src/renderer/src/components/PhotoPicker'
import { PhotoGlyph, UploadGlyph } from '../src/renderer/src/icons'
import { useCrew } from '../src/renderer/src/state/store'

afterEach(cleanup)

function drawn(glyph: Parameters<typeof createElement>[0]) {
  const { container } = render(createElement(glyph))
  const svg = container.querySelector('svg')?.innerHTML ?? ''
  cleanup()
  return svg
}

function layer(element: Element | null) {
  const found = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(element?.getAttribute('class') ?? '')
  return found ? Number(found[1]) : 0
}

function faces() {
  useCrew.setState({ members: [{ id: 'jamel', name: 'Jamel', connected: true }], agents: [], httpBase: '' })
  return [
    createElement(PhotoPicker, { has: false, onChange: vi.fn() }, createElement(Avatar, { name: 'Jamel', presence: 'online' })),
    createElement(PhotoPicker, { has: false, onChange: vi.fn() }, createElement(AgentIcon, { seed: 'jamel/claude', presence: 'online' }))
  ]
}

describe('the control on a face', () => {
  it('wears the upload mark rather than a picture', () => {
    for (const face of faces()) {
      render(face)
      const svg = screen.getByLabelText('Add a photo').querySelector('svg')
      expect(svg?.innerHTML).toBe(drawn(UploadGlyph))
      expect(svg?.innerHTML).not.toBe(drawn(PhotoGlyph))
      cleanup()
    }
  })

  it('darkens the face under the presence dot, never over it', () => {
    for (const face of faces()) {
      const { container } = render(face)
      const scrim = screen.getByLabelText('Add a photo')
      const dot = container.querySelector('[class*="bg-positive"]')

      expect(dot).toBeTruthy()
      expect(scrim.contains(dot)).toBe(false)
      expect(layer(dot)).toBeGreaterThan(layer(scrim))
      cleanup()
    }
  })
})
