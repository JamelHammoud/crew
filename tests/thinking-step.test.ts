// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import StepRow from '../src/renderer/src/components/StepRow'
import type { ThreadItem } from '../src/renderer/src/components/thread'
import { DOT_R, RING_R } from '../src/renderer/src/components/toolGlyphs'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

afterEach(cleanup)

const thought = (text: string, streaming: boolean): ThreadItem => ({
  key: 'p1:b0',
  ts: 0,
  kind: 'thinking',
  author: 'Claude',
  self: false,
  text,
  streaming
})

const readStyles = (): string =>
  (require('node:fs') as typeof import('node:fs')).readFileSync(
    `${process.cwd()}/src/renderer/src/styles.css`,
    'utf8'
  )

const mark = (): SVGElement => {
  const el = document.querySelector('.thinking-mark')
  if (!el) throw new Error('no thinking mark')
  return el as SVGElement
}

const ring = (): SVGElement => mark().querySelector('.thinking-ring') as SVGElement

describe('a thinking step', () => {
  it('says Thinking under a live ellipsis, and Thought under a check once it lands', () => {
    const { rerender } = render(createElement(StepRow, { item: thought('working it out', true) }))
    screen.getByText('Thinking')
    expect(mark().getAttribute('data-state')).toBe('thinking')
    expect(mark().style.getPropertyValue('--ring')).toBe(`${DOT_R}px`)
    expect(mark().querySelectorAll('.thinking-dot').length).toBe(3)
    expect(ring()).not.toBeNull()
    expect(mark().querySelector('.thinking-check')).not.toBeNull()

    const before = mark()
    rerender(createElement(StepRow, { item: thought('working it out', false) }))
    screen.getByText('Thought')
    expect(screen.queryByText('Thinking')).toBeNull()
    // The same element carries both states, so the mark transitions in place
    // rather than one glyph being swapped out for another.
    expect(mark()).toBe(before)
    expect(mark().getAttribute('data-state')).toBe('thought')
    expect(mark().style.getPropertyValue('--ring')).toBe(`${RING_R}px`)
    expect(mark().hasAttribute('data-landing')).toBe(true)
  })

  it('draws a thought that was already finished without landing it again', () => {
    render(createElement(StepRow, { item: thought('worked it out', false) }))
    screen.getByText('Thought')
    expect(mark().getAttribute('data-state')).toBe('thought')
    expect(mark().hasAttribute('data-landing')).toBe(false)
    expect(mark().style.getPropertyValue('--ring')).toBe(`${RING_R}px`)
  })

  it('sets the thought in italic, in the muted grey', () => {
    render(createElement(StepRow, { item: thought('working it out', true) }))
    const line = screen.getByText('working it out')
    const quiet = line.closest('.md-quiet')
    expect(quiet).not.toBeNull()

    const css = readStyles()
    const rule = css.split('.md-quiet {')[1]?.split('}')[0] ?? ''
    expect(rule).toContain('italic')
    expect(rule).toContain('text-fg-muted')
  })

  it('breaks a thought into paragraphs instead of leaving a blank line between them', () => {
    render(createElement(StepRow, { item: thought('first thought\n\n\nsecond thought', true) }))
    const paras = Array.from(document.querySelectorAll('p')).map(p => p.textContent)
    expect(paras).toEqual(['first thought', 'second thought'])
    expect(document.body.textContent).not.toContain('\n\n')
  })

  it('keeps a single line break inside a paragraph', () => {
    render(createElement(StepRow, { item: thought('one line\nthe next', true) }))
    const paras = Array.from(document.querySelectorAll('p'))
    expect(paras.length).toBe(1)
    expect(paras[0].querySelectorAll('br').length).toBe(1)
    expect(paras[0].textContent).toBe('one linethe next')
  })
})
