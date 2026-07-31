import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DMG, dmgBackground, dmgDiscs } from '../scripts/icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).build
const dmg = build.dmg
const geometry = { bite: 28 / 130, step: 186 / 130 }
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

  it('leaves both icons and their labels inside the window', () => {
    for (const centre of [DMG.app, DMG.applications]) {
      expect(centre - half).toBeGreaterThan(0)
      expect(centre + half).toBeLessThan(DMG.width)
    }
    expect(DMG.line - half).toBeGreaterThan(DMG.headline)
    expect(DMG.line + half + DMG.iconSize / 6).toBeLessThan(DMG.height)
  })

  it('keeps the trail clear of both icons', () => {
    const discs = dmgDiscs(geometry)
    const first = discs[0]
    const last = discs[discs.length - 1]
    expect(first.x - first.r).toBeGreaterThan(DMG.app + half)
    expect(last.x + last.r).toBeLessThan(DMG.applications - half)
    expect(discs.every(disc => disc.y === DMG.line)).toBe(true)
  })

  it('runs left to right, growing the whole way', () => {
    const discs = dmgDiscs(geometry)
    for (let index = 1; index < discs.length; index += 1) {
      expect(discs[index].x).toBeGreaterThan(discs[index - 1].x)
      expect(discs[index].r).toBeGreaterThanOrEqual(discs[index - 1].r)
      expect(discs[index].o).toBeGreaterThan(discs[index - 1].o)
    }
  })

  it('settles into the mark, each disc bitten by the one in front', () => {
    const discs = dmgDiscs(geometry)
    const settled = discs.filter(disc => disc.r === discs[discs.length - 1].r)
    expect(settled.length).toBe(3)
    for (let index = 1; index < settled.length; index += 1) {
      const gap = settled[index].x - settled[index - 1].x
      expect(gap).toBeCloseTo(settled[index].r * geometry.step, 2)
      expect(gap).toBeLessThan(settled[index].r * 2)
    }
    expect(discs[discs.length - 1].cut).toBe(null)
  })

  it('draws the picture, the words and every disc', () => {
    const svg = dmgBackground(geometry, null)
    expect(svg).toContain(`width="${DMG.width}" height="${DMG.height}"`)
    expect(svg).toContain('Drag ')
    expect(svg).toContain('into Applications')
    expect(svg.match(/<circle /g)?.length).toBeGreaterThanOrEqual(dmgDiscs(geometry).length)
  })
})
