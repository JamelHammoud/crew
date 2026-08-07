import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const rule = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

// The room under the last block is one number. It was the editor's own padding
// and the trailing block was 30 pixels standing in the top of it, so everything
// below those 30 fell to the nearest text position, which for a doc ending in a
// code block is inside the code: clicking the empty page under a snippet took
// the caret into it, and there was no way to write after it at all. The two
// carry the same room now and never both, or a doc ends on twice the gap it
// asked for.
describe('the room under the last block', () => {
  it('is one number, written down once', () => {
    expect(rule(':root {')).toContain('--doc-tail: 30vh')
    expect(styles).not.toContain('padding-bottom: 30vh')
  })

  it('is the trailing block wherever there is one', () => {
    expect(rule('.doc .bn-editor .bn-trailing-block')).toContain('height: var(--doc-tail)')
  })

  it('is the editor own padding only where there is not', () => {
    expect(rule('.doc .bn-editor:not(:has(.bn-trailing-block))')).toContain('padding-bottom: var(--doc-tail)')
  })
})
