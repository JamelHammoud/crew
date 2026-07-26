import type { Block, PartialBlock } from '@blocknote/core'
import {
  Bars3BottomLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  H1Icon,
  H2Icon,
  H3Icon,
  ListBulletIcon,
  MinusIcon,
  NumberedListIcon,
  PhotoIcon,
  TableCellsIcon
} from '@heroicons/react/16/solid'
import type { Glyph } from '../glyph'

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

const TABLE: PartialBlock = {
  type: 'table',
  content: {
    type: 'tableContent',
    headerRows: 1,
    rows: [{ cells: ['', '', ''] }, { cells: ['', '', ''] }, { cells: ['', '', ''] }]
  } as PartialBlock['content']
}

export const DOC_BLOCKS: DocBlockKind[] = [
  {
    key: 'paragraph',
    title: 'Paragraph',
    group: 'Text',
    mark: Bars3BottomLeftIcon,
    block: { type: 'paragraph' },
    aliases: ['p', 'text', 'plain', 'body'],
    shortcut: 'Mod-Alt-0',
    convert: true
  },
  {
    key: 'heading-1',
    title: 'Heading 1',
    group: 'Text',
    mark: H1Icon,
    block: { type: 'heading', props: { level: 1 } },
    aliases: ['h1', 'heading', 'title'],
    shortcut: 'Mod-Alt-1',
    convert: true
  },
  {
    key: 'heading-2',
    title: 'Heading 2',
    group: 'Text',
    mark: H2Icon,
    block: { type: 'heading', props: { level: 2 } },
    aliases: ['h2', 'subheading'],
    shortcut: 'Mod-Alt-2',
    convert: true
  },
  {
    key: 'heading-3',
    title: 'Heading 3',
    group: 'Text',
    mark: H3Icon,
    block: { type: 'heading', props: { level: 3 } },
    aliases: ['h3', 'subheading'],
    shortcut: 'Mod-Alt-3',
    convert: true
  },
  {
    key: 'quote',
    title: 'Quote',
    group: 'Text',
    mark: ChatBubbleBottomCenterTextIcon,
    block: { type: 'quote' },
    aliases: ['quote', 'blockquote', 'passage'],
    convert: true
  },
  {
    key: 'bullet-list',
    title: 'Bulleted list',
    group: 'Lists',
    mark: ListBulletIcon,
    block: { type: 'bulletListItem' },
    aliases: ['ul', 'list', 'bullet', 'unordered'],
    shortcut: 'Mod-Shift-8',
    convert: true
  },
  {
    key: 'numbered-list',
    title: 'Numbered list',
    group: 'Lists',
    mark: NumberedListIcon,
    block: { type: 'numberedListItem' },
    aliases: ['ol', 'list', 'number', 'ordered'],
    shortcut: 'Mod-Shift-7',
    convert: true
  },
  {
    key: 'todo-list',
    title: 'To-do list',
    group: 'Lists',
    mark: CheckCircleIcon,
    block: { type: 'checkListItem' },
    aliases: ['todo', 'task', 'checkbox', 'tick'],
    shortcut: 'Mod-Shift-9',
    convert: true
  },
  {
    key: 'code',
    title: 'Code',
    group: 'Blocks',
    mark: CodeBracketIcon,
    block: { type: 'codeBlock' },
    aliases: ['code', 'snippet', 'pre'],
    shortcut: 'Mod-Alt-c',
    convert: true
  },
  {
    key: 'divider',
    title: 'Divider',
    group: 'Blocks',
    mark: MinusIcon,
    block: { type: 'divider' },
    aliases: ['divider', 'rule', 'line', 'separator', 'hr'],
    convert: false
  },
  {
    key: 'table',
    title: 'Table',
    group: 'Blocks',
    mark: TableCellsIcon,
    block: TABLE,
    aliases: ['table', 'rows', 'columns', 'grid'],
    convert: false
  },
  {
    key: 'image',
    title: 'Image',
    group: 'Blocks',
    mark: PhotoIcon,
    block: { type: 'image' },
    aliases: ['image', 'picture', 'photo', 'img', 'upload'],
    convert: false
  }
]

export const DOC_GROUPS: DocBlockKind['group'][] = ['Text', 'Lists', 'Blocks']

export function kindOf(block: Block | undefined): DocBlockKind | undefined {
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
