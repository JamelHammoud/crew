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
  for (const [, provider, name] of body.matchAll(/(\w+): \{ src: (\w+)/g)) rows.set(provider, name)
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

  it('is one square with nothing drawn over it', () => {
    expect(source).toContain('rounded-')
    expect(source).not.toContain('InsetRing')
  })
})
