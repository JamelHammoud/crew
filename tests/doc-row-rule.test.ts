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

const FILL = '.doc .bn-editor .bn-block-content:not(:has(.ProseMirror-trailingBreak:only-child)) > .bn-inline-content'

describe('where a click at the end of a row lands', () => {
  it('gives the writing the rest of its row', () => {
    expect(rule(FILL)).toContain('flex: 1 1 auto')
  })

  it('leaves the empty block at the width of what is in it', () => {
    expect(FILL).toContain(':not(:has(.ProseMirror-trailingBreak:only-child))')
  })

  it('says it of the row rather than of the bullet', () => {
    expect(FILL).not.toContain('bulletListItem')
  })
})
