import { Extension, extensions, generateHTML, generateJSON, generateText, getSchema, type Extensions, type JSONContent } from '@tiptap/core'
import { Code } from '@tiptap/extension-code'
import { Highlight } from '@tiptap/extension-highlight'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { StarterKit } from '@tiptap/starter-kit'
import type { TLRichText } from '../schema/richText'

const InlineCode = Code.extend({ excludes: undefined })
const RaisedHighlight = Highlight.extend({ priority: 1100 })

export const EnterOnShiftEnter = Extension.create({
  name: 'crewShiftEnter',
  addKeyboardShortcuts() {
    return { 'Shift-Enter': ({ editor }) => editor.commands.enter() }
  }
})

export const richTextExtensions: Extensions = [
  StarterKit.configure({
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
    code: false,
    link: { openOnClick: false, autolink: true },
    trailingNode: { notAfter: ['paragraph', 'bulletList', 'orderedList', 'listItem'] }
  }),
  InlineCode,
  RaisedHighlight,
  EnterOnShiftEnter,
  extensions.TextDirection.configure({ direction: 'auto' })
]

const schemas = new WeakMap<Extensions, Schema>()

export function richTextSchema(source: Extensions = richTextExtensions): Schema {
  const cached = schemas.get(source)
  if (cached) return cached
  const schema = getSchema(source)
  schemas.set(source, schema)
  return schema
}

export function richTextToProseMirror(
  richText: TLRichText,
  source: Extensions = richTextExtensions
): ProseMirrorNode {
  return richTextSchema(source).nodeFromJSON(richText as JSONContent)
}

export function richTextFromProseMirror(node: ProseMirrorNode): TLRichText {
  return node.toJSON() as TLRichText
}

export function richTextToHtml(richText: TLRichText, source: Extensions = richTextExtensions): string {
  return generateHTML(richText as JSONContent, source).replaceAll('<p dir="auto"></p>', '<p><br /></p>')
}

export function richTextForMeasurement(richText: TLRichText, source: Extensions = richTextExtensions): string {
  return `<div class="tl-rich-text">${richTextToHtml(richText, source)}</div>`
}

export function richTextFromHtml(html: string, source: Extensions = richTextExtensions): TLRichText {
  return generateJSON(html, source) as TLRichText
}

export function richTextToPlainText(richText: TLRichText, source: Extensions = richTextExtensions): string {
  if (richText.content.length === 0) return ''
  return generateText(richText as JSONContent, source, { blockSeparator: '\n' })
}
