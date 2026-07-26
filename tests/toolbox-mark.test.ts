// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ToolboxMark from '../src/renderer/src/components/ToolboxMark'
import {
  TOOLBOX_BODY,
  TOOLBOX_HANDLE,
  TOOLBOX_HINGE,
  TOOLBOX_LID,
  TOOLBOX_SWING
} from '../src/renderer/src/icons/objects'

afterEach(cleanup)

const styles = (): string =>
  (require('node:fs') as typeof import('node:fs')).readFileSync(
    `${process.cwd()}/src/renderer/src/styles.css`,
    'utf8'
  )

const mark = (): SVGElement => {
  const el = document.querySelector('.toolbox-mark')
  if (!el) throw new Error('no toolbox mark')
  return el as SVGElement
}

const lid = (): SVGElement => mark().querySelector('.toolbox-lid') as SVGElement

const paths = (el: Element): string[] =>
  [...el.querySelectorAll('path')].map(path => path.getAttribute('d') ?? '')

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

  it('hinges the lid and the handle together, off the far corner of the seam', () => {
    render(createElement(ToolboxMark, { open: true }))

    expect(paths(lid())).toEqual([TOOLBOX_LID, TOOLBOX_HANDLE])
    expect(paths(mark())).toContain(TOOLBOX_BODY)
    expect(mark().style.getPropertyValue('--hinge')).toBe(`${TOOLBOX_HINGE.x}px ${TOOLBOX_HINGE.y}px`)
    expect(mark().style.getPropertyValue('--swing')).toBe(`${TOOLBOX_SWING}deg`)
  })

  it('turns the lid on the hinge it is handed, and stands the motion down when asked', () => {
    const css = styles()
    expect(css).toContain('transform-origin: var(--hinge')
    expect(css).toMatch(/\.toolbox-mark\[data-state='open'\] \.toolbox-lid \{[^}]*rotate\(var\(--swing/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.toolbox-mark \.toolbox-lid,[^}]*\}\s*\}/
    )
  })

  it('keeps the lid inside the grid when it is open', () => {
    const radians = (TOOLBOX_SWING * Math.PI) / 180
    const turn = (x: number, y: number) => {
      const dx = x - TOOLBOX_HINGE.x
      const dy = y - TOOLBOX_HINGE.y
      return {
        x: TOOLBOX_HINGE.x + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: TOOLBOX_HINGE.y + dx * Math.sin(radians) + dy * Math.cos(radians)
      }
    }

    // The corners the turn carries furthest: the back edge going out, and the
    // handle coming up. Both stay off the edge of the 24 grid with a stroke on.
    const back = turn(TOOLBOX_HINGE.x, 11)
    const top = turn(12, 4.5)
    expect(back.x).toBeLessThan(22)
    expect(top.y).toBeGreaterThan(2)

    // And the front of the lid really comes up off the seam, or it reads shut.
    expect(turn(2.5, TOOLBOX_HINGE.y).y).toBeLessThan(TOOLBOX_HINGE.y - 3)
  })
})
