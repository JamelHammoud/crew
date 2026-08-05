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

const block = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('}', at))
}

describe('the scrollbar the app draws for itself', () => {
  it('is a real one that takes ten pixels off whatever it stands in', () => {
    expect(block('::-webkit-scrollbar {')).toMatch(/height:\s*10px/)
    expect(block('::-webkit-scrollbar {')).toMatch(/width:\s*10px/)
  })
})

describe('a scroller that means to have no bar', () => {
  it('is one class rather than a pair of utilities written out at each one', () => {
    expect(block('.no-scrollbar {')).toMatch(/scrollbar-width:\s*none/)
    expect(block('.no-scrollbar::-webkit-scrollbar {')).toMatch(/display:\s*none/)
  })

  it('is written down once, so nothing says it by hand', () => {
    const offenders = sources.filter(at => readFileSync(at, 'utf8').includes('scrollbar-width:none'))
    expect(offenders.map(at => path.relative(root, at))).toEqual([])
  })

  it('leaves the two that want a bar alone', () => {
    const thin = sources.filter(at => readFileSync(at, 'utf8').includes('scrollbar-width:thin'))
    expect(thin.length).toBeGreaterThan(0)
  })
})

describe('what may be scrolled', () => {
  it('is the box that was named, never whatever the page decides', () => {
    const offenders = sources
      .filter(at => !at.endsWith('scrollInto.ts'))
      .filter(at => readFileSync(at, 'utf8').includes('scrollIntoView'))
    expect(offenders.map(at => path.relative(root, at))).toEqual([])
  })

  it('is written down once, beside the rule for the two boxes it may never touch', () => {
    const source = readFileSync(path.join(renderer, 'components/scrollInto.ts'), 'utf8')
    expect(source).toContain('export function bringInto')
    expect(source).toContain('export function centerIn')
    expect(source).toMatch(/auto\|scroll/)
  })
})

describe('the row a tab stands in', () => {
  it('wears it, so a bar never eats the height the pills are drawn at', () => {
    expect(classOf('components/BrowserPanel.tsx', 'overflow-x-auto')).toContain('no-scrollbar')
  })

  it('says outright that it never scrolls the other way', () => {
    expect(classOf('components/BrowserPanel.tsx', 'overflow-x-auto')).toContain('overflow-y-hidden')
  })

  it('holds the path beside it to the same rule', () => {
    const crumbs = classOf('components/FileView.tsx', 'overflow-x-auto')
    expect(crumbs).toContain('no-scrollbar')
    expect(crumbs).toContain('overflow-y-hidden')
  })
})
