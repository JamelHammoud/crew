import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const renderer = path.join(root, 'src/renderer/src')
const read = (at: string): string => readFileSync(path.join(renderer, at), 'utf8')

const styles = read('styles.css')
const app = read('App.tsx')
const chat = read('views/Chat.tsx')
const docs = read('views/Docs.tsx')
const thread = read('views/ThreadView.tsx')

const block = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

const HEIGHT = Number(/--page-scrim:\s*(\d+)px/.exec(styles)?.[1])
const TOP_BAR = 70

const stops = (): { at: number; alpha: number }[] => {
  const ramp = block('.page-scrim {')
  const held = /#000\s+0\s+([\d.]+)%/.exec(ramp)
  expect(held).not.toBeNull()
  const rest = [...ramp.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)\s+([\d.]+)%/g)].map(([, alpha, at]) => ({
    at: Number(at),
    alpha: Number(alpha)
  }))
  return [{ at: 0, alpha: 1 }, { at: Number(held![1]), alpha: 1 }, ...rest]
}

const alphaAt = (px: number): number => {
  const share = (px / HEIGHT) * 100
  const ramp = stops()
  if (share <= 0) return 1
  if (share >= 100) return 0
  for (let i = 1; i < ramp.length; i++) {
    const before = ramp[i - 1]
    const after = ramp[i]
    if (share > after.at) continue
    const run = after.at - before.at
    if (run === 0) return after.alpha
    return before.alpha + ((share - before.at) / run) * (after.alpha - before.alpha)
  }
  return 0
}

describe('the scrim over the top of a page', () => {
  it('is one ramp from the window edge rather than a band and a fade under it', () => {
    expect(HEIGHT).toBeGreaterThan(TOP_BAR)
    expect(alphaAt(0)).toBe(1)
    expect(alphaAt(HEIGHT)).toBe(0)
    expect(app).toContain('page-scrim absolute inset-x-0 top-0')
    expect(app).not.toContain('bg-gradient-to-b from-ink-900')
  })

  it('never turns a corner, so nothing scrolling under it meets an edge', () => {
    const ramp = stops()
    const falls = ramp.filter(one => one.alpha < 1)
    const run = 100 - ramp[1].at
    const even = 1 / falls.length
    expect(1 - falls[0].alpha).toBeLessThan(even / 2)
    expect(falls.at(-2)!.alpha).toBeLessThan(even / 2)
    expect(run).toBeGreaterThan(50)
    for (let i = 1; i < ramp.length; i++) expect(ramp[i].alpha).toBeLessThanOrEqual(ramp[i - 1].alpha)
  })

  it('leaves the bar standing on ground nothing can be read through', () => {
    const tallest = 44
    expect(alphaAt(TOP_BAR / 2 + tallest / 2)).toBeGreaterThanOrEqual(0.9)
    expect(alphaAt(TOP_BAR / 2)).toBe(1)
  })

  it('is off the design board, which runs its panels to the header', () => {
    expect(app).toContain("tab !== 'design' && <div className=\"page-scrim")
    expect(app).toMatch(/tab === 'design' \? 'bg-ink-900' : ''/)
  })
})

describe('where a page comes to rest under it', () => {
  it('is the scrim itself, written once and read by both columns', () => {
    expect(chat).toContain("paddingTop: 'var(--page-scrim)'")
    expect(docs).toContain("const COLUMN_TOP = 'var(--page-scrim)'")
    expect(chat).not.toContain('pt-28')
  })

  it('clears the scrim, so the first message never reads as sitting in fog', () => {
    expect(alphaAt(HEIGHT)).toBe(0)
    const column = /max-w-\[660px\] mx-auto pt-(\d+)/.exec(thread)
    expect(column).not.toBeNull()
    expect(Number(column![1]) * 4).toBe(HEIGHT)
  })
})
