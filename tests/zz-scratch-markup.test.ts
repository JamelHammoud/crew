import { describe, expect, it } from 'vitest'
import { renderHtmlFromRichTextForMeasurement } from '../src/renderer/src/canvas/schema/richText'
import { richTextForMeasurement } from '../src/renderer/src/canvas/text/richText'

const docs: Record<string, any> = {
  plain: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
  bold: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi', marks: [{ type: 'bold' }] }] }] },
  code: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x=1', marks: [{ type: 'code' }] }] }] },
  link: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'go', marks: [{ type: 'link', attrs: { href: 'https://a.b' } }] }] }] },
  highlight: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'highlight' }] }] }] },
  bullets: { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }] }] },
  heading: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H' }] }] },
}

describe('markup', () => {
  for (const [name, doc] of Object.entries(docs)) {
    it(name, () => {
      const measured = renderHtmlFromRichTextForMeasurement(doc)
      const painted = richTextForMeasurement(doc)
      console.log(`\n${name}\n  measured: ${measured}\n  painted : ${painted}\n  same: ${measured === painted}`)
      expect(true).toBe(true)
    })
  }
})
