import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ARROW, DMG, GROUND, INK, LABEL, arrowAt, dmgArrow, dmgBackground } from '../scripts/icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).build
const dmg = build.dmg
const half = DMG.iconSize / 2

const hex = (...channels: number[]): string =>
  `#${channels
    .map(one =>
      Math.round(one * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`

const luminance = (colour: string): number => {
  const channels = [1, 3, 5].map(from => parseInt(colour.slice(from, from + 2), 16) / 255)
  const [red, green, blue] = channels.map(one => (one <= 0.03928 ? one / 12.92 : ((one + 0.055) / 1.055) ** 2.4))
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

const contrast = (one: string, other: string): number => {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

const dpiOf = (png: Buffer): number | null => {
  let at = 8
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    if (png.toString('ascii', at + 4, at + 8) === 'pHYs') {
      if (png.readUInt8(at + 16) !== 1) return null
      return Math.round(png.readUInt32BE(at + 8) * 0.0254)
    }
    at += 12 + length
  }
  return null
}

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
    expect(dmg.background).toBe('resources/dmg-background.png')
  })

  it('draws the picture at retina and tells Finder to size it back down', () => {
    const png = readFileSync(path.join(root, dmg.background))
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    expect(width).toBe(DMG.width * DMG.retina)
    expect(height).toBe(DMG.height * DMG.retina)
    expect(dpiOf(png)).toBe(72 * DMG.retina)
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
    expect(svg).toContain('Your new Crew')
    expect(svg).toContain('url(#shaft)')
  })

  it('puts the mesh in as the ground when it is handed one', () => {
    expect(dmgBackground('AAAA')).toContain('data:image/png;base64,AAAA')
  })

  it('stands on the ground the mesh is painted on', () => {
    const shader = readFileSync(path.join(root, 'scripts/dmg-mesh.js'), 'utf8')
    const paper = shader.match(/const PAPER = \[([\d., ]+)\]/)
    expect(paper).toBeTruthy()
    const [red, green, blue] = paper![1].split(',').map(Number)
    expect(hex(red, green, blue)).toBe(GROUND)
  })

  it('leaves the ground light enough to read the labels Finder pins to near black', () => {
    expect(contrast(LABEL, GROUND)).toBeGreaterThan(4.5)
    expect(contrast(INK, GROUND)).toBeGreaterThan(4.5)
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
