import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const rule = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

const shut = () => rule('.rail {')
const open = () => rule('.rail[data-open] {')

const seconds = (css: string): number => Number(/transform\s+(\d*\.?\d+)s/.exec(css)?.[1])
const opacity = (css: string): number =>
  Number(/(?:background|--glass-bg):\s*rgb\([^)]*\/\s*(\d*\.?\d+)\)/.exec(css)?.[1])

describe('the glass the hovered rail wears', () => {
  it('is the tint any panel over the app wears, and blurs harder than one', () => {
    const sidebar = rule('.sidebar-glass {')
    expect(opacity(sidebar)).toBe(opacity(rule(':root {')))
    expect(sidebar).toMatch(/backdrop-filter:\s*blur\(32px\)/)
    expect(rule('.glass {')).toMatch(/backdrop-filter:\s*blur\(24px\)/)
  })

  it('stays lighter over the design canvas', () => {
    expect(opacity(rule('.sidebar-glass.glass-strong {'))).toBeLessThan(opacity(rule('.glass-strong {')))
  })
})

describe('the glass the expanded sidebar wears on macOS', () => {
  it('lets more of the desktop through than the general glass surface', () => {
    const sidebar = rule('.mac .sidebar-pinned {')
    expect(opacity(sidebar)).toBeLessThan(opacity(rule(':root {')))
    expect(sidebar).toMatch(/backdrop-filter:\s*blur\(32px\)/)
  })

  it('keeps the light surface translucent too', () => {
    expect(opacity(rule('.mac.light .sidebar-pinned {'))).toBeLessThan(1)
  })
})

describe('the way the hovered rail arrives and leaves', () => {
  it('is a transition rather than a keyframe, so one caught halfway turns around', () => {
    expect(styles).not.toContain('@keyframes rail')
    expect(shut()).toMatch(/transition:/)
    expect(open()).toMatch(/transition:/)
  })

  it('comes from its own edge, so the rows inside it never move', () => {
    expect(shut()).toContain('translateX(-100%)')
    expect(open()).toContain('translateX(0)')
  })

  it('goes quicker than it arrives', () => {
    expect(seconds(shut())).toBeGreaterThan(0)
    expect(seconds(shut())).toBeLessThan(seconds(open()))
  })

  it('is out of reach and casts no shadow of its own once it has gone', () => {
    expect(shut()).toMatch(/visibility:\s*hidden/)
    expect(shut()).toMatch(/visibility\s+0s\s+linear/)
    expect(open()).toMatch(/visibility:\s*visible/)
  })

  it('lands where it was going for anyone who asked for less motion', () => {
    const at = styles.indexOf('.rail,\n  .rail[data-open]')
    expect(at).toBeGreaterThan(-1)
    expect(styles.slice(at, at + 200)).toMatch(/transition-duration:\s*1ms/)
  })
})
