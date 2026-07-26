// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import tldrawCss from 'tldraw/tldraw.css?raw'

const { CursorArrow, DESIGN_CURSORS } = await import('../src/renderer/src/design/cursors')

const vars = DESIGN_CURSORS as unknown as Record<string, string>

const parse = (value: string) => {
  const match = value.match(/^url\("data:image\/svg\+xml,(.+)"\) (-?\d+) (-?\d+), ([a-z-]+)$/)
  if (!match) throw new Error(`not a cursor: ${value}`)
  return { svg: match[1], x: Number(match[2]), y: Number(match[3]), fallback: match[4] }
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

  it('names them the way the canvas reads them', () => {
    for (const name of Object.keys(vars)) expect(tldrawCss).toContain(`${name}:`)
  })

  it('falls back to the native cursor of the same job', () => {
    expect(parse(vars['--tl-cursor-default']).fallback).toBe('default')
    expect(parse(vars['--tl-cursor-text']).fallback).toBe('text')
    expect(parse(vars['--tl-cursor-cross']).fallback).toBe('crosshair')
    expect(parse(vars['--tl-cursor-grab']).fallback).toBe('grab')
    expect(parse(vars['--tl-cursor-grabbing']).fallback).toBe('grabbing')
  })

  it('draws each one at the point it is pointing at', () => {
    for (const [name, value] of Object.entries(vars)) {
      const { svg, x, y } = parse(value)
      expect(svg, name).toMatch(/^<svg [^>]*viewBox='0 0 29 30'/)
      expect(svg.endsWith('</svg>'), name).toBe(true)
      expect(x, name).toBeGreaterThanOrEqual(0)
      expect(x, name).toBeLessThanOrEqual(29)
      expect(y, name).toBeGreaterThanOrEqual(0)
      expect(y, name).toBeLessThanOrEqual(30)
    }
  })

  it('holds the point of the arrow at its tip', () => {
    const { x, y } = parse(vars['--tl-cursor-default'])
    expect([x, y]).toEqual([7, 6])
  })

  it('keeps the shadow with the art it belongs to', () => {
    for (const [name, value] of Object.entries(vars)) {
      const { svg } = parse(value)
      expect(svg, name).toContain("<filter id='drop'")
      expect(svg, name).toContain("filter='url(%23drop)'")
    }
  })

  it('gives someone else the same arrow in their own color', () => {
    const { container } = render(createElement(CursorArrow, { color: 'oklch(0.76 0.15 120)' }))
    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(2)
    expect(paths[0].getAttribute('fill')).toBe('oklch(0.76 0.15 120)')
    expect(paths[1].getAttribute('stroke')).toBe('white')
    expect(paths[0].getAttribute('d')).toBe(parse(vars['--tl-cursor-default']).svg.match(/d='([^']+)'/)![1])
  })
})
