// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import Markdown from '../src/renderer/src/components/Markdown'
import StepRow from '../src/renderer/src/components/StepRow'
import type { ThreadItem } from '../src/renderer/src/components/thread'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

afterEach(cleanup)

const md = (text: string, stream = true) => createElement(Markdown, { text, stream })

const fading = (root: HTMLElement): string[] => [...root.querySelectorAll('.md-in')].map(el => el.textContent ?? '')

function settled(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement
  for (const span of [...copy.querySelectorAll('.md-in')]) {
    while (span.firstChild) span.parentNode!.insertBefore(span.firstChild, span)
    span.remove()
  }
  copy.normalize()
  return copy.innerHTML
}

const thought = (text: string, streaming: boolean): ThreadItem => ({
  key: 'p1:s1',
  ts: 0,
  kind: 'thinking',
  author: 'Bubbles',
  self: false,
  text,
  streaming,
  promptId: 'p1'
})

describe('an answer arriving as it is written', () => {
  it('fades in only what just landed, and leaves the rest alone', () => {
    const { container, rerender } = render(md('The parser'))
    expect(fading(container)).toEqual([])

    rerender(md('The parser threw'))

    expect(fading(container)).toEqual([' threw'])
    expect(container.textContent?.trim()).toBe('The parser threw')
  })

  it('keeps the text already on screen as the very same node', () => {
    const { container, rerender } = render(md('The parser'))
    const before = container.querySelector('p')!.firstChild

    rerender(md('The parser threw it away'))

    expect(container.querySelector('p')!.firstChild).toBe(before)
    expect((before as Text).data).toBe('The parser')
  })

  it('holds several arrivals in the air at once', () => {
    const { container, rerender } = render(md('one'))
    rerender(md('one two'))
    rerender(md('one two three'))

    expect(fading(container)).toEqual([' two', ' three'])
    expect(container.textContent?.trim()).toBe('one two three')
  })

  it('fades a new paragraph in the same way', () => {
    const { container, rerender } = render(md('First.'))
    rerender(md('First.\n\nSecond.'))

    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(fading(container)).toEqual(['Second.'])
  })

  it('never fades when nothing is streaming', () => {
    const { container, rerender } = render(md('one', false))
    rerender(md('one two', false))

    expect(fading(container)).toEqual([])
    expect(container.textContent?.trim()).toBe('one two')
  })

  it('does not fade markup closing over words already on screen', () => {
    const { container, rerender } = render(md('a **bold'))
    rerender(md('a **bold**'))

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(fading(container)).toEqual([])
  })

  it('lands the same document a character at a time as it does in one go', () => {
    const full = [
      '# Heading',
      '',
      'A paragraph with `code`, **bold** and a [link](https://example.com).',
      '',
      '- first item',
      '- second item',
      '',
      '> a quote',
      '',
      '```ts',
      'const one = 1',
      '```'
    ].join('\n')

    const { container, rerender } = render(md(full.slice(0, 1)))
    for (let i = 2; i <= full.length; i++) rerender(md(full.slice(0, i)))

    const once = render(md(full, false))

    expect(settled(container)).toBe(once.container.innerHTML)
    expect(container.textContent).toBe(once.container.textContent)
  })
})

describe('a thought read in the same hand as an answer', () => {
  it('renders the model markup rather than leaving it on the page', () => {
    const { container } = render(createElement(StepRow, { item: thought('**Checking** the parser', true) }))

    expect(container.querySelector('strong')?.textContent).toBe('Checking')
    expect(container.textContent).toContain('Checking the parser')
    expect(container.querySelector('.md-quiet')).not.toBeNull()
  })

  it('fades a thought in as it is written', () => {
    const item = thought('Reading the', true)
    const { container, rerender } = render(createElement(StepRow, { item }))

    rerender(createElement(StepRow, { item: thought('Reading the parser', true) }))

    expect(fading(container)).toEqual([' parser'])
  })

  it('spaces a blank line as a paragraph rather than an empty row', () => {
    const { container } = render(createElement(StepRow, { item: thought('One thing.\n\nThen another.', true) }))

    const paras = [...container.querySelectorAll('.md-quiet p')].map(p => p.textContent)
    expect(paras).toEqual(['One thing.', 'Then another.'])
  })
})
