// @vitest-environment jsdom
import { describe, it } from 'vitest'
import { richTextToHtml, richTextToPlainText } from '../src/renderer/src/canvas/text/richText'
import { renderHtmlFromRichText, toPlainText } from '../src/renderer/src/canvas/schema/richText'

const listy = {
  type: 'doc',
  content: [
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }
      ]
    },
    { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'H4' }] }
  ]
}

const plain = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'y' }] }] }
      ]
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'two' }] }
  ]
}

describe('probe', () => {
  it('prints', () => {
    console.log('T-LIST :', richTextToHtml(listy as never))
    console.log('S-LIST :', renderHtmlFromRichText(listy as never))
    console.log('T-TEXT :', JSON.stringify(richTextToPlainText(plain as never)))
    console.log('S-TEXT :', JSON.stringify(toPlainText(plain as never)))
  })
})
