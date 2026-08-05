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
const REST = Number(/--page-rest:\s*(\d+)px/.exec(styles)?.[1])
const TOP_BAR = 70

const stops = (): { at: number; alpha: number }[] => {
  const ramp = block('--scrim-ramp:')
  const head = /#000\s+0%/.exec(ramp)
  expect(head).not.toBeNull()
  const rest = [...ramp.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)\s+([\d.]+)%/g)].map(([, alpha, at]) => ({
    at: Number(at),
    alpha: Number(alpha)
  }))
  return [{ at: 0, alpha: 1 }, ...rest]
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
  it('is one ease from the window edge, with nothing held under it', () => {
    expect(alphaAt(0)).toBe(1)
    expect(alphaAt(HEIGHT)).toBe(0)
    expect(stops()[1].alpha).toBeLessThan(1)
    expect(app).toContain('page-scrim absolute inset-x-0 top-0')
    expect(app).not.toContain('bg-gradient-to-b from-ink-900')
  })

  it('never turns a corner, so nothing scrolling under it meets an edge', () => {
    const ramp = stops()
    const falls = ramp.slice(1)
    const even = 1 / falls.length
    expect(1 - falls[0].alpha).toBeLessThan(even / 2)
    expect(falls.at(-2)!.alpha).toBeLessThan(even / 2)
    for (let i = 1; i < ramp.length; i++) expect(ramp[i].alpha).toBeLessThanOrEqual(ramp[i - 1].alpha)
  })

  it('lets a message scroll through the bar and takes it at the window edge', () => {
    expect(HEIGHT).toBeLessThan(TOP_BAR)
    expect(alphaAt(TOP_BAR)).toBe(0)
    expect(alphaAt(TOP_BAR / 2)).toBeLessThan(0.7)
  })

  it('is off the design board, which fades its own canvas in its own colour', () => {
    expect(app).toContain("tab !== 'design' && <div className=\"page-scrim")
    expect(app).not.toContain("'bg-ink-900'")
    const own = block('.design-scrim {')
    expect(own).toContain('background: var(--design-canvas)')
    expect(own).toContain('mask-image: var(--scrim-ramp)')
    expect(block('.page-scrim {')).toContain('mask-image: var(--scrim-ramp)')
  })
})

describe('the design board under its own header', () => {
  const stage = read('components/DesignStage.tsx')
  const page = read('views/Design.tsx')
  const left = read('components/DesignLeftPanel.tsx')
  const right = read('components/DesignRightPanel.tsx')

  it('runs the canvas and both panels to the window edge rather than a band standing in for them', () => {
    expect(page).not.toContain('paddingTop: TOP_BAR_H')
    for (const panel of [left, right]) expect(panel).toContain('paddingTop: TOP_BAR_H')
    expect(read('components/DesignHeader.tsx')).not.toContain('data-design-band')
  })

  it('fades the canvas in the stage that owns it, under everything the stage floats', () => {
    expect(stage).toContain('design design-scrim')
    expect(stage.indexOf('design-scrim')).toBeLessThan(stage.indexOf('DesignToolbar boardId'))
    expect(Number(/--design-scrim:\s*(\d+)px/.exec(styles)?.[1])).toBeGreaterThan(TOP_BAR)
  })
})

describe('where a page comes to rest', () => {
  it('is its own number, written once and read by both columns of the chat', () => {
    expect(chat).toContain("paddingTop: 'var(--page-rest)'")
    expect(thread).toContain("paddingTop: 'var(--page-rest)'")
    for (const column of [chat, docs, thread]) expect(column).not.toContain('pt-28')
  })

  it('clears the bar, so the first message never rests behind the faces', () => {
    expect(REST).toBeGreaterThan(TOP_BAR)
    expect(alphaAt(REST)).toBe(0)
  })
})
