import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { measure, type Box } from '../scripts/icon-geometry.mjs'
import * as icons from '../src/renderer/src/icons'
import type { Glyph } from '../src/renderer/src/components/glyph'
import { CIRCLE, GRID, LINE, LIVE, SQUARE, STROKE } from '../src/renderer/src/icons/keylines'

// An icon set is one drawing repeated with different insides, and the way it
// stops being that is one shape at a time. These are the rules a shape has to
// keep to stay in the set, checked against the art itself rather than against
// what the art was meant to be.

type Art = { name: string; markup: string; box: Box }

const CAP = 18.5
const TOLERANCE = 8

// The barrel carries the keyline numbers as well as the art, so the glyphs are
// picked out by name rather than by being functions.
const drawn: Art[] = Object.entries(icons as Record<string, unknown>)
  .filter(([name]) => name.endsWith('Glyph'))
  .map(([name, Icon]) => {
    const markup = renderToStaticMarkup(createElement(Icon as Glyph, {}))
    const box = measure(markup)
    if (!box) throw new Error(`${name} draws nothing`)
    return { name, markup, box }
  })

const keyline = (box: Box) => {
  if (!box.body) return { family: 'line', target: LINE, size: Math.max(box.width, box.height, box.reach) }
  if (box.round && Math.abs(box.width - box.height) < 1.2)
    return { family: 'round', target: CIRCLE, size: (box.width + box.height) / 2 }
  return { family: 'shape', target: SQUARE, size: Math.sqrt(box.width * box.height) }
}

describe('crew icons', () => {
  it('draws something for every export', () => {
    expect(drawn.length).toBeGreaterThan(60)
  })

  it.each(drawn)('$name stays inside the live area', ({ box }) => {
    const edge = (GRID - LIVE) / 2
    expect(box.x).toBeGreaterThanOrEqual(edge - 0.01)
    expect(box.y).toBeGreaterThanOrEqual(edge - 0.01)
    expect(box.x + box.width).toBeLessThanOrEqual(GRID - edge + 0.01)
    expect(box.y + box.height).toBeLessThanOrEqual(GRID - edge + 0.01)
  })

  it.each(drawn)('$name sits in the middle of its box', ({ box }) => {
    expect(Math.abs(box.cx - GRID / 2)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(box.cy - GRID / 2)).toBeLessThanOrEqual(0.5)
  })

  // The one that keeps the set looking like one size. A shape already touching
  // the live area has nowhere left to grow and is allowed to sit light.
  it.each(drawn)('$name sits on the keyline for its family', ({ box }) => {
    const { target, size } = keyline(box)
    if (Math.max(box.width, box.height) >= CAP) {
      expect(size).toBeLessThanOrEqual(LIVE + 0.01)
      return
    }
    expect(Math.abs(size / target - 1) * 100).toBeLessThanOrEqual(TOLERANCE)
  })

  it.each(drawn)('$name is drawn in the current colour on the house frame', ({ markup }) => {
    expect(markup).toContain(`viewBox="0 0 ${GRID} ${GRID}"`)
    expect(markup).toContain(`stroke-width="${STROKE}"`)
    expect(markup).toContain('stroke="currentColor"')
    expect(markup).not.toMatch(/(#[0-9a-f]{3,8}|rgb\(|hsl\()/i)
  })

  it('never draws the same idea twice', () => {
    const seen = new Map<string, string>()
    for (const { name, markup } of drawn) {
      const art = markup.replace(/<svg[^>]*>/, '')
      const already = seen.get(art)
      expect(already, `${name} is the same drawing as ${already}`).toBeUndefined()
      seen.set(art, name)
    }
  })
})
