// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import StepGroup from '../src/renderer/src/components/StepGroup'
import StepRow from '../src/renderer/src/components/StepRow'
import { stepBlocks, type ThreadItem } from '../src/renderer/src/components/thread'
import { DOT_R, RING_R } from '../src/renderer/src/components/toolGlyphs'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

afterEach(cleanup)

const thought = (text: string, streaming: boolean, patch: Partial<ThreadItem> = {}): ThreadItem => ({
  key: 'p1:b0',
  ts: 0,
  kind: 'thinking',
  author: 'Claude',
  self: false,
  text,
  streaming,
  ...patch
})

const LONG =
  'The panel reads the file off the disk itself, so the whole of it is work it can do rather than something described to it.'

const readStyles = (): string =>
  (require('node:fs') as typeof import('node:fs')).readFileSync(`${process.cwd()}/src/renderer/src/styles.css`, 'utf8')

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
    render(createElement(StepRow, { item: thought(LONG, true) }))
    const line = screen.getByText(LONG)
    const quiet = line.closest('.md-quiet')
    expect(quiet).not.toBeNull()

    const css = readStyles()
    const rule = css.split('.md-quiet {')[1]?.split('}')[0] ?? ''
    expect(rule).toContain('italic')
    expect(rule).toContain('text-fg-muted')
  })

  it('never sets a thought in bold, however the model wrote it', () => {
    render(createElement(StepRow, { item: thought(`**A heading**\n\n${LONG}`, true) }))
    const bold = document.querySelector('.md-quiet strong')
    expect(bold?.textContent).toBe('A heading')

    const rule = readStyles().split('.md-quiet strong {')[1]?.split('}')[0] ?? ''
    expect(rule).toContain('font-normal')
    expect(rule).not.toContain('font-semibold')
    expect(rule).not.toContain('font-bold')
  })

  it('reads on the row, with the markers taken off, and only opens when there is more to read', () => {
    const { rerender } = render(createElement(StepRow, { item: thought('**Planning the edit**', false) }))
    screen.getByText('Planning the edit')
    expect(document.querySelector('.md-quiet')).toBeNull()
    expect(document.querySelector('button')?.className).toContain('cursor-default')

    rerender(createElement(StepRow, { item: thought(`**Planning the edit**\n\n${LONG}`, false) }))
    screen.getByText('Planning the edit')
    expect(document.querySelector('.md-quiet')).toBeNull()
    fireEvent.click(document.querySelector('button') as HTMLButtonElement)
    expect(screen.getByText(LONG).closest('.md-quiet')).not.toBeNull()
  })

  it('leaves the row upright and keeps the italic for what opens under it', () => {
    const { rerender } = render(createElement(StepRow, { item: thought('**Planning the edit**', false) }))
    expect(screen.getByText('Planning the edit').closest('.italic')).toBeNull()

    rerender(createElement(StepRow, { item: thought(`**Planning the edit**\n\n${LONG}`, false) }))
    expect(screen.getByText('Planning the edit').closest('.italic')).toBeNull()
    fireEvent.click(document.querySelector('button') as HTMLButtonElement)
    expect(screen.getByText(LONG).closest('.md-quiet')).not.toBeNull()
  })

  it('folds a run of thoughts into one that opens onto every one of them', () => {
    const run = ['a', 'b', 'c'].map((key, index) => thought(`**Thought ${index + 1}**`, false, { key, promptId: 'p1' }))
    expect(stepBlocks(run).map(block => block.items.length)).toEqual([3])

    render(createElement(StepGroup, { items: run }))
    screen.getByText('Thought')
    expect(screen.queryByText('Thought 1')).toBeNull()
    fireEvent.click(document.querySelector('button') as HTMLButtonElement)
    screen.getByText('Thought 1')
    screen.getByText('Thought 3')
  })

  it('keeps a pair of thoughts where they can be read, and never folds two runs together', () => {
    const pair = ['a', 'b'].map(key => thought('**One**', false, { key, promptId: 'p1' }))
    expect(stepBlocks(pair).map(block => block.items.length)).toEqual([1, 1])

    const split = [
      thought('**One**', false, { key: 'a', promptId: 'p1' }),
      thought('**Two**', false, { key: 'b', promptId: 'p1' }),
      thought('**Three**', false, { key: 'c', promptId: 'p2' })
    ]
    expect(stepBlocks(split).map(block => block.items.length)).toEqual([1, 1, 1])
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
