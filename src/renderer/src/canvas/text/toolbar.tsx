import { getMarkRange, type Editor as TipTapEditor } from '@tiptap/core'
import type { MarkType } from '@tiptap/pm/model'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { BoldGlyph, BulletListGlyph, CodeGlyph, ItalicGlyph, LinkGlyph } from '../../components/doc/docGlyphs'
import { HighlighterGlyph, type Glyph } from '../../design/glyphs'
import { ExternalLinkGlyph, TrashGlyph } from '../../icons'

export type RichTextAction = 'bold' | 'italic' | 'code' | 'link' | 'bulletList' | 'highlight'

interface ActionSpec {
  action: Exclude<RichTextAction, 'link'>
  label: string
  glyph: Glyph
}

const ACTIONS: ActionSpec[] = [
  { action: 'bold', label: 'Bold', glyph: BoldGlyph },
  { action: 'italic', label: 'Italic', glyph: ItalicGlyph },
  { action: 'code', label: 'Code', glyph: CodeGlyph },
  { action: 'bulletList', label: 'List', glyph: BulletListGlyph },
  { action: 'highlight', label: 'Highlight', glyph: HighlighterGlyph }
]

const COMMANDS = {
  bold: 'toggleBold',
  italic: 'toggleItalic',
  code: 'toggleCode',
  bulletList: 'toggleBulletList',
  highlight: 'toggleHighlight'
} as const

export function runRichTextAction(editor: TipTapEditor, action: Exclude<RichTextAction, 'link'>): boolean {
  const chain = editor.chain().focus() as unknown as Record<string, () => { run(): boolean }>
  return chain[COMMANDS[action]]().run()
}

export function normalizeLink(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

export function setRichTextLink(editor: TipTapEditor, value: string): boolean {
  const href = normalizeLink(value)
  if (href) return editor.chain().setLink({ href }).run()
  return editor.chain().unsetLink().run()
}

interface ToolbarPosition {
  left: number
  top: number
}

export interface RichTextToolbarProps {
  editor: TipTapEditor | null
  disabled?: boolean
}

export function RichTextToolbar({ editor: given, disabled = false }: RichTextToolbarProps) {
  const editor = given && !given.isDestroyed ? given : null
  const [version, setVersion] = useState(0)
  const [link, setLink] = useState<string | null>(null)
  const [position, setPosition] = useState<ToolbarPosition | null>(null)
  const previous = useRef<ToolbarPosition | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const closeLink = useCallback(() => {
    setLink(null)
    if (!editor) return
    const from = editor.state.selection.from
    editor.commands.setTextSelection({ from, to: from })
    editor.commands.focus()
  }, [editor])

  const commitLink = useCallback(
    (value: string) => {
      if (!editor) return
      setRichTextLink(editor, value)
      closeLink()
    },
    [closeLink, editor]
  )

  const place = useCallback(() => {
    if (!editor || disabled || editor.state.selection.empty) {
      if (link === null) setPosition(null)
      return
    }
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (link === null) setPosition(null)
      return
    }
    const rects = Array.from({ length: selection.rangeCount }, (_, index) =>
      selection.getRangeAt(index).getBoundingClientRect()
    )
    const visible = rects.filter(rect => rect.width > 0 || rect.height > 0)
    if (visible.length === 0) return
    const left = Math.min(...visible.map(rect => rect.left))
    const right = Math.max(...visible.map(rect => rect.right))
    const top = Math.min(...visible.map(rect => rect.top))
    const next = { left: (left + right) / 2, top }
    previous.current = next
    setPosition(next)
  }, [disabled, editor, link])

  useLayoutEffect(() => {
    place()
  }, [place, version])

  useEffect(() => {
    if (!editor) return
    const update = () => setVersion(value => value + 1)
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [editor, place])

  useEffect(() => {
    if (link !== null) input.current?.focus()
  }, [link])

  useEffect(() => {
    if (!editor) return
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      openLinkEditor(editor, setLink)
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [editor])

  useEffect(() => {
    if (!editor || link === null) return
    const outside = (event: PointerEvent) => {
      const toolbar = document.querySelector('[data-testid="canvas-rich-text-toolbar"]')
      if (toolbar?.contains(event.target as Node)) return
      commitLink(link)
    }
    document.addEventListener('pointerdown', outside, { capture: true })
    return () => document.removeEventListener('pointerdown', outside, { capture: true })
  }, [commitLink, editor, link])

  if (!editor || disabled || (!position && !previous.current)) return null
  const at = position ?? previous.current!
  const toolbar = (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="glass fixed z-[70] flex h-9 w-fit -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-0.5 rounded-full px-1.5 text-fg animate-pop"
      style={{ left: at.left, top: at.top }}
      data-testid="canvas-rich-text-toolbar"
    >
      {link !== null ? (
        <>
          <LinkGlyph className="h-4 w-4 shrink-0 text-fg/55" />
          <input
            ref={input}
            value={link}
            onChange={event => setLink(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitLink(link)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeLink()
              }
            }}
            placeholder="Paste a link"
            aria-label="Link"
            className="h-7 w-44 bg-transparent px-1 text-sm text-fg outline-none placeholder:text-fg/40"
          />
          <button
            type="button"
            aria-label="Open link"
            disabled={link.trim() === ''}
            onPointerDown={preventSelectionLoss}
            onClick={() => {
              const href = normalizeLink(link)
              if (href) window.open(href, '_blank')
              closeLink()
            }}
            className="grid h-7 w-7 place-items-center rounded-full text-fg/70 transition-all hover:bg-fg/[0.08] hover:text-fg active:scale-95 disabled:opacity-35"
          >
            <ExternalLinkGlyph className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove link"
            onPointerDown={preventSelectionLoss}
            onClick={() => {
              editor.chain().unsetLink().run()
              closeLink()
            }}
            className="grid h-7 w-7 place-items-center rounded-full text-fg/70 transition-all hover:bg-fg/[0.08] hover:text-fg active:scale-95"
          >
            <TrashGlyph className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          {ACTIONS.slice(0, 3).map(item => (
            <ToolbarButton key={item.action} editor={editor} item={item} />
          ))}
          <button
            type="button"
            aria-label="Link"
            aria-pressed={editor.isActive('link')}
            onPointerDown={preventSelectionLoss}
            onClick={() => openLinkEditor(editor, setLink)}
            className={buttonClass(editor.isActive('link'))}
          >
            <LinkGlyph className="h-4 w-4" />
          </button>
          {ACTIONS.slice(3).map(item => (
            <ToolbarButton key={item.action} editor={editor} item={item} />
          ))}
        </>
      )}
    </div>
  )
  return createPortal(toolbar, document.body)
}

function openLinkEditor(editor: TipTapEditor, setLink: (value: string) => void): void {
  if (editor.isActive('link') && editor.state.selection.empty) {
    try {
      const range = getMarkRange(
        editor.state.doc.resolve(editor.state.selection.from),
        editor.schema.marks.link as MarkType
      )
      if (range) editor.commands.setTextSelection(range)
    } catch {}
  }
  setLink(editor.isActive('link') ? String(editor.getAttributes('link').href ?? '') : '')
}

function ToolbarButton({ editor, item }: { editor: TipTapEditor; item: ActionSpec }) {
  const active = editor.isActive(item.action)
  const Glyph = item.glyph
  return (
    <button
      type="button"
      aria-label={item.label}
      aria-pressed={active}
      onPointerDown={preventSelectionLoss}
      onClick={() => runRichTextAction(editor, item.action)}
      className={buttonClass(active)}
    >
      <Glyph className="h-4 w-4" />
    </button>
  )
}

function preventSelectionLoss(event: ReactPointerEvent): void {
  event.preventDefault()
}

function buttonClass(active: boolean): string {
  return `grid h-7 w-7 place-items-center rounded-full transition-all active:scale-95 ${
    active ? 'bg-fg text-ink-900' : 'text-fg/70 hover:bg-fg/[0.08] hover:text-fg'
  }`
}
