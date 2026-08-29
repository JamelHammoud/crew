import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  AttachmentGlyph,
  ForwardGlyph,
  InboxGlyph,
  LabelGlyph,
  MailGlyph,
  ReplyAllGlyph,
  ReplyGlyph,
  SpamGlyph,
  UnreadGlyph,
  type Glyph
} from '../src/renderer/src/icons'

const mailGlyphs = {
  AttachmentGlyph,
  ForwardGlyph,
  InboxGlyph,
  LabelGlyph,
  MailGlyph,
  ReplyAllGlyph,
  ReplyGlyph,
  SpamGlyph,
  UnreadGlyph
}

describe('mail icons', () => {
  it('draws every mail action on the Crew glyph frame', () => {
    for (const Icon of Object.values(mailGlyphs) as Glyph[]) {
      const markup = renderToStaticMarkup(createElement(Icon))
      expect(markup).toContain('viewBox="0 0 24 24"')
      expect(markup).toContain('stroke="currentColor"')
      expect(markup).toContain('stroke-width="2"')
    }
  })

  it('gives every mail action its own drawing', () => {
    const drawings = Object.values(mailGlyphs).map(Icon =>
      renderToStaticMarkup(createElement(Icon)).replace(/<svg[^>]*>/, '')
    )
    expect(new Set(drawings).size).toBe(drawings.length)
  })
})
