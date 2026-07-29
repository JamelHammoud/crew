import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const layer = (): string => {
  const start = styles.indexOf('@layer base {')
  expect(start).toBeGreaterThan(-1)
  return styles.slice(start, styles.indexOf('\n}', start))
}

describe('the app default for selection', () => {
  it('is not selectable', () => {
    expect(layer()).toMatch(/body\s*\{\s*user-select:\s*none;?\s*\}/)
  })

  it('lets fields and anything editable back in', () => {
    const base = layer()
    expect(base).toContain('input,')
    expect(base).toContain('textarea,')
    expect(base).toContain("[contenteditable]:not([contenteditable='false'])")
    expect(base.slice(base.indexOf('input,'))).toMatch(/user-select:\s*text/)
  })

  it('shuts a field while it is showing a placeholder', () => {
    const base = layer()
    const at = base.indexOf(':placeholder-shown')
    expect(at).toBeGreaterThan(-1)
    expect(base.slice(at)).toMatch(/user-select:\s*none/)
    expect(base.indexOf('input,')).toBeLessThan(at)
  })

  it('stands in the base layer, so select-text and select-none still win', () => {
    expect(styles).not.toMatch(/^body\s*\{[^}]*user-select/m)
  })
})
