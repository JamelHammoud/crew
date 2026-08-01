import {
  Extension,
  extensions,
  generateHTML,
  generateJSON,
  generateText,
  getSchema,
  type Extensions,
  type JSONContent
} from '@tiptap/core'
import { Code } from '@tiptap/extension-code'
import { Highlight } from '@tiptap/extension-highlight'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { StarterKit } from '@tiptap/starter-kit'

export interface RichTextMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface RichTextNode {
  type: string
  attrs?: Record<string, unknown>
  content?: RichTextNode[]
  marks?: RichTextMark[]
  text?: string
}

export interface RichTextDocument {
  type: string
  content: RichTextNode[]
  attrs?: Record<string, unknown>
}

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

class DocumentCache<Value> {
  private readonly bySource = new WeakMap<Extensions, WeakMap<RichTextDocument, Value>>()

  get(source: Extensions, richText: RichTextDocument, build: () => Value): Value {
    let documents = this.bySource.get(source)
    if (!documents) {
      documents = new WeakMap()
      this.bySource.set(source, documents)
    }
    const cached = documents.get(richText)
    if (cached !== undefined) return cached
    const value = build()
    documents.set(richText, value)
    return value
  }
}

const htmlCache = new DocumentCache<string>()
const plainTextCache = new DocumentCache<string>()

export function isEmptyRichText(richText: RichTextDocument | null | undefined): boolean {
  if (!richText?.content || richText.content.length === 0) return true
  if (richText.content.length > 1) return false
  const only = richText.content[0]
  return !only.content || only.content.length === 0
}

export function richTextToProseMirror(
  richText: RichTextDocument,
  source: Extensions = richTextExtensions
): ProseMirrorNode {
  return richTextSchema(source).nodeFromJSON(richText as JSONContent)
}

export function richTextFromProseMirror(node: ProseMirrorNode): RichTextDocument {
  return node.toJSON() as RichTextDocument
}

export function richTextToHtml(richText: RichTextDocument, source: Extensions = richTextExtensions): string {
  return htmlCache.get(source, richText, () =>
    generateHTML(richText as JSONContent, source).replaceAll('<p dir="auto"></p>', '<p><br /></p>')
  )
}

export function richTextForMeasurement(richText: RichTextDocument, source: Extensions = richTextExtensions): string {
  return `<div class="crew-rich-text">${richTextToHtml(richText, source)}</div>`
}

export function richTextFromHtml(html: string, source: Extensions = richTextExtensions): RichTextDocument {
  return generateJSON(html, source) as RichTextDocument
}

export function richTextToPlainText(richText: RichTextDocument, source: Extensions = richTextExtensions): string {
  if (isEmptyRichText(richText)) return ''
  return plainTextCache.get(source, richText, () =>
    generateText(richText as JSONContent, source, { blockSeparator: '\n' })
  )
}
