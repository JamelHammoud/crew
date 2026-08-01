// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentIcon from '../src/renderer/src/components/AgentIcon'
import { BODY, EYE_RADIUS, MIN_BRIDGE, PET_GRID, eyeGapAt, petOf } from '../src/renderer/src/components/art/pet'
import { paletteFor } from '../src/shared/art'
import { useCrew } from '../src/renderer/src/state/store'

// The look is judged on `yarn covers`, which draws every face on one page. This
// holds the rules underneath it: a white face, eyes that are holes rather than
// paint, and a picture behind that is the agent's own.

const SEED = 'jamel/claude'
const PHOTO = 'http://10.0.0.2:2739/attachments/me.png'

beforeEach(() => {
  useCrew.setState({ agents: [], httpBase: '' })
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
    expect(petOf('ali/codex').body).not.toBe(petOf(SEED).body)
  })

  // The angular family keeps its flat sides and its count, and every vertex is
  // turned rather than pointed: nothing a pet is made of comes to a corner.
  it('never comes to a hard corner, whichever family it was drawn from', () => {
    for (let i = 0; i < 400; i++) {
      const body = petOf(`every-${i}`).body
      expect(body).toContain('Q')
      expect(body).not.toMatch(/L[^QZ]*L/)
    }
  })

  // The numbers come off one stream in the order makePet reads them, so
  // reordering that reads a different pet for everybody who already has one.
  it('reads its stream in the order it always did, so nobody wakes up to a new face', () => {
    const pet = petOf(SEED)
    expect(pet.hue).toBe(225)
    expect(pet.eyeY).toBeCloseTo(55.084, 3)
    expect(pet.eyeGap).toBeCloseTo(13.402, 3)
    expect(pet.tilt).toBeCloseTo(4.271, 3)
  })
})

describe('an agent face', () => {
  it('is white, and nothing about it is painted in the hue any more', () => {
    const box = face()
    const shape = box.querySelector('svg rect') as SVGRectElement
    const body = box.querySelector('svg mask path') as SVGPathElement

    expect(shape.getAttribute('fill')).toBe('#fff')
    expect(body.getAttribute('fill')).toBe('#fff')
    expect(body.getAttribute('stroke')).toBe('#fff')
    expect(box.innerHTML).not.toContain('oklch')
  })

  it('cuts the eyes out rather than painting them, so the picture comes through', () => {
    const box = face()
    const eyes = Array.from(box.querySelectorAll('svg mask circle'))
    const pet = petOf(SEED)

    expect(eyes).toHaveLength(2)
    for (const eye of eyes) expect(eye.getAttribute('fill')).toBe('#000')
    expect(eyes.map(eye => Number(eye.getAttribute('cx')))).toEqual([
      50 - pet.eyeGap / 2,
      50 + pet.eyeGap / 2
    ])
  })

  it('stands the picture behind the face rather than over it', () => {
    const box = face()
    const layers = Array.from(box.children)
    const field = layers.findIndex(one => one.className.includes('rounded-full'))
    const drawing = layers.findIndex(one => one.tagName.toLowerCase() === 'svg')

    expect(field).toBeGreaterThanOrEqual(0)
    expect(drawing).toBeGreaterThan(field)
  })

  it('is photographed in the palette its own id answers to', () => {
    const sky = (box: HTMLElement): string => {
      const field = Array.from(box.children).find(one => one.className.includes('rounded-full'))!
      return (field.firstElementChild as HTMLElement).style.backgroundColor
    }
    const mine = sky(face())
    cleanup()
    const theirs = sky(face({ seed: 'ali/kimi' }))

    expect(paletteFor(SEED)).not.toEqual(paletteFor('ali/kimi'))
    expect(mine).not.toBe('')
    expect(mine).not.toBe(theirs)
  })

  // Two holes closer together than a pixel are one slot, and a slot across the
  // middle of a white shape is not a face.
  it('keeps a bridge between the eyes at the size they are really drawn', () => {
    const bridge = (size: string, box: number): number => {
      const eyes = Array.from(face({ size }).querySelectorAll('svg mask circle'))
      const gap = eyes.map(eye => Number(eye.getAttribute('cx')))
      return ((gap[1] - gap[0] - EYE_RADIUS * 2) / PET_GRID) * box * BODY
    }
    const small = bridge('xs', 20)
    cleanup()
    const large = bridge('lg', 48)

    expect(small).toBeGreaterThanOrEqual(MIN_BRIDGE - 0.001)
    expect(large).toBeGreaterThanOrEqual(MIN_BRIDGE - 0.001)
    // Opened only as far as the size asks for, so a face is not two faces.
    expect(eyeGapAt(petOf(SEED), 48)).toBe(petOf(SEED).eyeGap)
  })

  it('draws none of it where somebody has put a photo on', () => {
    const box = face({ photo: PHOTO })

    expect(box.querySelector('img')).not.toBeNull()
    expect(box.querySelector('svg')).toBeNull()
    expect(box.querySelector('canvas')).toBeNull()
  })
})
