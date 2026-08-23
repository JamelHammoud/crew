import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(path.join(root, 'src/renderer/src/components/Composer.tsx'), 'utf8')

const actionButtonClasses = [...source.matchAll(/aria-label=(?:"Stop"|\{sendLabel\})\s+className="([^"]+)"/g)].map(
  ([, classes]) => classes,
)

describe('composer action button', () => {
  it('keeps its size on hover in both states', () => {
    expect(actionButtonClasses).toHaveLength(2)
    expect(actionButtonClasses.every((classes) => !classes.includes('hover:scale'))).toBe(true)
  })

  it('uses color for hover and scale for press', () => {
    expect(actionButtonClasses.every((classes) => classes.includes('hover:bg-fg/90'))).toBe(true)
    expect(actionButtonClasses.every((classes) => classes.includes('active:scale-95'))).toBe(true)
  })
})
