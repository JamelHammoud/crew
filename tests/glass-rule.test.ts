import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const LEGIBLE = 0.9

const OVER_SOMETHING_ELSE = ['.mac .sidebar-pinned', '.mac.light .sidebar-pinned', '.glass-lit', '.light .glass-lit']

const rules = (): { selector: string; body: string }[] => {
  const found: { selector: string; body: string }[] = []
  const pattern = /^([^@{}\n][^{}]*)\{([^{}]*)\}/gm
  for (const [, selector, body] of styles.matchAll(pattern)) {
    found.push({ selector: selector.trim().replace(/\s+/g, ' '), body })
  }
  return found
}

const alphas = (text: string): number[] =>
  [...text.matchAll(/rgb\([^)]*\/\s*([\d.]+)\s*\)/g)].map(([, alpha]) => Number(alpha))

const surfaces = (): { selector: string; alpha: number }[] =>
  rules()
    .filter(rule => /glass|sidebar-/.test(rule.selector))
    .flatMap(rule =>
      alphas((/(?:^|[;{]\s*)(?:background|--glass-bg)\s*:([^;]*)/.exec(rule.body)?.[1] ?? '')).map(alpha => ({
        selector: rule.selector,
        alpha
      }))
    )

describe('what a floating panel lets through', () => {
  it('reads the sheet', () => {
    expect(surfaces().length).toBeGreaterThan(6)
  })

  it('never lets the words behind it be read', () => {
    const thin = surfaces().filter(
      surface => surface.alpha < LEGIBLE && !OVER_SOMETHING_ELSE.includes(surface.selector)
    )
    expect(thin).toEqual([])
  })

  it('holds the two that stand over something other than the app', () => {
    for (const selector of OVER_SOMETHING_ELSE) {
      expect(styles).toContain(selector)
    }
  })

  it('still blurs, so what does come through is a wash rather than an edge', () => {
    for (const selector of ['.glass', '.glass-strong', '.sidebar-glass']) {
      const rule = rules().find(one => one.selector === selector)
      expect(rule?.body).toMatch(/backdrop-filter:\s*blur\(\d+px\)/)
    }
  })

  it('keeps the glass deeper over the canvas than over the app', () => {
    const of = (selector: string): number => surfaces().find(one => one.selector === selector)?.alpha ?? 0
    expect(of('.glass-strong')).toBeGreaterThan(of(':root'))
    expect(of('.sidebar-glass.glass-strong')).toBeGreaterThan(of('.sidebar-glass'))
    expect(of('.light .sidebar-glass.glass-strong')).toBeGreaterThan(of('.light .sidebar-glass'))
  })
})
