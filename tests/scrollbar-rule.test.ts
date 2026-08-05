import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const renderer = path.join(root, 'src/renderer/src')
const styles = readFileSync(path.join(renderer, 'styles.css'), 'utf8')

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const at = path.join(dir, entry.name)
    return entry.isDirectory() ? files(at) : [at]
  })

const sources = files(renderer).filter(at => at.endsWith('.tsx') || at.endsWith('.ts'))

const classOf = (file: string, mark: string): string => {
  const source = readFileSync(path.join(renderer, file), 'utf8')
  const at = source.indexOf(mark)
  expect(at).toBeGreaterThan(-1)
  const line = source.slice(source.lastIndexOf('"', at) + 1, source.indexOf('"', at))
  expect(line).toContain(mark)
  return line
}

describe('the scrollbar the app draws for itself', () => {
  it('takes ten pixels of whatever it stands in', () => {
    const at = styles.indexOf('::-webkit-scrollbar {')
    expect(at).toBeGreaterThan(-1)
    expect(styles.slice(at, styles.indexOf('}', at))).toMatch(/height:\s*10px/)
  })

  it('is a custom one, which is what takes the standard property out of the argument', () => {
    expect(styles).toContain('::-webkit-scrollbar-thumb {')
  })
})

describe('a scroller that means to have no bar', () => {
  it('says it twice, since the drawn bar is what a browser reads first', () => {
    const at = styles.indexOf('.no-scrollbar {')
    expect(at).toBeGreaterThan(-1)
    expect(styles.slice(at, styles.indexOf('}', at))).toMatch(/scrollbar-width:\s*none/)
    const pseudo = styles.indexOf('.no-scrollbar::-webkit-scrollbar {')
    expect(pseudo).toBeGreaterThan(-1)
    expect(styles.slice(pseudo, styles.indexOf('}', pseudo))).toMatch(/display:\s*none/)
  })

  it('is written down once, so nothing says half of it by hand', () => {
    const offenders = sources.filter(at => readFileSync(at, 'utf8').includes('scrollbar-width:none'))
    expect(offenders.map(at => path.relative(root, at))).toEqual([])
  })
})

describe('the row a tab stands in', () => {
  it('reserves nothing for a bar, so a pill is never taller than the row that holds it', () => {
    const row = classOf('components/BrowserPanel.tsx', 'overflow-x-auto')
    expect(row).toContain('no-scrollbar')
  })

  it('pins the axis it never scrolls, so a tab opening cannot push the row up', () => {
    expect(classOf('components/BrowserPanel.tsx', 'overflow-x-auto')).toContain('overflow-y-hidden')
  })

  it('holds the path beside it to the same rule', () => {
    const crumbs = classOf('components/FileView.tsx', 'overflow-x-auto')
    expect(crumbs).toContain('no-scrollbar')
    expect(crumbs).toContain('overflow-y-hidden')
  })
})
