// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import ToolboxMark from '../src/renderer/src/components/ToolboxMark'
import { GRID, LIVE } from '../src/renderer/src/icons/keylines'
import { ToolboxGlyph } from '../src/renderer/src/icons/objects'
import {
  TOOLBOX_CASE,
  TOOLBOX_OPEN,
  TOOLBOX_SHUT,
  TOOLBOX_SWING,
  toolboxAt
} from '../src/renderer/src/icons/toolbox'

afterEach(cleanup)

const css = (require('node:fs') as typeof import('node:fs')).readFileSync(
  `${process.cwd()}/src/renderer/src/styles.css`,
  'utf8'
)
const rules = css.slice(
  css.indexOf('.toolbox-mark .toolbox-turn'),
  css.indexOf('/* The word turns over with the mark')
)

const RIM = 12.75

const mark = (): SVGElement => {
  const el = document.querySelector('.toolbox-mark')
  if (!el) throw new Error('no toolbox mark')
  return el as SVGElement
}

const moving = (): SVGElement[] => [...mark().querySelectorAll('.toolbox-turn')] as SVGElement[]

const paths = (el: Element): string[] =>
  [...el.querySelectorAll('path')].map(path => path.getAttribute('d') ?? '')

// Every corner the drawing turns, in the order it is written. An arc is read by
// where it lands rather than by the radii it takes to get there.
const corners = (d: string): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = []
  for (const [, letter, rest] of d.matchAll(/([MLA])([^MLAZ]*)/g)) {
    const all = (rest.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const landed = letter === 'A' ? all.slice(-2) : all
    for (let i = 0; i < landed.length; i += 2) out.push({ x: landed[i], y: landed[i + 1] })
  }
  return out
}

// What the transition really draws. The two drawings are walked into each other,
// so a curve that runs past 1 keeps going the way it was headed rather than
// swinging the lid any further.
const PEAK = 1.03
const at = (share: number, shut: string, open: string): { x: number; y: number }[] => {
  const from = corners(shut)
  return corners(open).map((point, i) => ({
    x: from[i].x + share * (point.x - from[i].x),
    y: from[i].y + share * (point.y - from[i].y)
  }))
}

// The weight the mark really wears, which is not the weight it is drawn at: a
// 22 sits in the band that takes nine tenths of the house stroke.
const worn = (): number => {
  render(createElement(ToolboxMark, { open: true }))
  return Number(mark().getAttribute('stroke-width'))
}

describe('the toolbox mark', () => {
  it('opens its lid while the panel is open, on the same drawing', () => {
    const { rerender } = render(createElement(ToolboxMark, { open: false }))
    expect(mark().getAttribute('data-state')).toBe('shut')

    const before = mark()
    rerender(createElement(ToolboxMark, { open: true }))
    // One mark carries both states, so the lid swings rather than one glyph
    // being swapped out for another.
    expect(mark()).toBe(before)
    expect(mark().getAttribute('data-state')).toBe('open')
  })

  it('is the still icon when it is shut', () => {
    render(createElement(ToolboxMark, { open: false }))
    const still = renderToStaticMarkup(createElement(ToolboxGlyph, {}))
    const drawn = [...(still.match(/ d="[^"]+"/g) ?? [])].map(d => d.slice(4, -1))

    expect(drawn).toEqual([TOOLBOX_CASE, TOOLBOX_SHUT.lid, TOOLBOX_SHUT.handle])
    expect(paths(mark())).toEqual([TOOLBOX_CASE, ...Object.values(TOOLBOX_SHUT).reverse()])
    expect(mark().getAttribute('stroke')).toBe('currentColor')

    // The sides of the lid are the one piece the still icon does not draw, and
    // shut they lie along the rim under the line already there.
    for (const point of corners(TOOLBOX_SHUT.collar)) expect(point.y).toBe(RIM)
  })

  it('closes the case across the top, so the mouth stays shut behind the lid', () => {
    // Without this the open mark is a lid floating over a U, which is what an
    // open toolbox is not.
    expect(TOOLBOX_CASE.endsWith('Z')).toBe(true)
    expect(TOOLBOX_CASE).toContain(`V${RIM}`)
  })

  it('hands each moving piece the shut drawing and the open one', () => {
    render(createElement(ToolboxMark, { open: true }))
    const pieces = moving()

    expect(pieces).toHaveLength(3)
    expect(pieces.map(piece => piece.getAttribute('d'))).toEqual([
      TOOLBOX_SHUT.collar,
      TOOLBOX_SHUT.lid,
      TOOLBOX_SHUT.handle
    ])
    expect(pieces.map(piece => piece.style.getPropertyValue('--open'))).toEqual([
      `path("${TOOLBOX_OPEN.collar}")`,
      `path("${TOOLBOX_OPEN.lid}")`,
      `path("${TOOLBOX_OPEN.handle}")`
    ])
    for (const [i, piece] of pieces.entries()) {
      expect(piece.style.getPropertyValue('--shut')).toBe(`path("${piece.getAttribute('d')}")`)
      expect(piece.style.getPropertyValue('--shut')).not.toBe(
        pieces[i].style.getPropertyValue('--open')
      )
    }
    // The case is not one of them.
    expect(paths(mark())[0]).toBe(TOOLBOX_CASE)
  })

  it('turns the lid by its shape rather than by a transform on it', () => {
    expect(rules).toMatch(/\.toolbox-mark \.toolbox-turn \{[^}]*d: var\(--shut\)[^}]*transition: d /)
    expect(rules).toMatch(/\.toolbox-mark\[data-state='open'\] \.toolbox-turn \{[^}]*d: var\(--open\)/)
    // A transform is what this replaced. No scale or skew narrows a rectangle
    // with the distance, and going back is the whole of what the lid does.
    expect(rules).not.toContain('transform')
    expect(rules).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.toolbox-mark \.toolbox-turn,[^}]*\}\s*\}/
    )
  })

  it('lifts the lid clear of the mouth and takes it back into the drawing', () => {
    const lid = corners(TOOLBOX_OPEN.lid)
    const collar = corners(TOOLBOX_OPEN.collar)

    // Clear of the case, or it reads shut. The white between the rim and the lid
    // is what says the box is open.
    expect(RIM - lid[0].y - STROKE).toBeGreaterThan(1)
    // Narrowing as it goes, or it reads as a lid lifted straight up.
    expect(lid[1].x).toBeGreaterThan(lid[0].x)
    expect(lid[2].x - lid[0].x).toBeGreaterThan(corners(TOOLBOX_SHUT.lid)[2].x - 2.5)
    // The hinge is the full depth of the box behind the front, so the sides of
    // the lid come back to a pair of feet well inside the corners of the case.
    expect(collar[0].x - STROKE / 2).toBeGreaterThan(2.5 + STROKE / 2)
    expect(collar[0].x).toBeGreaterThan(collar[1].x)
    expect(collar[0].y).toBe(RIM)
    // And they are welded to the lid, at both ends of the swing and every point
    // between, or the lid comes away from the box on the way up.
    expect(collar[1]).toEqual(lid[0])
    expect(corners(TOOLBOX_SHUT.collar)[1]).toEqual(corners(TOOLBOX_SHUT.lid)[0])
  })

  it('keeps the lid inside the grid and its counters open at the top of the swing', () => {
    render(createElement(ToolboxMark, { open: true }))
    expect(Number(mark().getAttribute('stroke-width'))).toBe(STROKE)

    const lid = at(PEAK, TOOLBOX_SHUT.lid, TOOLBOX_OPEN.lid)
    const handle = at(PEAK, TOOLBOX_SHUT.handle, TOOLBOX_OPEN.handle)

    // The handle is what the swing carries furthest, and it carries it up.
    expect(handle[2].y).toBeGreaterThan((GRID - LIVE) / 2)

    // Every counter has to survive the flattening, or the lid and the handle
    // close into bars at the size this is worn.
    expect(RIM - lid[0].y - STROKE).toBeGreaterThan(1)
    expect(lid[0].y - lid[2].y - STROKE).toBeGreaterThan(1)
    expect(handle[0].y - handle[2].y - STROKE).toBeGreaterThan(1)
  })

  it('stands still when it is not turned', () => {
    expect(toolboxAt(0)).toEqual(TOOLBOX_SHUT)
    expect(toolboxAt(TOOLBOX_SWING)).toEqual(TOOLBOX_OPEN)
    expect(TOOLBOX_SWING).toBeGreaterThan(0)
  })
})
