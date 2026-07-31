import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ARROW, DMG, arrowAt, dmgArrow, dmgBackground } from '../scripts/icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).build
const dmg = build.dmg
const half = DMG.iconSize / 2

const at = (type: string): { x: number; y: number } => {
  const found = dmg.contents.find((one: { type: string }) => one.type === type)
  expect(found).toBeTruthy()
  return found
}

describe('the disk image window', () => {
  it('is the size the background is drawn at', () => {
    expect(dmg.window.width).toBe(DMG.width)
    expect(dmg.window.height).toBe(DMG.height)
    expect(dmg.iconSize).toBe(DMG.iconSize)
  })

  it('stands the app and Applications where the picture expects them', () => {
    expect(at('file')).toMatchObject({ x: DMG.app, y: DMG.line })
    expect(at('link')).toMatchObject({ x: DMG.applications, y: DMG.line })
  })

  it('wears the background the icon script writes', () => {
    expect(dmg.background).toBe('resources/dmg-background.tiff')
  })

  it('leaves both icons inside the window', () => {
    for (const centre of [DMG.app, DMG.applications]) {
      expect(centre - half).toBeGreaterThan(0)
      expect(centre + half).toBeLessThan(DMG.width)
    }
    expect(DMG.line - half).toBeGreaterThan(DMG.headline)
  })

  it('keeps everything above the band the title bar takes off the bottom', () => {
    const seen = DMG.height - DMG.chrome
    const labels = DMG.line + half + DMG.iconTextRoom
    expect(labels).toBeLessThan(seen)
    expect(seen - labels).toBeGreaterThan(DMG.headline / 2)
  })
})

describe('the arrow', () => {
  it('runs towards Applications and never backwards', () => {
    expect(ARROW.to).toBeGreaterThan(ARROW.from)
    expect(arrowAt(1)).toBeGreaterThan(arrowAt(0))
  })

  it('starts and lands clear of both icons', () => {
    expect(ARROW.from).toBeGreaterThan(DMG.app + half)
    expect(ARROW.to).toBeLessThan(DMG.applications - half)
  })

  it('sits on the same line the icons stand on', () => {
    const drawn = dmgArrow()
    expect(drawn).toContain(`y1="${DMG.line}"`)
    expect(drawn).toContain(`y2="${DMG.line}"`)
  })

  it('points its head forwards, never back down the shaft', () => {
    const drawn = dmgArrow()
    const head = drawn.match(/M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) [\d.]+ L (-?[\d.]+) (-?[\d.]+)/)
    expect(head).toBeTruthy()
    const [, backX, backTop, tip, , backBottom] = head!.map(Number)
    expect(tip).toBeGreaterThan(backX)
    expect(tip - backX).toBeCloseTo(ARROW.head, 3)
    expect(backTop).toBeLessThan(DMG.line)
    expect(backBottom).toBeGreaterThan(DMG.line)
  })

  it('draws its head where the shaft ends', () => {
    for (const where of [0.3, 0.7, 1]) {
      expect(dmgArrow(where)).toContain(`L ${arrowAt(where)} ${DMG.line}`)
    }
  })
})

describe('the picture', () => {
  it('draws the ground, the words and the arrow', () => {
    const svg = dmgBackground(null)
    expect(svg).toContain(`width="${DMG.width}" height="${DMG.height}"`)
    expect(svg).toContain('Drag Crew into Applications')
    expect(svg).toContain('url(#shaft)')
  })

  it('puts the mesh in as the ground when it is handed one', () => {
    expect(dmgBackground('AAAA')).toContain('data:image/png;base64,AAAA')
  })

  it('sets the words in one face at one size', () => {
    const svg = dmgBackground(null)
    expect(svg).not.toContain('<tspan')
    expect(svg).not.toContain('monospace')
    expect(svg).not.toContain('cursive')
    expect(svg).toContain('sans-serif')
    expect(svg.match(/font-size="[\d.]+"/g)?.length).toBe(1)
  })
})
