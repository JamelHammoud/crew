// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

const { ARROW_TIP, CursorArrow, DESIGN_CURSORS, applyDesignCursors } = await import(
  '../src/renderer/src/design/cursors'
)

const vars = DESIGN_CURSORS as unknown as Record<string, string>

const parse = (value: string) => {
  const match = value.match(/^url\("data:image\/svg\+xml,(.+)"\) (-?\d+) (-?\d+), ([a-z-]+)$/)
  if (!match) throw new Error(`not a cursor: ${value}`)
  return { svg: match[1], x: Number(match[2]), y: Number(match[3]), fallback: match[4] }
}

const size = (svg: string) => {
  const match = svg.match(/width='(\d+)' height='(\d+)' viewBox='0 0 (\d+) (\d+)'/)!
  return { w: Number(match[1]), h: Number(match[2]), viewBox: [Number(match[3]), Number(match[4])] }
}

describe('design cursors', () => {
  it('covers every cursor the board tools ask for', () => {
    expect(Object.keys(vars)).toEqual([
      '--tl-cursor-default',
      '--tl-cursor-pointer',
      '--tl-cursor-move',
      '--tl-cursor-text',
      '--tl-cursor-cross',
      '--tl-cursor-grab',
      '--tl-cursor-grabbing'
    ])
  })

  it('falls back to the native cursor of the same job', () => {
    expect(parse(vars['--tl-cursor-default']).fallback).toBe('default')
    expect(parse(vars['--tl-cursor-text']).fallback).toBe('text')
    expect(parse(vars['--tl-cursor-cross']).fallback).toBe('crosshair')
    expect(parse(vars['--tl-cursor-grab']).fallback).toBe('grab')
    expect(parse(vars['--tl-cursor-grabbing']).fallback).toBe('grabbing')
  })

  it('draws them all at one size, with the point inside it', () => {
    for (const [name, value] of Object.entries(vars)) {
      const { svg, x, y } = parse(value)
      const { w, h, viewBox } = size(svg)
      expect([w, h], name).toEqual(viewBox)
      expect(svg.endsWith('</svg>'), name).toBe(true)
      expect(x, name).toBeGreaterThanOrEqual(0)
      expect(x, name).toBeLessThanOrEqual(w)
      expect(y, name).toBeGreaterThanOrEqual(0)
      expect(y, name).toBeLessThanOrEqual(h)
    }
  })

  it('stays smaller than the art it is drawn from', () => {
    const { w, h } = size(parse(vars['--tl-cursor-default']).svg)
    expect(w).toBeLessThan(29)
    expect(h).toBeLessThan(30)
  })

  it('points from the tip of the arrow, wherever it is drawn', () => {
    const { x, y } = parse(vars['--tl-cursor-default'])
    expect(ARROW_TIP).toEqual({ x, y })
  })

  it('keeps the shadow with the art it belongs to', () => {
    for (const [name, value] of Object.entries(vars)) {
      const { svg } = parse(value)
      expect(svg, name).toContain("<filter id='drop'")
      expect(svg, name).toContain("filter='url(%23drop)'")
    }
  })

  it('gives someone else the same arrow in their own color', () => {
    const { container } = render(createElement(CursorArrow, { color: 'oklch(0.7 0.22 120)' }))
    const paths = container.querySelectorAll('path')
    const drawn = parse(vars['--tl-cursor-default'])
    expect(paths).toHaveLength(2)
    expect(paths[0].getAttribute('fill')).toBe('oklch(0.7 0.22 120)')
    expect(paths[1].getAttribute('stroke')).toBe('white')
    expect(paths[0].getAttribute('d')).toBe(drawn.svg.match(/<path d='([^']+)'/)![1])
    expect(container.querySelector('g')!.getAttribute('transform')).toBe(
      drawn.svg.match(/<g transform='([^']+)'/)![1]
    )
  })

  it('hands them to the canvas, which declares its own', () => {
    const container = document.createElement('div')
    applyDesignCursors(container)
    for (const [name, value] of Object.entries(vars)) {
      expect(container.style.getPropertyValue(name), name).toBe(value)
    }
  })
})
