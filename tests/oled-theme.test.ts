import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const oled = /\.oled \{([^}]*)\}/.exec(styles)?.[1] ?? ''

describe('the OLED palette', () => {
  it('uses true black for the page and near-black layers above it', () => {
    expect(oled).toContain('--color-ink-900: #000000')
    expect(oled).toContain('--color-ink-800: #121212')
    expect(oled).toContain('--color-ink-700: #171717')
  })

  it('has its own foreground, status, and selection colors', () => {
    for (const token of ['--color-fg:', '--color-positive:', '--color-danger:', '--color-attention:', '--color-selection:']) {
      expect(oled).toContain(token)
    }
  })
})
