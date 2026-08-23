// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import ProviderMark from '../src/renderer/src/components/ProviderMark'
import { STROKE, wearWeight } from '../src/renderer/src/icons'
import { builtinProviders } from '../src/runner/providers/detect'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const source = readFileSync(path.join(root, 'src/renderer/src/components/ProviderMark.tsx'), 'utf8')

const imported = (): Map<string, string> => {
  const names = new Map<string, string>()
  for (const [, name, file] of source.matchAll(/import (\w+) from '\.\.\/media\/providers\/([\w-]+\.png)'/g)) {
    names.set(name, file)
  }
  return names
}

const table = (): Map<string, string> => {
  const rows = new Map<string, string>()
  const body = source.slice(source.indexOf('const MARKS'), source.indexOf('export default'))
  for (const [, provider, name] of body.matchAll(/^ {2}(\w+): (\w+)/gm)) rows.set(provider, name)
  return rows
}

describe('provider marks', () => {
  it('has a mark for every provider the picker can offer', () => {
    const rows = table()
    for (const provider of builtinProviders) {
      expect(rows.has(provider.name), `no mark for ${provider.name}`).toBe(true)
    }
  })

  it('draws a file that is really there', () => {
    const files = imported()
    for (const [provider, name] of table()) {
      const file = files.get(name)
      expect(file, `${provider} names an import that does not exist`).toBeDefined()
      expect(existsSync(path.join(root, 'src/renderer/src/media/providers', file as string))).toBe(true)
    }
  })

  // The rim is the foreground at an opacity, so it is white over a dark icon in
  // dark mode and near black over a light one in light mode, and it disappears
  // into the icons that already stand away from the surface. A fixed white or
  // black is one of those two cases drawn wrong.
  it('rims every mark in the foreground at an opacity', () => {
    expect(source).toContain('InsetRing')
    expect(source).toMatch(/ring-inset ring-fg\/\d+/)
    expect(source).not.toMatch(/ring-white|ring-black|ring-\[#/)
  })

  it('draws the artwork at the size it was given', () => {
    expect(source).not.toContain('scale(')
  })
})

// A server somebody wrote down themselves is the one provider with no logo of
// its own, so it is the one place here Crew speaks rather than a vendor. The
// tile and the rim belong to the artwork: both are there for a picture that runs
// to its own edge, and under a line drawing they are a swatch nobody asked for
// and a box drawn around nothing.
describe('a server somebody wrote down', () => {
  const custom = 'server:http://192.0.2.10:8080/v1'
  const drawn = (className?: string) => render(createElement(ProviderMark, { provider: custom, className })).container

  it("draws one mark of Crew's own rather than a picture per address", () => {
    const container = drawn()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
    const mark = container.querySelector('svg')
    expect(mark?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(mark?.getAttribute('stroke')).toBe('currentColor')
  })

  it('wears no tile and no rim', () => {
    expect(drawn().innerHTML).not.toMatch(/ring-inset|rounded-\[22%\]|bg-fg|bg-ink/)
  })

  it('is set in the foreground at an opacity, never a solid grey', () => {
    const className = drawn().querySelector('svg')?.getAttribute('class') ?? ''
    expect(className).toMatch(/text-fg\/\d+/)
    expect(className).not.toMatch(/text-fg-(faint|muted|secondary)/)
  })

  // A stroke does not scale with the icon, so one number is spindly at 16 and
  // chunky at 48. The size is read off the class the caller already writes.
  it('takes its weight off the size it is worn at', () => {
    const weight = (className?: string) => drawn(className).querySelector('svg')?.getAttribute('stroke-width')
    expect(weight()).toBe(String(wearWeight(STROKE, 'w-4 h-4')))
    expect(weight('w-12 h-12 rounded-2xl')).toBe(String(wearWeight(STROKE, 'w-12 h-12')))
    expect(weight()).not.toBe(weight('w-12 h-12 rounded-2xl'))
  })
})
