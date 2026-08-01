import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const composer = readFileSync(path.join(root, 'src/renderer/src/components/Composer.tsx'), 'utf8')

// An emoji anywhere somebody can type is the machine's own glyph with a picture
// of ours standing on it, and the caret beside it is drawn against the
// character's own edge and runs the height of the line. So the size of that
// picture is the whole of whether a caret can be seen: held to the character's
// own square it is met above and below, and a pixel wider, or as tall as the
// line, it is gone outright and the box reads as one nothing can be typed into.
// No suite can see a caret and the only thing that could steals the screen off
// whoever is working, so what is held here is the rule that decides it.
describe('a picture over a character takes the room the character takes', () => {
  const rule = (): string => {
    const at = styles.indexOf('.doc .doc-emoji::after')
    expect(at).toBeGreaterThan(-1)
    return styles.slice(at, styles.indexOf('\n}', at))
  }

  it('draws the sheet in a doc as a square of the character box', () => {
    expect(rule()).toContain('aspect-ratio: 1')
    expect(rule()).toContain('left: 0')
    expect(rule()).toContain('right: 0')
  })

  it('never draws it wider than the character or as tall as the line', () => {
    expect(rule()).not.toMatch(/(width|height):\s*[\d.]+em/)
    expect(rule()).not.toMatch(/\n\s*(top|bottom):\s*0/)
  })

  it('holds the composer patch to the same square', () => {
    const at = composer.indexOf('absolute inset-x-0')
    expect(at).toBeGreaterThan(-1)
    expect(composer.slice(at, composer.indexOf('`', at))).toContain('aspect-square')
    expect(composer).not.toContain('inset-y-0 -inset-x-px')
  })

  it('paints the band back across the whole of that patch', () => {
    expect(composer).toContain('absolute inset-0 bg-selection')
  })
})
