// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import ToolboxMark from '../src/renderer/src/components/ToolboxMark'
import { GRID, LIVE } from '../src/renderer/src/icons/keylines'
import {
  TOOLBOX_BODY,
  TOOLBOX_HANDLE,
  TOOLBOX_HINGE,
  TOOLBOX_LID,
  ToolboxGlyph,
  toolboxTurn
} from '../src/renderer/src/icons/objects'

afterEach(cleanup)

const css = readFileSync(`${process.cwd()}/src/renderer/src/styles.css`, 'utf8')
const rules = css.slice(css.indexOf('.toolbox-mark .toolbox-lid'), css.indexOf('/* Everything that carries a color'))

const mark = (): SVGElement => {
  const el = document.querySelector('.toolbox-mark')
  if (!el) throw new Error('no toolbox mark')
  return el as SVGElement
}

const lid = (): SVGElement => mark().querySelector('.toolbox-lid') as SVGElement

const paths = (el: Element): string[] =>
  [...el.querySelectorAll('path')].map(path => path.getAttribute('d') ?? '')

// What the transition really draws: every number in the list runs from the shut
// value to the open one together, so the swing is read at a share of itself.
const turnAt = (progress: number) => {
  const open = toolboxTurn()
  return {
    rise: progress * open.rise,
    squash: 1 + progress * (open.squash - 1),
    away: 1 + progress * (open.away - 1)
  }
}

const lifted = (y: number, at = turnAt(1)): number =>
  TOOLBOX_HINGE.y - (TOOLBOX_HINGE.y - y) * at.squash * at.away - at.rise

// The open curve carries the lid this far past itself before it settles.
const PEAK = 1.058

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

    expect(paths(mark())).toEqual([...(still.match(/ d="[^"]+"/g) ?? [])].map(d => d.slice(4, -1)))
    expect(mark().getAttribute('stroke')).toBe('currentColor')
  })

  it('hands the lid and the handle one hinge, at the middle of the mouth', () => {
    render(createElement(ToolboxMark, { open: true }))
    const turn = toolboxTurn()

    expect(paths(lid())).toEqual([TOOLBOX_LID, TOOLBOX_HANDLE])
    expect(paths(mark())).toContain(TOOLBOX_BODY)
    expect(TOOLBOX_HINGE.x).toBe(GRID / 2)
    expect(mark().style.getPropertyValue('--hinge')).toBe(`${TOOLBOX_HINGE.x}px ${TOOLBOX_HINGE.y}px`)
    expect(mark().style.getPropertyValue('--rise')).toBe(`${turn.rise}px`)
    expect(mark().style.getPropertyValue('--squash')).toBe(String(turn.squash))
    expect(mark().style.getPropertyValue('--away')).toBe(String(turn.away))
  })

  it('turns the lid in space rather than tilting it on the page', () => {
    expect(rules).toContain('transform-origin: var(--hinge')
    expect(rules).toMatch(
      /\.toolbox-mark\[data-state='open'\] \.toolbox-lid \{[^}]*translateY\(calc\(var\(--rise[^}]*scale\(var\(--away[^}]*scaleY\(var\(--squash/
    )
    // A rotate is the tilt this replaced. The lid is hinged behind the drawing,
    // so it lifts and flattens instead of leaning over.
    expect(rules).not.toContain('rotate(')
    expect(rules).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.toolbox-mark \.toolbox-lid,[^}]*\}\s*\}/)
  })

  it('lifts the lid clear of the mouth and flattens it as it goes over', () => {
    const turn = toolboxTurn()

    // Clear of the case, or it reads shut. It is what says the box is open.
    expect(TOOLBOX_HINGE.y - lifted(TOOLBOX_HINGE.y)).toBeGreaterThan(2)
    // And flattened, or it reads as a lid lifted straight up rather than turned.
    expect(turn.squash).toBeLessThan(0.85)
    expect(turn.away).toBeLessThan(1)
  })

  it('keeps the lid inside the grid and its counters open at the top of the swing', () => {
    render(createElement(ToolboxMark, { open: true }))
    const stroke = Number(mark().getAttribute('stroke-width'))
    const peak = turnAt(PEAK)

    // The handle is what the swing carries furthest, and it carries it up.
    const top = lifted(4.5, peak)
    expect(top).toBeGreaterThan((GRID - LIVE) / 2)
    expect(top - stroke / 2).toBeGreaterThan(1.5)

    // Both counters have to survive the flattening, or the lid and the handle
    // close into bars at the size this is worn.
    expect(lifted(12.75, peak) - lifted(8.5, peak) - stroke).toBeGreaterThan(1)
    expect(lifted(8.5, peak) - lifted(4.5, peak) - stroke).toBeGreaterThan(1)
  })
})
