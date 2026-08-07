import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const block = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

const CODE = ".doc .bn-editor .bn-block-content[data-content-type='codeBlock']"

const stops = (name: string): { at: number; alpha: number }[] => {
  const ramp = block(`${name}:`)
  expect(/#000\s+0%/.exec(ramp)).not.toBeNull()
  const rest = [...ramp.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)\s+([\d.]+)%/g)].map(([, alpha, at]) => ({
    at: Number(at),
    alpha: Number(alpha)
  }))
  return [{ at: 0, alpha: 1 }, ...rest]
}

describe('the chrome on a code block', () => {
  it('sizes the language to its own label rather than to the longest one there is', () => {
    const select = block(`${CODE} > div > select`)
    expect(select).toContain('field-sizing: content')
    expect(select).not.toMatch(/min-width/)
  })

  it('leaves the language as a label and the copy as the one thing to press', () => {
    const select = block(`${CODE} > div > select`)
    expect(select).toContain('background: transparent')
    expect(select).toContain('color: var(--color-fg-muted)')
    expect(select).not.toContain('999px')

    const lit = block(`${CODE} > div > select:hover`)
    expect(lit).toContain('background: var(--color-ink-700)')
  })

  it('never carries a word of its own, so nothing moves when one is copied', () => {
    expect(styles).not.toContain('.doc-code-copy:active')
    expect(block(`${CODE} > div`)).not.toMatch(/min-width/)
  })

  it('stands the row on a scrim, since the code runs under it', () => {
    const scrim = block(`${CODE} > div::before`)
    expect(scrim).toContain('background: var(--color-ink-850)')
    expect(scrim).toContain('var(--scrim-ramp-x)')
    expect(scrim).toContain('z-index: -1')
    expect(block(`${CODE} > div`)).toContain('isolation: isolate')
  })

  it('holds the fade to the lead-in, so the row itself is opaque', () => {
    const scrim = block(`${CODE} > div::before`)
    const lead = /mask-size:\s*(\d+)px 100%,\s*calc\(100% - (\d+)px\) 100%/.exec(scrim)
    expect(lead).not.toBeNull()
    expect(lead?.[1]).toBe(lead?.[2])
    expect(scrim).toMatch(/mask-position:\s*left center,\s*right center/)
    expect(new RegExp(`inset:[^;]*-${lead?.[1]}px`).test(scrim)).toBe(true)
  })

  it('fades across as the page scrim falls, on one ease with no shelf at either end', () => {
    const ramp = stops('--scrim-ramp-x')
    expect(ramp[0].alpha).toBe(1)
    expect(ramp[ramp.length - 1].alpha).toBe(0)
    expect(block('--scrim-ramp-x:')).toContain('to left')

    const down = stops('--scrim-ramp')
    expect(ramp.map(one => one.alpha)).toEqual(down.map(one => one.alpha))
    expect(ramp.map(one => one.at)).toEqual(down.map(one => one.at))

    const steps = ramp.slice(1).map((one, i) => ramp[i].alpha - one.alpha)
    const biggest = Math.max(...steps)
    expect(steps[0]).toBeLessThan(biggest / 8)
    expect(steps[steps.length - 1]).toBeLessThan(biggest / 8)
  })
})
