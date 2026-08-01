export interface TLRichTextMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TLRichTextNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TLRichTextNode[]
  marks?: TLRichTextMark[]
  text?: string
}

export interface TLRichText {
  type: string
  content: TLRichTextNode[]
  attrs?: Record<string, unknown>
}

const NBSP = ' '

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  strike: 's',
  code: 'code',
  highlight: 'mark'
}

const LINK_DEFAULTS: Record<string, unknown> = {
  target: '_blank',
  rel: 'noopener noreferrer nofollow'
}

const LINK_ATTRS = ['target', 'rel', 'class', 'href']

const TEXT_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  [NBSP]: '&nbsp;'
}

const ATTR_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  [NBSP]: '&nbsp;'
}

function escapeText(text: string): string {
  return text.replace(/[&<> ]/g, one => TEXT_ESCAPES[one])
}

function escapeAttribute(value: string): string {
  return value.replace(/[&" ]/g, one => ATTR_ESCAPES[one])
}

function linkTag(mark: TLRichTextMark): string {
  const attrs = { ...LINK_DEFAULTS, ...(mark.attrs ?? {}) }
  let out = '<a'
  for (const name of LINK_ATTRS) {
    const value = attrs[name]
    if (value === null || value === undefined) continue
    out += ` ${name}="${escapeAttribute(String(value))}"`
  }
  return out + '>'
}

function wrapInMarks(html: string, marks: TLRichTextMark[] | undefined): string {
  if (!marks || marks.length === 0) return html
  let out = html
  for (let at = marks.length - 1; at >= 0; at--) {
    const mark = marks[at]
    if (mark.type === 'link') out = `${linkTag(mark)}${out}</a>`
    else {
      const tag = MARK_TAGS[mark.type]
      if (tag) out = `<${tag}>${out}</${tag}>`
    }
  }
  return out
}

function childrenHtml(node: TLRichTextNode): string {
  return (node.content ?? []).map(renderNode).join('')
}

const MAX_HEADING_LEVEL = 6

function headingTag(node: TLRichTextNode): string {
  const level = Number(node.attrs?.level)
  if (!Number.isInteger(level) || level < 1 || level > MAX_HEADING_LEVEL) return 'h1'
  return `h${level}`
}

function orderedListOpenTag(node: TLRichTextNode): string {
  const start = Number(node.attrs?.start)
  if (!Number.isInteger(start) || start === 1) return '<ol dir="auto">'
  return `<ol dir="auto" start="${start}">`
}

function renderNode(node: TLRichTextNode): string {
  if (node.type === 'text') return wrapInMarks(escapeText(node.text ?? ''), node.marks)
  if (node.type === 'hardBreak') return '<br dir="auto">'
  if (node.type === 'paragraph') {
    const inner = childrenHtml(node)
    return inner === '' ? '<p><br /></p>' : `<p dir="auto">${inner}</p>`
  }
  if (node.type === 'heading') {
    const tag = headingTag(node)
    return `<${tag} dir="auto">${childrenHtml(node)}</${tag}>`
  }
  if (node.type === 'bulletList') return `<ul dir="auto">${childrenHtml(node)}</ul>`
  if (node.type === 'orderedList') return `${orderedListOpenTag(node)}${childrenHtml(node)}</ol>`
  if (node.type === 'listItem') return `<li dir="auto">${childrenHtml(node)}</li>`
  return childrenHtml(node)
}

export function renderHtmlFromRichText(richText: TLRichText): string {
  return (richText.content ?? []).map(renderNode).join('')
}

export function renderHtmlFromRichTextForMeasurement(richText: TLRichText): string {
  return `<div class="crew-rich-text">${renderHtmlFromRichText(richText)}</div>`
}

function nodeText(node: TLRichTextNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(nodeText).join('')
}

export function toPlainText(richText: TLRichText | null | undefined): string {
  if (!richText?.content) return ''
  return richText.content.map(nodeText).join('\n')
}

export function fromPlainText(text: string): TLRichText {
  const content = text.split('\n').map(line => {
    if (!line) return { type: 'paragraph' }
    return { type: 'paragraph', content: [{ type: 'text', text: line }] }
  })
  return { type: 'doc', content }
}

export function isEmptyRichText(richText: TLRichText | null | undefined): boolean {
  if (!richText?.content || richText.content.length === 0) return true
  if (richText.content.length > 1) return false
  const only = richText.content[0]
  return !only.content || only.content.length === 0
}
