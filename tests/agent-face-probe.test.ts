// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentIcon from '../src/renderer/src/components/AgentIcon'
import {
  FIELD_LIGHT,
  MIN_EYE_GAP,
  PET_GRID,
  PET_SHAPE_KINDS,
  eyeGapAt,
  eyeSize,
  eyesFit,
  petOf,
  petPath
} from '../src/renderer/src/components/art/pet'
import { paletteFor } from '../src/shared/art'
import { useCrew } from '../src/renderer/src/state/store'
import { activityForStep } from '../src/renderer/src/components/agentActivity'

const SEED = 'jamel/claude'
const PHOTO = 'http://192.0.2.10:2739/attachments/me.png'
const styles = (require('node:fs') as typeof import('node:fs')).readFileSync(
  `${process.cwd()}/src/renderer/src/styles.css`,
  'utf8'
)

beforeEach(() => {
  useCrew.setState({ agents: [], httpBase: '', activePrompts: {}, steps: {} })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const face = (props: Record<string, unknown> = {}): HTMLElement =>
  render(createElement(AgentIcon, { seed: SEED, ...props })).container.firstElementChild as HTMLElement

describe('the pet an agent wears', () => {
  it('is the same pet for one id and a different one for two', () => {
    expect(petOf(SEED)).toEqual(petOf(SEED))
    expect(petOf('ali/codex')).not.toEqual(petOf(SEED))
  })

  it('uses every silhouette family and closes each one through curves', () => {
    const pets = Array.from({ length: 700 }, (_, index) => petOf(`every-${index}`))
    expect(new Set(pets.map(pet => pet.kind))).toEqual(new Set(PET_SHAPE_KINDS))
    expect(PET_SHAPE_KINDS).not.toContain('cloud')
    expect(pets.some(pet => String(pet.kind) === 'cloud')).toBe(false)
    for (const pet of pets) {
      expect(pet.body).toMatch(/[CQa]/)
      expect(pet.body.endsWith('Z')).toBe(true)
    }
    expect(petPath({ kind: 'teardrop', variant: 0 })).toMatch(/^M 46 10 C 48 7 52 7 54 10/)
    expect(petPath({ kind: 'triangle', variant: 0 })).toMatch(/^M 45 15 C 47 9 53 9 56 15/)
    const polygons = {
      pentagon: 5,
      hexagon: 6,
      'tall-hexagon': 6,
      octagon: 8,
      decagon: 10
    } as const
    for (const [kind, corners] of Object.entries(polygons)) {
      expect(petPath({ kind: kind as keyof typeof polygons, variant: 0 }).match(/ Q /g)).toHaveLength(corners)
    }
  })

  it('keeps the enlarged rotated eyes inside every silhouette', () => {
    for (let index = 0; index < 1400; index++) expect(eyesFit(petOf(`fit-${index}`))).toBe(true)
  })

  it('looks forward at rest', () => {
    for (let index = 0; index < 700; index++) {
      const pet = petOf(`gaze-${index}`)
      expect(Math.abs(pet.eyeX - PET_GRID / 2)).toBeLessThan(4)
      expect(Math.abs(pet.tilt)).toBeLessThanOrEqual(3)
    }
    expect(eyeSize({ kind: 'circle' })).toEqual({ width: 12, height: 26, radius: 6 })
    expect(eyeSize({ kind: 'triangle' }).width).toBeGreaterThan(9)
    expect(eyeSize({ kind: 'triangle' }).height).toBeGreaterThan(20)
  })

  it('keeps the seeded identity stable', () => {
    const pet = petOf(SEED)
    expect(pet.hue).toBe(225)
    expect(pet.kind).toBe('capsule')
    expect(pet.eyeX).toBe(50)
    expect(pet.eyeY).toBeCloseTo(50.315, 3)
    expect(pet.eyeGap).toBeCloseTo(18.286, 3)
    expect(pet.tilt).toBeCloseTo(2.425, 3)
  })

  it('scales one silhouette to the box without changing its family', () => {
    const pet = petOf(SEED)
    expect(petPath(pet, 20)).not.toBe(pet.body)
    expect(petPath(pet, 20)).toContain('M 5.6 5.098')
    expect(petPath(pet, PET_GRID)).toBe(pet.body)
  })
})

describe('an agent face', () => {
  it('has a separate whole-object silhouette for every live activity', () => {
    const activities = [
      'thinking',
      'reading',
      'searching',
      'editing',
      'designing',
      'running',
      'planning',
      'communicating',
      'acting'
    ] as const
    for (const activity of activities) {
      const box = face({ activity })
      const object = box.querySelector(`[data-object="${activity}"]`)
      expect(object?.querySelector('mask')).not.toBeNull()
      expect(object?.querySelector('foreignObject')?.getAttribute('mask')).toMatch(/^url\(#.+\)$/)
      cleanup()
    }
  })

  it('forms Designing as a rounded handle, brush tip and painted stroke', () => {
    const object = face({ activity: 'designing' }).querySelector('[data-object="designing"]') as HTMLElement
    const pieces = object.querySelectorAll('mask path')

    expect(pieces).toHaveLength(3)
    expect(pieces[0].getAttribute('d')).toMatch(/^M66 5 C73 1/)
    expect(pieces[1].getAttribute('d')).toMatch(/^M31 51 C43 47/)
    expect(object.querySelector('[data-part="paint-stroke"]')).not.toBeNull()
    expect(object.querySelector('.agent-pet-eyes')).toBeNull()
  })

  it('builds Thinking from an animated cloud and three sequential dots', () => {
    const object = face({ activity: 'thinking' }).querySelector('[data-object="thinking"]') as HTMLElement

    expect(object.querySelector('[data-part="thought-cloud"]')).not.toBeNull()
    expect(object.querySelectorAll('[data-part^="thought-lobe-"]')).toHaveLength(7)
    expect(object.querySelectorAll('[data-part^="thought-dot-"]')).toHaveLength(3)
    expect(object.querySelector('[data-part^="thought-tail-"]')).toBeNull()
  })

  it('bobs Thinking continuously without holding at either end', () => {
    const rule = styles.split(".agent-icon .agent-activity-object[data-object='thinking'] {")[1]?.split('}')[0] ?? ''
    const keyframes = styles.split('@keyframes agent-thinking {')[1]?.split('\n}')[0] ?? ''

    expect(rule).toContain('1.6s ease-in-out')
    expect(rule).toContain('infinite alternate')
    expect(keyframes.match(/transform:/g)).toHaveLength(2)
    expect(keyframes).toContain('translateY(3%)')
    expect(keyframes).toContain('translateY(-4%)')
  })

  it('builds Writing from a rounded card and drawn lines', () => {
    const object = face({ activity: 'editing' }).querySelector('[data-object="editing"]') as HTMLElement

    expect(object.querySelector('[data-part="writing-card"]')).not.toBeNull()
    expect(object.querySelectorAll('[data-part^="writing-line-"]')).toHaveLength(3)
    expect(object.querySelector('[data-part="pencil"]')).toBeNull()
  })

  it('builds Running from a rounded terminal, prompt and cursor without command dots', () => {
    const object = face({ activity: 'running' }).querySelector('[data-object="running"]') as HTMLElement

    expect(object.querySelector('[data-part="terminal"]')?.getAttribute('rx')).toBe('22')
    expect(object.querySelector('[data-part="terminal-prompt"]')).not.toBeNull()
    expect(object.querySelector('[data-part="terminal-cursor"]')).not.toBeNull()
    expect(object.querySelector('[data-part^="terminal-command-"]')).toBeNull()
  })

  it('keeps the Running caret still while one underscore blinks and the terminal bobs', () => {
    const rule = styles.split(".agent-icon .agent-activity-object[data-object='running'] {")[1]?.split('}')[0] ?? ''
    const prompt = styles.split(".agent-icon [data-part='terminal-prompt'] {")[1]?.split('}')[0] ?? ''
    const cursor = styles.split(".agent-icon [data-part='terminal-cursor'] {")[1]?.split('}')[0] ?? ''
    const keyframes = styles.split('@keyframes agent-running {')[1]?.split('\n}')[0] ?? ''

    expect(rule).toContain('1.45s ease-in-out')
    expect(rule).toContain('infinite alternate')
    expect(prompt).not.toContain('animation:')
    expect(cursor).toContain('1s steps(1, end)')
    expect(keyframes).toContain('translateY(3%)')
    expect(keyframes).toContain('translateY(-3%)')
  })

  it('keeps Reading as a simple open book and animates only its text lines', () => {
    const object = face({ activity: 'reading' }).querySelector('[data-object="reading"]') as HTMLElement
    const lines = styles.split(".agent-icon [data-part^='book-line'] {")[1]?.split('}')[0] ?? ''

    expect(object.querySelector('[data-part="book-body"]')).not.toBeNull()
    expect(object.querySelectorAll('[data-part^="book-line"]')).toHaveLength(4)
    expect(object.querySelector('[data-part^="page-turn"]')).toBeNull()
    expect(object.querySelector('[data-part="book-spine"]')?.getAttribute('d')).toBe('M50 36 V84')
    expect(lines).toContain('animation: agent-book-line 3.2s')
    expect(styles).not.toContain('@keyframes agent-reading')
    expect(styles).not.toContain('@keyframes agent-book-body')
    expect(styles).not.toContain('@keyframes agent-page-turn')
  })

  it('sweeps a lens and its glint while Searching', () => {
    const object = face({ activity: 'searching' }).querySelector('[data-object="searching"]') as HTMLElement
    const rule = styles.split(".agent-icon .agent-activity-object[data-object='searching'] {")[1]?.split('}')[0] ?? ''

    expect(object.querySelector('[data-part="search-lens"]')).not.toBeNull()
    expect(object.querySelector('[data-part="search-handle"]')).not.toBeNull()
    expect(object.querySelector('[data-part="search-glint"]')).not.toBeNull()
    expect(rule).toContain('2.6s ease-in-out')
    expect(styles).toContain('@keyframes agent-search-glint')
  })

  it('draws all three rows in Planning instead of leaving the last row still', () => {
    const object = face({ activity: 'planning' }).querySelector('[data-object="planning"]') as HTMLElement

    expect(object.querySelectorAll('[data-part^="plan-row-"]')).toHaveLength(3)
    expect(object.querySelectorAll('[data-part^="plan-check-"]')).toHaveLength(3)
    expect(object.querySelectorAll('[data-part^="plan-line-"]')).toHaveLength(3)
    expect(styles).toContain("[data-part='plan-check-three']")
    expect(styles).toContain('animation: agent-plan-mark-three 3.6s')
  })

  it('keeps Communicating readable as one bubble with a three-dot wave', () => {
    const object = face({ activity: 'communicating' }).querySelector('[data-object="communicating"]') as HTMLElement

    expect(object.querySelector('[data-part="message"]')).not.toBeNull()
    expect(object.querySelectorAll('[data-part^="message-dot-"]')).toHaveLength(3)
    expect(object.querySelector('[data-part="message-two"]')).toBeNull()
    expect(styles).toContain("[data-part^='message-dot']")
    expect(styles).toContain('@keyframes agent-message-dot')
  })

  it('turns the general action gear around a breathing center', () => {
    const object = face({ activity: 'acting' }).querySelector('[data-object="acting"]') as HTMLElement

    expect(object.querySelector('[data-part="tool-gear"]')).not.toBeNull()
    expect(object.querySelector('[data-part="tool-pulse"]')).not.toBeNull()
    expect(styles).toContain("[data-part='tool-gear']")
    expect(styles).toContain('animation: agent-tool-gear 3.8s linear')
    expect(styles).toContain('animation: agent-tool-pulse 1.9s ease-in-out')
  })

  it('gives every activity a moving part inside its silhouette', () => {
    const activities = [
      'thinking',
      'reading',
      'searching',
      'editing',
      'designing',
      'running',
      'planning',
      'communicating',
      'acting'
    ] as const

    for (const activity of activities) {
      expect(face({ activity }).querySelector(`[data-object="${activity}"] [data-part]`)).not.toBeNull()
      cleanup()
    }
  })

  it('uses its generated field as the silhouette instead of a circular background', () => {
    const box = face({ size: 'xs' })
    const shape = box.querySelector('mask > path') as SVGPathElement
    const field = box.querySelector('.agent-pet-field') as HTMLElement
    const picture = box.querySelector('foreignObject') as SVGForeignObjectElement

    expect(shape.getAttribute('d')).toBe(petPath(petOf(SEED), 20))
    expect(picture.getAttribute('mask')).toMatch(/^url\(#.+\)$/)
    expect(field.className).not.toContain('rounded-full')
    expect(box.querySelector('.rounded-full')).toBeNull()
  })

  it('cuts two capsule eyes through the shape', () => {
    const box = face()
    const eyes = Array.from(box.querySelectorAll('.agent-pet-eyes rect')) as SVGRectElement[]
    const pet = petOf(SEED)
    const gap = eyeGapAt(pet, 40)
    const size = eyeSize(pet)

    expect(eyes).toHaveLength(2)
    for (const eye of eyes) {
      expect(eye.getAttribute('fill')).toBe('#000')
      expect(Number(eye.getAttribute('width'))).toBe(size.width * 0.4)
      expect(Number(eye.getAttribute('height'))).toBe(size.height * 0.4)
      expect(Number(eye.getAttribute('rx'))).toBe(size.radius * 0.4)
    }
    const centers = eyes.map(eye => Number(eye.getAttribute('x')) + size.radius * 0.4)
    expect(centers[0]).toBeCloseTo((pet.eyeX - gap / 2) * 0.4, 8)
    expect(centers[1]).toBeCloseTo((pet.eyeX + gap / 2) * 0.4, 8)
    expect(Math.abs(pet.eyeY - PET_GRID / 2)).toBeLessThan(4)
  })

  it('stands the cut-out eyes over the clipped field without an edge or shadow', () => {
    const body = face().querySelector('.agent-pet-body') as HTMLElement
    const drawing = body.firstElementChild as SVGSVGElement
    const layers = Array.from(drawing.children)
    const field = layers.findIndex(one => one.tagName.toLowerCase() === 'foreignobject')
    const definitions = layers.findIndex(one => one.tagName.toLowerCase() === 'defs')

    expect(definitions).toBe(0)
    expect(field).toBe(1)
    expect(drawing.querySelector(':scope > path')).toBeNull()
    expect(body.className).not.toContain('shadow')
  })

  it('fills the silhouette from the palette its own id answers to', () => {
    const color = (box: HTMLElement): string => {
      const field = box.querySelector('.agent-pet-field > span') as HTMLElement
      return (field.firstElementChild as HTMLElement).style.backgroundColor
    }
    const mine = color(face({ size: 'xs' }))
    cleanup()
    const theirs = color(face({ seed: 'ali/kimi', size: 'xs' }))

    expect(paletteFor(SEED)).not.toEqual(paletteFor('ali/kimi'))
    expect(mine).not.toBe('')
    expect(mine).not.toBe(theirs)
    expect(FIELD_LIGHT).toBe(1)
  })

  it('keeps daylight between the capsule eyes at every drawn size', () => {
    const space = (size: string, box: number): number => {
      const eyes = Array.from(face({ size }).querySelectorAll('.agent-pet-eyes rect')) as SVGRectElement[]
      const width = (eyeSize(petOf(SEED)).width / PET_GRID) * box
      const centers = eyes.map(eye => Number(eye.getAttribute('x')) + width / 2)
      return centers[1] - centers[0] - width
    }
    const small = space('xs', 20)
    cleanup()
    const large = space('lg', 48)

    expect(small).toBeGreaterThanOrEqual(MIN_EYE_GAP - 0.001)
    expect(large).toBeGreaterThanOrEqual(MIN_EYE_GAP - 0.001)
    expect(eyeGapAt(petOf(SEED), 48)).toBe(petOf(SEED).eyeGap)
  })

  it('shows an uploaded photo as a plain circle without drawing underneath it', () => {
    const box = face({ photo: PHOTO })
    const image = box.querySelector('img') as HTMLImageElement

    expect(image.style.clipPath).toBe('')
    expect(image.className).toContain('rounded-full')
    expect(box.querySelector('svg')).toBeNull()
    expect(box.querySelector('canvas')).toBeNull()
  })

  it('keeps an ordinary live agent in its idle pose', () => {
    const box = face()

    expect(box.dataset.activity).toBe('idle')
    expect(box.querySelector('.agent-activity-object')).toBeNull()
    act(() => useCrew.setState({ activePrompts: { [SEED]: ['p1'] } }))
    expect(box.dataset.activity).toBe('idle')
    expect(box.querySelector('.agent-pet-eyes')).not.toBeNull()

    act(() =>
      useCrew.setState({
        steps: {
          p1: [{ id: 'read', ts: 1, kind: 'tool', status: 'running', name: 'Read' }]
        }
      })
    )
    expect(box.dataset.activity).toBe('idle')
    expect(box.querySelector('.agent-activity-object')).toBeNull()
  })

  it('keeps an uploaded face as a plain circle while the agent works', () => {
    const box = face({ photo: PHOTO, activity: 'reading' })

    expect(box.dataset.activity).toBe('reading')
    expect(box.querySelector('.agent-photo')).not.toBeNull()
    expect(box.querySelector('.agent-pet-drawing')).toBeNull()
    expect(box.querySelector('.agent-face-stage')).toBeNull()
    expect(box.querySelector('.agent-activity-object')).toBeNull()
    expect(box.querySelector('.agent-morph-bridge')).toBeNull()
  })

  it('switches activity states directly without a morph bridge', () => {
    const view = render(createElement(AgentIcon, { seed: SEED, activity: 'idle' }))
    const box = view.container.firstElementChild as HTMLElement

    view.rerender(createElement(AgentIcon, { seed: SEED, activity: 'reading' }))
    expect(box.querySelector('.agent-face-stage')?.getAttribute('data-motion')).toBe('hidden')
    expect(box.querySelector('[data-object="reading"]')?.parentElement?.getAttribute('data-motion')).toBe('working')
    expect(box.querySelector('.agent-morph-bridge')).toBeNull()

    view.rerender(createElement(AgentIcon, { seed: SEED, activity: 'designing' }))
    expect(box.querySelector('[data-object="reading"]')).toBeNull()
    expect(box.querySelector('.agent-morph-bridge')).toBeNull()
    expect(box.querySelector('[data-object="designing"]')?.parentElement?.getAttribute('data-motion')).toBe('working')
    expect(box.querySelector('.agent-face-stage')?.getAttribute('data-motion')).toBe('hidden')

    view.rerender(createElement(AgentIcon, { seed: SEED, activity: 'idle' }))
    expect(box.querySelector('.agent-activity-object')).toBeNull()
    expect(box.querySelector('.agent-face-stage')?.getAttribute('data-motion')).toBe('present')
  })
})

describe('agent activity objects', () => {
  const activity = (name: string) => activityForStep({ id: name, ts: 1, kind: 'tool', status: 'running', name })

  it('routes live work to a recognizable object family', () => {
    expect(activityForStep(undefined)).toBe('thinking')
    expect(activity('Read')).toBe('reading')
    expect(activity('Grep')).toBe('searching')
    expect(activity('ApplyPatch')).toBe('editing')
    expect(activity('generateImage')).toBe('designing')
    expect(activity('Bash')).toBe('running')
    expect(activity('UpdatePlan')).toBe('planning')
    expect(activity('SendMessage')).toBe('communicating')
    expect(activity('unknownTool')).toBe('acting')
  })
})
