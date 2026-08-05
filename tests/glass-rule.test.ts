import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const LEGIBLE = 0.9

const OVER_SOMETHING_ELSE = ['.mac .sidebar-pinned', '.mac.light .sidebar-pinned', '.glass-lit', '.light .glass-lit']

const blocks = (): { selector: string; body: string }[] =>
  [...styles.matchAll(/^([^@\s][^{}\n]*?)\s*\{\n([^{}]*?)\n\}/gm)].map(([, selector, body]) => ({
    selector: selector.trim(),
    body
  }))

const tint = (body: string): number[] => {
  const said = /(?:^|\n)\s*(?:background|--glass-bg)\s*:([^;]*)/.exec(body)?.[1]
  return said ? [...said.matchAll(/rgb\([^)]*\/\s*([\d.]+)\s*\)/g)].map(([, alpha]) => Number(alpha)) : []
}

const surfaces = (): { selector: string; alpha: number }[] =>
  blocks()
    .filter(block => /glass|sidebar-/.test(block.selector))
    .flatMap(block => tint(block.body).map(alpha => ({ selector: block.selector, alpha })))

const alphaOf = (selector: string): number => surfaces().find(one => one.selector === selector)?.alpha ?? 0

describe('what a floating panel lets through', () => {
  it('reads the sheet', () => {
    expect(surfaces().map(one => one.selector)).toContain(':root')
    expect(surfaces().length).toBeGreaterThan(6)
  })

  it('never lets the words behind it be read', () => {
    const thin = surfaces().filter(one => one.alpha < LEGIBLE && !OVER_SOMETHING_ELSE.includes(one.selector))
    expect(thin).toEqual([])
  })

  it('holds the ones that stand over something other than the app', () => {
    for (const selector of OVER_SOMETHING_ELSE) expect(alphaOf(selector)).toBeGreaterThan(0)
  })

  it('still blurs, so what does come through is a wash rather than an edge', () => {
    for (const selector of ['.glass', '.glass-strong', '.sidebar-glass']) {
      const block = blocks().find(one => one.selector === selector)
      expect(block?.body ?? '').toMatch(/backdrop-filter:\s*blur\(\d+px\)/)
    }
  })

  it('keeps the glass deeper over the canvas than over the app', () => {
    expect(alphaOf('.glass-strong')).toBeGreaterThan(alphaOf(':root'))
    expect(alphaOf('.sidebar-glass.glass-strong')).toBeGreaterThan(alphaOf('.sidebar-glass'))
    expect(alphaOf('.light .sidebar-glass.glass-strong')).toBeGreaterThan(alphaOf('.light .sidebar-glass'))
  })
})
