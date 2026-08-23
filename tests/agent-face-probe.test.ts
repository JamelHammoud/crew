// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentIcon from '../src/renderer/src/components/AgentIcon'
import {
  EYE_HEIGHT,
  EYE_WIDTH,
  FIELD_LIGHT,
  MIN_EYE_GAP,
  PET_GRID,
  PET_SHAPE_KINDS,
  eyeGapAt,
  petOf,
  petPath
} from '../src/renderer/src/components/art/pet'
import { paletteFor } from '../src/shared/art'
import { useCrew } from '../src/renderer/src/state/store'

const SEED = 'jamel/claude'
const PHOTO = 'http://192.0.2.10:2739/attachments/me.png'

beforeEach(() => {
  useCrew.setState({ agents: [], httpBase: '', activePrompts: {}, steps: {} })
})

afterEach(() => {
  cleanup()
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
    for (const pet of pets) {
      expect(pet.body).toMatch(/[Ca]/)
      expect(pet.body.endsWith('Z')).toBe(true)
    }
  })

  it('keeps the seeded identity stable', () => {
    const pet = petOf(SEED)
    expect(pet.hue).toBe(225)
    expect(pet.kind).toBe('teardrop')
    expect(pet.eyeX).toBeCloseTo(55.95, 2)
    expect(pet.eyeY).toBeCloseTo(46.707, 3)
    expect(pet.eyeGap).toBeCloseTo(18.38, 2)
    expect(pet.tilt).toBeCloseTo(-8.474, 2)
  })

  it('scales one silhouette to the box without changing its family', () => {
    const pet = petOf(SEED)
    expect(petPath(pet, 20)).not.toBe(pet.body)
    expect(petPath(pet, 20)).toContain('M 10 1.4')
    expect(petPath(pet, PET_GRID)).toBe(pet.body)
  })
})

describe('an agent face', () => {
  it('uses its generated field as the silhouette instead of a circular background', () => {
    const box = face({ size: 'xs' })
    const body = box.querySelector('.agent-pet-body') as HTMLElement
    const field = body.firstElementChild as HTMLElement

    expect(field.style.clipPath).toContain('path(')
    expect(field.style.clipPath).toContain(petPath(petOf(SEED), 20).slice(0, 20))
    expect(field.className).not.toContain('rounded-full')
    expect(box.querySelector('.rounded-full')).toBeNull()
  })

  it('cuts two capsule eyes through the shape', () => {
    const box = face()
    const eyes = Array.from(box.querySelectorAll('.agent-pet-eyes rect')) as SVGRectElement[]
    const pet = petOf(SEED)
    const gap = eyeGapAt(pet, 40)

    expect(eyes).toHaveLength(2)
    for (const eye of eyes) {
      expect(eye.getAttribute('fill')).toBe('#000')
      expect(Number(eye.getAttribute('width'))).toBe(EYE_WIDTH * 0.4)
      expect(Number(eye.getAttribute('height'))).toBe(EYE_HEIGHT * 0.4)
      expect(Number(eye.getAttribute('rx'))).toBe((EYE_WIDTH / 2) * 0.4)
    }
    expect(eyes.map(eye => Number(eye.getAttribute('x')) + (EYE_WIDTH / 2) * 0.4)).toEqual([
      (pet.eyeX - gap / 2) * 0.4,
      (pet.eyeX + gap / 2) * 0.4
    ])
    expect(pet.eyeY).toBeLessThan(PET_GRID / 2)
  })

  it('stands the eyes and inset edge over the clipped field', () => {
    const body = face().querySelector('.agent-pet-body') as HTMLElement
    const layers = Array.from(body.children)
    const field = layers.findIndex(one => one.tagName.toLowerCase() === 'span')
    const drawing = layers.findIndex(one => one.tagName.toLowerCase() === 'svg')
    const edge = body.querySelector('svg > path') as SVGPathElement

    expect(field).toBe(0)
    expect(drawing).toBe(1)
    expect(edge.getAttribute('fill')).toBe('none')
    expect(edge.getAttribute('stroke-opacity')).toBe('0.1')
  })

  it('fills the silhouette from the palette its own id answers to', () => {
    const color = (box: HTMLElement): string => {
      const field = box.querySelector('.agent-pet-body > span') as HTMLElement
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
      const width = (EYE_WIDTH / PET_GRID) * box
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

  it('clips an uploaded photo to the same silhouette without drawing underneath it', () => {
    const box = face({ photo: PHOTO })
    const image = box.querySelector('img') as HTMLImageElement

    expect(image.style.clipPath).toContain('path(')
    expect(image.className).not.toContain('rounded-full')
    expect(box.querySelector('svg')).toBeNull()
    expect(box.querySelector('canvas')).toBeNull()
  })

  it('keeps a live agent moving in the state its latest step names', () => {
    const box = face()

    expect(box.dataset.activity).toBe('idle')
    act(() => useCrew.setState({ activePrompts: { [SEED]: ['p1'] } }))
    expect(box.dataset.activity).toBe('thinking')

    act(() =>
      useCrew.setState({
        steps: {
          p1: [{ id: 'read', ts: 1, kind: 'tool', status: 'running', name: 'Read' }]
        }
      })
    )
    expect(box.dataset.activity).toBe('reading')

    act(() =>
      useCrew.setState({
        steps: {
          p1: [{ id: 'edit', ts: 2, kind: 'tool', status: 'running', name: 'Edit' }]
        }
      })
    )
    expect(box.dataset.activity).toBe('writing')

    act(() =>
      useCrew.setState({
        steps: {
          p1: [{ id: 'bash', ts: 3, kind: 'tool', status: 'running', name: 'Bash' }]
        }
      })
    )
    expect(box.dataset.activity).toBe('acting')

    act(() => useCrew.setState({ activePrompts: {} }))
    expect(box.dataset.activity).toBe('idle')
  })

  it('moves an uploaded face without drawing the generated pet underneath it', () => {
    const box = face({ photo: PHOTO, activity: 'reading' })

    expect(box.dataset.activity).toBe('reading')
    expect(box.querySelector('.agent-photo')).not.toBeNull()
    expect(box.querySelector('.agent-pet-drawing')).toBeNull()
  })
})
