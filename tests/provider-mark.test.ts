import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
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
