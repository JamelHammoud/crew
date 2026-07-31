import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.join(__dirname, '..')
const canvas = path.join(root, 'src', 'renderer', 'src', 'canvas')
const roots = [path.join(root, 'src'), path.join(root, 'tests'), path.join(root, 'scripts')]
const CODE = /\.(ts|tsx|mts|mjs|css)$/
const retired = `tl${'draw'}`
const REACHES = new RegExp(`(?:from|import|require\\()\\s*['"](${retired}(?:\\/[^'"]*)?|@${retired}\\/[^'"]*)['"]`, 'g')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (CODE.test(entry)) out.push(full)
  }
  return out
}

describe('the canvas seam', () => {
  it('does not reach the retired canvas package', () => {
    const outside: string[] = []
    for (const dir of roots) {
      for (const file of walk(dir)) {
        if (file.startsWith(canvas + path.sep)) continue
        const text = readFileSync(file, 'utf8')
        for (const hit of text.matchAll(REACHES)) {
          outside.push(`${path.relative(root, file)}: ${hit[1]}`)
        }
      }
    }
    expect(outside).toEqual([])
  })

  it('hands out everything the app asks of it', () => {
    const text = readFileSync(path.join(canvas, 'index.ts'), 'utf8')
    for (const name of ['Editor', 'ShapeUtil', 'useValue', 'useEditor', 'Vec', 'T']) {
      expect(text).toContain(name)
    }
  })
})
