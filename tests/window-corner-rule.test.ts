import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const renderer = readFileSync(path.join(root, 'src/renderer/src/main.tsx'), 'utf8')

const block = (selector: string): string =>
  new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? ''

describe('the app window corner', () => {
  it('lets macOS clip its native app and thread windows once', () => {
    expect(renderer).toContain("if (joins) root.classList.add('native-shell')")
    expect(block('.mac #root.native-shell')).toContain('border-radius: 0')
  })

  it('keeps the CSS corner for windows without the native shell', () => {
    expect(block('#root')).toContain('border-radius: 20px')
    expect(block('#root.bare')).toContain('border-radius: 0')
  })
})
