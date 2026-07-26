// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

const { ARROW_TIP, CursorArrow, DESIGN_CURSORS, applyDesignCursors, applyToolCursor } = await import(
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

const placement = (svg: string) => svg.match(/<path d='[^']+' transform='([^']+)'/)?.[1] ?? ''

const drawn = (svg: string) => {
  const d = svg.match(/<path d='([^']+)'/)![1]
  const scale = Number(svg.match(/<g transform='translate\([^)]+\) scale\(([\d.]+)\)'/)![1])
  const xs: number[] = []
  const ys: number[] = []
  for (const step of d.match(/[MHV][-\d. ]*/g)!) {
    const numbers = step.slice(1).trim().split(' ').map(Number)
    if (step[0] === 'M') xs.push(numbers[0]), ys.push(numbers[1])
    if (step[0] === 'H') xs.push(...numbers)
    if (step[0] === 'V') ys.push(...numbers)
  }
  const span = (values: number[]) => (Math.max(...values) - Math.min(...values)) * scale
  return { w: span(xs), h: span(ys) }
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

  it('keeps the target small enough to aim with', () => {
    const { svg } = parse(vars['--tl-cursor-cross'])
    const { w, h } = size(svg)
    const art = drawn(svg)
    expect(art.w).toBeCloseTo(art.h)
    expect(art.w).toBeLessThan(13)
    expect(art.w).toBeGreaterThan(9)
    expect(w - art.w).toBeGreaterThan(4)
    expect(h - art.h).toBeGreaterThan(4)
  })

  it('turns the hands over so the thumb is on the left', () => {
    expect(placement(parse(vars['--tl-cursor-grab']).svg)).toContain('scale(-0.9 0.9)')
    expect(placement(parse(vars['--tl-cursor-grabbing']).svg)).toBe(
      placement(parse(vars['--tl-cursor-grab']).svg)
    )
  })

  it('hands the pencil its own cursor and takes it back', () => {
    const container = document.createElement('div')
    applyDesignCursors(container)
    applyToolCursor(container, 'draw')
    const drawing = container.style.getPropertyValue('--tl-cursor-cross')
    expect(drawing).not.toBe(vars['--tl-cursor-cross'])
    const pencil = parse(drawing)
    const { w, h, viewBox } = size(pencil.svg)
    expect([w, h]).toEqual(viewBox)
    expect(pencil.fallback).toBe('crosshair')
    expect(pencil.x).toBeGreaterThan(0)
    expect(pencil.y).toBeLessThan(h)
    applyToolCursor(container, 'select')
    expect(container.style.getPropertyValue('--tl-cursor-cross')).toBe(vars['--tl-cursor-cross'])
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
