import type { PartialBlock } from '@blocknote/core'
import type { Glyph } from '../glyph'
import {
  BulletListGlyph,
  CodeGlyph,
  DividerGlyph,
  Heading1Glyph,
  Heading2Glyph,
  Heading3Glyph,
  ImageGlyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  TableGlyph,
  TodoGlyph
} from './docGlyphs'

export interface DocBlockKind {
  key: string
  title: string
  group: 'Text' | 'Lists' | 'Blocks'
  mark: Glyph
  block: PartialBlock
  aliases: string[]
  shortcut?: string
  convert: boolean
}

const TABLE = {
  type: 'table',
  content: {
    type: 'tableContent',
    headerRows: 1,
    rows: [{ cells: ['', '', ''] }, { cells: ['', '', ''] }, { cells: ['', '', ''] }]
  }
} as PartialBlock

export const DOC_BLOCKS: DocBlockKind[] = [
  {
    key: 'paragraph',
    title: 'Paragraph',
    group: 'Text',
    mark: ParagraphGlyph,
    block: { type: 'paragraph' },
    aliases: ['p', 'text', 'plain', 'body'],
    shortcut: 'Mod-Alt-0',
    convert: true
  },
  {
    key: 'heading-1',
    title: 'Heading 1',
    group: 'Text',
    mark: Heading1Glyph,
    block: { type: 'heading', props: { level: 1 } },
    aliases: ['h1', 'heading', 'title'],
    shortcut: 'Mod-Alt-1',
    convert: true
  },
  {
    key: 'heading-2',
    title: 'Heading 2',
    group: 'Text',
    mark: Heading2Glyph,
    block: { type: 'heading', props: { level: 2 } },
    aliases: ['h2', 'subheading'],
    shortcut: 'Mod-Alt-2',
    convert: true
  },
  {
    key: 'heading-3',
    title: 'Heading 3',
    group: 'Text',
    mark: Heading3Glyph,
    block: { type: 'heading', props: { level: 3 } },
    aliases: ['h3', 'subheading'],
    shortcut: 'Mod-Alt-3',
    convert: true
  },
  {
    key: 'quote',
    title: 'Quote',
    group: 'Text',
    mark: QuoteGlyph,
    block: { type: 'quote' },
    aliases: ['quote', 'blockquote', 'passage'],
    convert: true
  },
  {
    key: 'bullet-list',
    title: 'Bulleted list',
    group: 'Lists',
    mark: BulletListGlyph,
    block: { type: 'bulletListItem' },
    aliases: ['ul', 'list', 'bullet', 'unordered'],
    shortcut: 'Mod-Shift-8',
    convert: true
  },
  {
    key: 'numbered-list',
    title: 'Numbered list',
    group: 'Lists',
    mark: NumberedListGlyph,
    block: { type: 'numberedListItem' },
    aliases: ['ol', 'list', 'number', 'ordered'],
    shortcut: 'Mod-Shift-7',
    convert: true
  },
  {
    key: 'todo-list',
    title: 'To-do list',
    group: 'Lists',
    mark: TodoGlyph,
    block: { type: 'checkListItem' },
    aliases: ['todo', 'task', 'checkbox', 'tick'],
    shortcut: 'Mod-Shift-9',
    convert: true
  },
  {
    key: 'code',
    title: 'Code',
    group: 'Blocks',
    mark: CodeGlyph,
    block: { type: 'codeBlock' },
    aliases: ['code', 'snippet', 'pre'],
    shortcut: 'Mod-Alt-c',
    convert: true
  },
  {
    key: 'divider',
    title: 'Divider',
    group: 'Blocks',
    mark: DividerGlyph,
    block: { type: 'divider' },
    aliases: ['divider', 'rule', 'line', 'separator', 'hr'],
    convert: false
  },
  {
    key: 'table',
    title: 'Table',
    group: 'Blocks',
    mark: TableGlyph,
    block: TABLE,
    aliases: ['table', 'rows', 'columns', 'grid'],
    convert: false
  },
  {
    key: 'image',
    title: 'Image',
    group: 'Blocks',
    mark: ImageGlyph,
    block: { type: 'image' },
    aliases: ['image', 'picture', 'photo', 'img', 'upload'],
    convert: false
  }
]

export function kindOf(block: { type: string; props?: unknown } | undefined): DocBlockKind | undefined {
  if (!block) return undefined
  const level = (block.props as { level?: number } | undefined)?.level
  return DOC_BLOCKS.find(
    kind => kind.block.type === block.type && (kind.block.props as { level?: number } | undefined)?.level === level
  )
}

const SYMBOLS: Record<string, string> = { Mod: '⌘', Alt: '⌥', Shift: '⇧' }

export function shortcutLabel(shortcut: string): string {
  const parts = shortcut.split('-')
  if (/Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? ''))
    return parts.map(part => SYMBOLS[part] ?? part.toUpperCase()).join('')
  return parts.map(part => (part === 'Mod' ? 'Ctrl' : part)).join('+')
}
