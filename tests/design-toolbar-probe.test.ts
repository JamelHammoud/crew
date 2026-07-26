// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext, type Editor } from 'tldraw'
import { fakeBoard } from './helpers/design-editor'

const { default: DesignToolbar } = await import('../src/renderer/src/components/DesignToolbar')
const { ARROW_BODY, ARROW_ON_GRID } = await import('../src/renderer/src/design/cursors')
const { CursorGlyph, RectangleGlyph } = await import('../src/renderer/src/design/glyphs')

afterEach(cleanup)

function toolbar(tool = 'select') {
  const board = fakeBoard([])
  const editor = {
    ...board.editor,
    getCurrentToolId: () => tool,
    setCurrentTool: () => {}
  } as unknown as Editor
  render(
    createElement(
      EditorContext.Provider,
      { value: editor },
      createElement(DesignToolbar, { onAsk: () => {}, onRename: () => {} })
    )
  )
}

const drawn = (Icon: typeof CursorGlyph): SVGPathElement => {
  render(createElement(Icon, { className: 'w-6 h-6' }))
  return document.querySelector('svg path') as SVGPathElement
}

const step = (className: string, prefix: string) => {
  const found = className.match(new RegExp(`(?:^|\\s)${prefix}-([\\d.]+)(?:\\s|$)`))
  return found ? Number(found[1]) * 4 : null
}

const placed = (transform: string) => {
  const move = transform.match(/translate\((-?[\d.]+) (-?[\d.]+)\)/)!
  const scale = Number(transform.match(/scale\(([\d.]+)\)/)![1])
  return { x: Number(move[1]), y: Number(move[2]), scale }
}

describe('the design toolbar', () => {
  it('draws the Move tool from the same arrow the board points with', () => {
    expect(drawn(CursorGlyph).getAttribute('d')).toBe(ARROW_BODY)
  })

  it('stands that arrow on the 24 grid the marks beside it are drawn on', () => {
    const path = drawn(CursorGlyph)
    const { x, y, scale } = placed(path.getAttribute('transform')!)
    const numbers = (ARROW_BODY.match(/-?[\d.]+/g) ?? []).map(Number)
    for (let at = 0; at < numbers.length; at += 2) {
      expect(numbers[at] * scale + x).toBeGreaterThan(3)
      expect(numbers[at] * scale + x).toBeLessThan(21)
      expect(numbers[at + 1] * scale + y).toBeGreaterThan(3)
      expect(numbers[at + 1] * scale + y).toBeLessThan(21)
    }
  })

  it('carries the arrow at the weight of every other mark', () => {
    const arrow = drawn(CursorGlyph)
    const { scale } = placed(arrow.getAttribute('transform')!)
    const weight = Number(arrow.getAttribute('stroke-width')) * scale
    const family = Number(drawn(RectangleGlyph).ownerSVGElement!.getAttribute('stroke-width'))
    expect(weight).toBeCloseTo(family, 1)
  })

  it('holds a tool and its menu in one pill, so hovering lights the whole of it', () => {
    toolbar()
    const chevron = screen.getByLabelText('Shape tools options')
    const pill = chevron.parentElement!
    expect(pill.contains(screen.getByLabelText('Rectangle'))).toBe(true)
    expect(pill.className).toContain('hover:bg-fg/[0.06]')
    expect(screen.getByLabelText('Rectangle').className).not.toMatch(/(^|\s)(hover:)?bg-/)
  })

  it('fills that same pill when the tool is the one in hand', () => {
    toolbar()
    const pill = screen.getByLabelText('Move tools options').parentElement!
    expect(pill.className).toContain('bg-fg')
    expect(pill.contains(screen.getByLabelText('Move'))).toBe(true)
  })

  it('sets every mark the same way in from the ends of its own pill', () => {
    toolbar()
    expect(step(screen.getByLabelText('Move').className, 'pl')).toBe(8)
    expect(step(screen.getByLabelText('Move tools options').className, 'pr')).toBe(8)
    expect(step(screen.getByLabelText('Text').className, 'px')).toBe(8)
    expect(step(screen.getByLabelText('Note').className, 'px')).toBe(8)
  })

  it('stands in from the ends of the bar by the sliver it leaves above and below a pill', () => {
    toolbar()
    const bar = screen.getByRole('toolbar')
    const pill = screen.getByLabelText('Move tools options').parentElement!
    expect(step(bar.className, 'px')).toBe((step(bar.className, 'h')! - step(pill.className, 'h')!) / 2)
  })
})
