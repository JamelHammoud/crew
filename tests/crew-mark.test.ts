// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const played: string[] = []

vi.mock('../src/renderer/src/media/sounds', () => ({
  playSound: (name: string) => void played.push(name)
}))

const { default: CrewLogo } = await import('../src/renderer/src/components/CrewLogo')
const { CrewMark } = await import('../src/renderer/src/components/CrewMark')
const { MARK_DISCS } = await import('../src/renderer/src/components/crew-mark')

beforeEach(() => {
  played.length = 0
})

afterEach(cleanup)

const logo = (): HTMLElement => screen.getByRole('button', { name: 'Crew' })

describe('the mark in the top left', () => {
  it('sounds its own note when the pointer arrives', () => {
    render(createElement(CrewLogo))
    fireEvent.pointerEnter(logo())
    expect(played).toEqual(['crew.mark'])
  })

  it('says it again on a click, so it can be played over and over', () => {
    render(createElement(CrewLogo))
    fireEvent.pointerEnter(logo())
    fireEvent.click(logo())
    fireEvent.click(logo())
    expect(played).toEqual(['crew.mark', 'crew.mark', 'crew.mark'])
  })

  it('draws the discs again on every press, so the arrival replays', () => {
    const { container } = render(createElement(CrewLogo))
    const first = container.querySelector('mask')
    fireEvent.click(logo())
    const second = container.querySelector('mask')
    expect(first).not.toBe(null)
    expect(second).not.toBe(first)
  })

  it('lights the mesh while the pointer is over it and lets it go after', () => {
    const { container } = render(createElement(CrewLogo))
    expect(container.querySelector('.crew-mesh')).not.toBe(null)
    expect(logo().dataset.lit).toBe(undefined)
    fireEvent.pointerEnter(logo())
    expect(logo().dataset.lit).toBe('true')
    fireEvent.pointerLeave(logo())
    expect(logo().dataset.lit).toBe(undefined)
  })

  it('hands each disc its place in the queue, left to right', () => {
    const { container } = render(createElement(CrewLogo))
    const discs = [...container.querySelectorAll('.crew-disc')] as SVGGElement[]
    expect(discs.length).toBe(MARK_DISCS.length)
    const order = discs
      .map(disc => ({
        at: Number(disc.querySelector('circle')?.getAttribute('cx')),
        place: disc.style.getPropertyValue('--disc')
      }))
      .sort((a, b) => a.at - b.at)
    expect(order.map(one => one.place)).toEqual(['0', '1', '2'])
  })

  it('draws past its own edges, so nothing arriving is cut off', () => {
    const { container } = render(createElement(CrewLogo))
    const mask = container.querySelector('mask')
    expect(Number(mask?.getAttribute('x'))).toBeLessThan(0)
    expect(Number(mask?.getAttribute('width'))).toBeGreaterThan(MARK_WIDTH)
  })

  it('leaves the plain mark plain, so the one in the menu bar carries none of it', () => {
    const { container } = render(createElement(CrewMark, { className: 'h-3' }))
    expect(container.querySelector('.crew-mesh')).toBe(null)
    expect(container.querySelector('.crew-disc')).toBe(null)
    expect(container.querySelectorAll('circle').length).toBe(MARK_DISCS.length * 2 - 1)
  })
})
