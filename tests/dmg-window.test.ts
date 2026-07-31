import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DMG,
  TRAVEL,
  dmgBackground,
  dmgMark,
  dmgOverlay,
  markAt,
  wakePath
} from '../scripts/icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).build
const dmg = build.dmg
const geometry = { bite: 28 / 130, step: 186 / 130 }
const half = DMG.iconSize / 2
const mark = dmgMark(geometry)

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

  it('leaves both icons and their labels inside the window', () => {
    for (const centre of [DMG.app, DMG.applications]) {
      expect(centre - half).toBeGreaterThan(0)
      expect(centre + half).toBeLessThan(DMG.width)
    }
    expect(DMG.line - half).toBeGreaterThan(DMG.headline)
    expect(DMG.line + half + DMG.iconSize / 6).toBeLessThan(DMG.height)
  })
})

describe('the mark that travels', () => {
  it('is three discs of one size, spaced the way the app icon spaces them', () => {
    expect(mark.centres.length).toBe(3)
    const gaps = mark.centres.slice(1).map((x, index) => x - mark.centres[index])
    expect(gaps[0]).toBeCloseTo(gaps[1], 6)
    expect(gaps[0]).toBeCloseTo(mark.radius * geometry.step, 6)
  })

  it('bites each disc with the one in front rather than overlapping it whole', () => {
    expect(mark.cut).toBeGreaterThan(mark.radius)
    expect(mark.cut).toBeLessThan(mark.radius * geometry.step)
  })

  it('never reaches either icon, at any point of the travel', () => {
    for (const where of [0, 0.25, 0.5, 0.75, 1]) {
      const head = markAt(where)
      expect(head - mark.width / 2).toBeGreaterThan(DMG.app + half)
      expect(head + mark.width / 2).toBeLessThan(DMG.applications - half)
    }
  })

  it('runs towards Applications', () => {
    expect(TRAVEL.to).toBeGreaterThan(TRAVEL.from)
    expect(markAt(1)).toBeGreaterThan(markAt(0))
  })

  it('trails its wake behind it and never in front', () => {
    const path = wakePath(geometry)
    const xs = [...path.matchAll(/-?\d+(?:\.\d+)?(?= )/g)].map(Number)
    expect(Math.min(...xs)).toBeCloseTo(-TRAVEL.wake, 6)
    expect(Math.max(...xs)).toBeLessThan(0)
  })
})

describe('the picture', () => {
  it('draws the ground, the words and the mark', () => {
    const svg = dmgBackground(geometry, null)
    expect(svg).toContain(`width="${DMG.width}" height="${DMG.height}"`)
    expect(svg).toContain('Drag ')
    expect(svg).toContain('into Applications')
    expect(svg.match(/<circle /g)?.length).toBeGreaterThanOrEqual(mark.centres.length)
  })

  it('puts the mesh in as the ground when it is handed one', () => {
    expect(dmgBackground(geometry, 'AAAA')).toContain('data:image/png;base64,AAAA')
  })

  it('places the mark at the moment it is asked for', () => {
    expect(dmgOverlay(geometry, 0.2)).toContain(`translate(${markAt(0.2)} ${DMG.line})`)
    expect(dmgOverlay(geometry, 0.9)).toContain(`translate(${markAt(0.9)} ${DMG.line})`)
  })
})
