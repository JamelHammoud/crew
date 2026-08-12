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
    const at = styles.indexOf(':placeholder-shown')
    expect(at).toBeGreaterThan(-1)
    expect(styles.slice(at, at + 120)).toMatch(/user-select:\s*none/)
  })

  it('writes that one outside the layer, where an unlayered library rule cannot beat it', () => {
    expect(layer()).not.toContain(':placeholder-shown')
    expect(styles).toMatch(/^input:placeholder-shown,\s*\n\s*textarea:placeholder-shown\s*\{/m)
  })

  it('stands in the base layer, so select-text and select-none still win', () => {
    expect(styles).not.toMatch(/^body\s*\{[^}]*user-select/m)
  })
})

describe('the band a page of paper takes', () => {
  const band = (name: string): string => {
    const found = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(styles)
    expect(found, name).toBeTruthy()
    return (found as RegExpExecArray)[1]
  }

  it('is a dark one, whichever theme the window is in', () => {
    expect(band('selection-paper')).toContain('rgb(0 0 0')
    expect(styles.match(/--color-selection-paper:/g)).toHaveLength(1)
  })

  it('is the one a pdf paints its selection in, since the window band vanishes on white', () => {
    const view = readFileSync(path.join(root, 'src/renderer/src/components/attachment/PdfPreview.tsx'), 'utf8')
    const at = view.indexOf('.pdf-text span::selection')
    expect(at).toBeGreaterThan(-1)
    expect(view.slice(at, view.indexOf('}', at))).toContain('var(--color-selection-paper)')
  })
})
