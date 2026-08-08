import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { THREADS_SHOWN } from '../src/renderer/src/components/sidebar/placeItems'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

const rule = (): string => {
  const start = styles.indexOf('.rail-threads {')
  expect(start).toBeGreaterThan(-1)
  return styles.slice(start, styles.indexOf('\n}', start))
}

describe('the room the threads under a project stand in', () => {
  it('is worked out from the row rather than written down as a height', () => {
    expect(rule()).toContain('--rail-row: calc(var(--text-sm--line-height) + 12px)')
    expect(rule()).toContain('--rail-gap: 2px')
  })

  it('holds as many rows as it was handed, with a gap between each pair', () => {
    expect(rule()).toContain(
      'max-height: calc(var(--rail-rows) * var(--rail-row) + (var(--rail-rows) - 1) * var(--rail-gap))'
    )
  })

  it('is a handful of rows, so the rest of the rail is still on the screen', () => {
    expect(THREADS_SHOWN).toBe(6)
  })
})
