// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import TypingLine from '../src/renderer/src/components/TypingLine'
import { useCrew } from '../src/renderer/src/state/store'
import type { Typist } from '../src/shared/typing'

const writing = (typists: Typist[]) => {
  useCrew.setState({ selfId: 'ali', typists })
}

const show = (where?: string) => render(createElement(TypingLine, { where }))

describe('the line over the composer', () => {
  afterEach(() => {
    cleanup()
    writing([])
  })

  it('says who is writing here', () => {
    writing([{ id: 'jamel', name: 'Jamel' }])
    show()
    expect(screen.getByText('Jamel is typing')).toBeTruthy()
  })

  it('says nothing about your own keyboard', () => {
    writing([{ id: 'ali', name: 'ALI' }])
    const { container } = show()
    expect(container.firstChild).toBeNull()
  })

  it('says nothing about a box somewhere else', () => {
    writing([{ id: 'jamel', name: 'Jamel', where: 'thread-1' }])
    expect(show().container.firstChild).toBeNull()
    cleanup()
    show('thread-1')
    expect(screen.getByText('Jamel is typing')).toBeTruthy()
  })

  // The dots are the app's own ellipsis, so they carry the wave a thought does
  // rather than standing still as three full stops.
  it('carries a live ellipsis', () => {
    writing([{ id: 'jamel', name: 'Jamel' }])
    const { container } = show()
    expect(container.querySelectorAll('.typing-dot')).toHaveLength(3)
  })

  it('nothing on it is set in a solid grey, because it floats', () => {
    writing([{ id: 'jamel', name: 'Jamel' }])
    const line = show().container.firstElementChild as HTMLElement
    expect(line.className).toContain('glass')
    expect(line.className).toContain('text-fg/70')
    expect(line.className).not.toContain('text-fg-muted')
  })
})
