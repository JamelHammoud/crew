// @vitest-environment jsdom
import { describe, it } from 'vitest'
import { richTextToHtml } from '../src/renderer/src/canvas/text/richText'
import { renderHtmlFromRichText } from '../src/renderer/src/canvas/schema/richText'

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'plain' }] },
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Head' }] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] }
      ]
    },
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'b' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'i' },
        { type: 'text', marks: [{ type: 'code' }], text: 'c' },
        { type: 'text', marks: [{ type: 'highlight' }], text: 'h' },
        { type: 'text', marks: [{ type: 'strike' }], text: 's' },
        { type: 'hardBreak' },
        { type: 'text', marks: [{ type: 'link', attrs: { href: 'https://x.com' } }], text: 'L' }
      ]
    }
  ]
}

describe('probe', () => {
  it('prints', () => {
    console.log('TIPTAP :', richTextToHtml(doc as never))
    console.log('SCHEMA :', renderHtmlFromRichText(doc as never))
  })
})
