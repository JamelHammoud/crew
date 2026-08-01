// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { richTextToHtml, type RichTextDocument } from '../src/renderer/src/canvas/text/richText'
import {
  isEmptyRichText,
  renderHtmlFromRichText,
  renderHtmlFromRichTextForMeasurement,
  toPlainText,
  type TLRichText
} from '../src/renderer/src/canvas/schema/richText'

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const item = (text: string) => ({ type: 'listItem', content: [paragraph(text)] })
const doc = (...content: unknown[]) => ({ type: 'doc', content }) as TLRichText

const documents: [name: string, doc: TLRichText][] = [
  ['a single paragraph', doc(paragraph('hello'))],
  ['several paragraphs', doc(paragraph('one'), paragraph('two'), paragraph('three'))],
  ['an empty paragraph', doc({ type: 'paragraph' })],
  ['an empty paragraph between full ones', doc(paragraph('one'), { type: 'paragraph' }, paragraph('two'))],
  ['a paragraph with an empty content array', doc({ type: 'paragraph', content: [] })],
  [
    'every heading level',
    doc(
      ...[1, 2, 3, 4, 5, 6].map(level => ({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: `H${level}` }]
      }))
    )
  ],
  ['a bulleted list', doc({ type: 'bulletList', content: [item('one'), item('two'), item('three')] })],
  ['a numbered list', doc({ type: 'orderedList', attrs: { start: 1 }, content: [item('a'), item('b')] })],
  ['a numbered list that starts partway', doc({ type: 'orderedList', attrs: { start: 7 }, content: [item('a')] })],
  [
    'a list between paragraphs',
    doc(paragraph('before'), { type: 'bulletList', content: [item('x'), item('y')] }, paragraph('after'))
  ],
  [
    'a list holding an empty item',
    doc({ type: 'bulletList', content: [item('one'), { type: 'listItem', content: [{ type: 'paragraph' }] }] })
  ],
  [
    'every mark',
    doc({
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
        { type: 'text', marks: [{ type: 'code' }], text: 'code' },
        { type: 'text', marks: [{ type: 'highlight' }], text: 'highlight' },
        { type: 'text', marks: [{ type: 'strike' }], text: 'strike' }
      ]
    })
  ],
  [
    'stacked marks',
    doc({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: 'both' }]
    })
  ],
  [
    'a link',
    doc({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }], text: 'go' }]
    })
  ],
  ['a hard break', doc({ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] })],
  ['characters that have to be escaped', doc(paragraph('a & b < c > d'))],
  ['a non breaking space', doc(paragraph('a b'))],
  ['a heading inside a list item', doc({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'deep' }] }] }] })]
]

describe('the measurement html a shape is sized from', () => {
  it.each(documents)('says the same as the editor for %s', (_name, source) => {
    expect(renderHtmlFromRichText(source)).toBe(richTextToHtml(source as RichTextDocument))
  })

  it('wraps what it renders in the class the stylesheet holds', () => {
    const source = doc(paragraph('hello'))
    expect(renderHtmlFromRichTextForMeasurement(source)).toBe(
      `<div class="crew-rich-text">${renderHtmlFromRichText(source)}</div>`
    )
  })

  it('leaves an ordinary space alone so a long line still wraps', () => {
    const long = 'the quick brown fox jumps over the lazy dog and keeps on running well past the edge'
    const html = renderHtmlFromRichText(doc(paragraph(long)))
    expect(html).toContain(long)
    expect(html).not.toContain('&nbsp;')
    expect(html).toBe(richTextToHtml(doc(paragraph(long)) as RichTextDocument))
  })

  it('keeps a space somebody meant to hold a line together', () => {
    const held = `held together`
    const html = renderHtmlFromRichText(doc(paragraph(held)))
    expect(html).toContain('&nbsp;')
    expect(html).toBe(richTextToHtml(doc(paragraph(held)) as RichTextDocument))
  })

  it('draws a list as a list rather than as a run of paragraphs', () => {
    const html = renderHtmlFromRichText(doc({ type: 'bulletList', content: [item('one'), item('two')] }))
    expect(html.startsWith('<ul')).toBe(true)
    expect(html).toContain('<li')
  })

  it('keeps a heading at the level it was written', () => {
    const html = renderHtmlFromRichText(doc({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'x' }] }))
    expect(html).toBe('<h3 dir="auto">x</h3>')
  })

  it('reads a heading level nothing answers to as the first one', () => {
    expect(renderHtmlFromRichText(doc({ type: 'heading', content: [{ type: 'text', text: 'x' }] }))).toBe(
      '<h1 dir="auto">x</h1>'
    )
  })
})

describe('the words taken out of rich text', () => {
  it('puts every item of a list on a line of its own', () => {
    expect(toPlainText(doc(paragraph('before'), { type: 'bulletList', content: [item('x'), item('y')] }))).toBe(
      'before\nx\ny'
    )
  })

  it('reads a hard break as a new line', () => {
    expect(
      toPlainText(doc({ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] }))
    ).toBe('a\nb')
  })

  it('holds a run of marked text together', () => {
    expect(
      toPlainText(
        doc({
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'one' },
            { type: 'text', text: ' two' }
          ]
        })
      )
    ).toBe('one two')
  })
})

describe('rich text with nothing in it', () => {
  it.each([
    ['no content at all', doc()],
    ['one paragraph with no content', doc({ type: 'paragraph' })],
    ['one paragraph with an empty content array', doc({ type: 'paragraph', content: [] })]
  ])('reads %s as empty', (_name, source) => {
    expect(isEmptyRichText(source)).toBe(true)
  })

  it.each([
    ['a paragraph with a word in it', doc(paragraph('a'))],
    ['two empty paragraphs', doc({ type: 'paragraph' }, { type: 'paragraph' })]
  ])('does not read %s as empty', (_name, source) => {
    expect(isEmptyRichText(source)).toBe(false)
  })
})
