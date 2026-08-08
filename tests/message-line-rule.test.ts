import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

describe('the line a message is set on', () => {
  it('holds a message at the line it has always been read at', () => {
    const md = styles.indexOf('\n.md {')
    const said = styles.indexOf('\n.md-said {')

    expect(md).toBeGreaterThan(0)
    expect(styles.slice(md, md + 80)).toContain('leading-[1.65]')
    expect(styles.slice(said, said + 80)).toContain('leading-[22px]')
  })

  it('writes it after the prose it has to beat, since the two weigh the same', () => {
    expect(styles.indexOf('\n.md-said {')).toBeGreaterThan(styles.indexOf('\n.md {'))
  })
})
