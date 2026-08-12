import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { panelSpot } from '../src/main/tray-position'
import { TRAY_HEIGHT, TRAY_ICON, TRAY_WIDTH } from '../src/main/tray-png'
import { badgeText, emptyPresence, presenceTooltip, presentNow } from '../src/shared/presence'
import type { AgentStatus, PooledAgent } from '../src/shared/llm'
import type { MemberInfo } from '../src/shared/protocol'
import { MARK_DISCS, MARK_HEIGHT, MARK_RADIUS, MARK_WIDTH } from '../src/renderer/src/components/crew-mark'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const trayArt = readFileSync(path.join(root, 'resources', 'tray.svg'), 'utf8')

const discs = (source: string) =>
  [...source.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="#ffffff"/g)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]), r: Number(match[3]) }))
    .sort((a, b) => a.x - b.x)

const box = (source: string) => {
  const [, width, height] = source.match(/viewBox="0 0 (\d+) (\d+)"/) ?? []
  return { width: Number(width), height: Number(height) }
}

const png = (encoded: string) => {
  const buffer = Buffer.from(encoded, 'base64')
  return {
    signature: buffer.subarray(0, 8).toString('hex'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

const member = (id: string, name: string, connected: boolean): MemberInfo => ({ id, name, connected })

const agent = (id: string, label: string, status: AgentStatus): PooledAgent => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'self',
  ownerName: 'Jamel',
  status,
  runs: {},
  settings: {},
  fields: []
})

describe('menu bar icon', () => {
  it('is the same three discs as the app icon, at the same spacing', () => {
    const stack = discs(trayArt)

    expect(stack).toHaveLength(3)
    expect(new Set(stack.map(disc => disc.r)).size).toBe(1)
    expect(new Set(stack.map(disc => disc.y)).size).toBe(1)
    expect(stack[0].r).toBe(MARK_RADIUS)
    expect(stack[1].x - stack[0].x).toBe(MARK_DISCS[1] - MARK_DISCS[2])
    expect(stack[2].x - stack[1].x).toBe(stack[1].x - stack[0].x)
  })

  it('centres the mark in the shape the menu bar keeps for it', () => {
    const shape = box(trayArt)
    const stack = discs(trayArt)
    const left = stack[0].x - MARK_RADIUS
    const right = shape.width - (stack[2].x + MARK_RADIUS)

    expect(shape.height).toBe(MARK_HEIGHT)
    expect(shape.width / shape.height).toBeCloseTo(TRAY_WIDTH / TRAY_HEIGHT, 5)
    expect(shape.width).toBeGreaterThan(MARK_WIDTH)
    expect(left).toBe(right)
    expect(stack[1].y).toBe(shape.height / 2)
  })

  // macOS reads a template image by its alpha and tints it to the menu bar, so
  // the art is black and nothing else.
  it('is drawn in flat black for the template', () => {
    expect(trayArt).toContain('fill="#000000" mask=')
    expect(trayArt).not.toContain('currentColor')
    expect(trayArt).not.toMatch(/fill="#(?!000000|ffffff)[0-9a-f]{6}"/)
  })

  it('ships at twice the size the bar asks for, so a retina bar has pixels', () => {
    const image = png(TRAY_ICON)

    expect(image.signature).toBe('89504e470d0a1a0a')
    expect(image.width).toBe(TRAY_WIDTH * 2)
    expect(image.height).toBe(TRAY_HEIGHT * 2)
  })
})

describe('where the panel hangs', () => {
  const work = { x: 0, y: 25, width: 1440, height: 875 }
  const panel = { width: 272, height: 300 }

  it('hangs from the middle of the icon, just under the bar', () => {
    const spot = panelSpot({ x: 700, y: 0, width: 40, height: 24 }, panel, work)

    expect(spot.x).toBe(720 - panel.width / 2)
    expect(spot.y).toBeGreaterThanOrEqual(work.y)
    expect(spot.y).toBeLessThan(work.y + 16)
  })

  it('keeps a panel under an icon at the edge on the screen', () => {
    const spot = panelSpot({ x: 1410, y: 0, width: 30, height: 24 }, panel, work)

    expect(spot.x + panel.width).toBeLessThanOrEqual(work.x + work.width)
    expect(spot.x).toBeGreaterThan(work.x)
  })

  it('follows the icon onto a second screen', () => {
    const second = { x: -1920, y: 0, width: 1920, height: 1080 }
    const spot = panelSpot({ x: -900, y: 0, width: 30, height: 24 }, panel, second)

    expect(spot.x).toBeLessThan(0)
    expect(spot.x).toBeGreaterThan(second.x)
  })

  // Pushed up under the bar rather than hanging off the bottom of the screen.
  it('keeps the top edge on screen when the panel is taller than the space', () => {
    const spot = panelSpot({ x: 700, y: 0, width: 30, height: 24 }, { width: 272, height: 2000 }, work)

    expect(spot.y).toBe(work.y)
  })
})

describe('what the menu bar says', () => {
  it('counts the same tasks as the button in the app, and stops at ninety nine', () => {
    expect(badgeText(0)).toBe('')
    expect(badgeText(-1)).toBe('')
    expect(badgeText(3)).toBe('3')
    expect(badgeText(9)).toBe('9')
    expect(badgeText(40)).toBe('40')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(140)).toBe('99+')
  })

  it('says what is waiting, and nothing else', () => {
    const state = emptyPresence()

    expect(presenceTooltip(state)).toBe('Crew')
    expect(presenceTooltip({ ...state, sharing: true })).toBe('Crew')
    expect(presenceTooltip({ ...state, sharing: true, waiting: 1 })).toBe('Crew: 1 task needs review')
    expect(presenceTooltip({ ...state, sharing: true, waiting: 4 })).toBe('Crew: 4 tasks need review')
  })
})

describe('who is here', () => {
  it('is everyone but you, and only the agents that are working', () => {
    const here = presentNow(
      [member('self', 'Jamel', true), member('m1', 'Ali', true), member('m2', 'Sam', false)],
      [agent('a1', 'Bubbles', 'busy'), agent('a2', 'Kimi', 'idle')],
      'self',
      { a1: ['p1', 'p2'] }
    )

    expect(here.map(one => one.name)).toEqual(['Ali', 'Bubbles'])
    expect(here[0].agent).toBe(false)
    expect(here[1]).toMatchObject({ agent: true, threads: 2 })
  })

  it('carries the picture a person or an agent wears, which the panel cannot look up', () => {
    const withPhoto = { ...agent('a1', 'Bubbles', 'busy'), avatar: 'pet.png' }
    const person = { ...member('m1', 'Ali', true), avatar: 'ali.png' }
    const here = presentNow([person], [withPhoto], 'self', {}, file => `http://host/files/${file}`)

    expect(here[0].photo).toBe('http://host/files/ali.png')
    expect(here[1].photo).toBe('http://host/files/pet.png')
  })
})
