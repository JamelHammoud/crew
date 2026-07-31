import { Editor as TipTapEditor, type Extensions, type JSONContent } from '@tiptap/core'
import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { richTextExtensions, type RichTextDocument } from './richText'
import { IDENTITY_TEXT_TRANSFORM, textTransformCss, type TextPoint, type TextTransform } from './transform'
import './text.css'

export interface RichTextEditorProps {
  richText: RichTextDocument
  editing: boolean
  transform?: TextTransform
  className?: string
  style?: CSSProperties
  editorClassName?: string
  extensions?: Extensions
  selectAll?: boolean
  caret?: TextPoint | null
  onChange(richText: RichTextDocument): void
  onReady?(editor: TipTapEditor | null): void
  onFocus?(): void
  onBlur?(): void
  onComplete?(): void
  onKeyDown?(event: KeyboardEvent): void
  onPaste?(event: ClipboardEvent): boolean | undefined
  onDoubleClick?(event: MouseEvent): boolean | undefined
  customTabBehavior?: boolean
}

function sameDocument(one: RichTextDocument, two: RichTextDocument): boolean {
  return JSON.stringify(one) === JSON.stringify(two)
}

export function RichTextEditor({
  richText,
  editing,
  transform = IDENTITY_TEXT_TRANSFORM,
  className = '',
  style,
  editorClassName = '',
  extensions = richTextExtensions,
  selectAll = false,
  caret = null,
  onChange,
  onReady,
  onFocus,
  onBlur,
  onComplete,
  onKeyDown,
  onPaste,
  onDoubleClick,
  customTabBehavior = false
}: RichTextEditorProps) {
  const mount = useRef<HTMLDivElement>(null)
  const instance = useRef<TipTapEditor | null>(null)
  const current = useRef(richText)
  const callbacks = useRef({ onChange, onReady, onFocus, onBlur, onComplete, onKeyDown, onPaste, onDoubleClick })
  callbacks.current = { onChange, onReady, onFocus, onBlur, onComplete, onKeyDown, onPaste, onDoubleClick }

  useLayoutEffect(() => {
    if (!editing || !mount.current || instance.current) return
    const editor = new TipTapEditor({
      element: mount.current,
      extensions,
      content: current.current as JSONContent,
      autofocus: true,
      editable: true,
      coreExtensionOptions: { clipboardTextSerializer: { blockSeparator: '\n' } },
      enableCoreExtensions: { textDirection: false },
      textDirection: 'auto',
      onUpdate: ({ editor: next }) => {
        const document = next.state.doc.toJSON() as RichTextDocument
        current.current = document
        callbacks.current.onChange(document)
      },
      onFocus: () => callbacks.current.onFocus?.(),
      onBlur: () => callbacks.current.onBlur?.(),
      onCreate: ({ editor: next }) => {
        if (selectAll) next.chain().focus().selectAll().run()
        else if (caret) {
          const position = next.view.posAtCoords({ left: caret.x, top: caret.y })?.pos
          if (position !== undefined) next.chain().focus().setTextSelection(position).run()
          else next.chain().focus('end').run()
        } else next.chain().focus('end').run()
      },
      editorProps: {
        handleKeyDown: (_view, event) => {
          if (event.key === 'Tab' && !customTabBehavior) handleTextTab(editor, event)
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            callbacks.current.onComplete?.()
          }
          callbacks.current.onKeyDown?.(event)
          return event.defaultPrevented
        },
        handlePaste: (_view, event) => callbacks.current.onPaste?.(event) === true,
        handleDoubleClick: (_view, _position, event) => callbacks.current.onDoubleClick?.(event) === true
      }
    })
    instance.current = editor
    callbacks.current.onReady?.(editor)
    return () => {
      callbacks.current.onReady?.(null)
      instance.current = null
      editor.destroy()
    }
  }, [editing, extensions, selectAll, caret?.x, caret?.y, customTabBehavior])

  useLayoutEffect(() => {
    const editor = instance.current
    if (!editor || sameDocument(current.current, richText)) return
    current.current = richText
    editor.commands.setContent(richText as JSONContent, { emitUpdate: false })
  }, [richText])

  if (!editing) return null
  const transformStyle: CSSProperties = {
    position: 'absolute',
    transform: textTransformCss(transform),
    transformOrigin: 'top left',
    ...style
  }
  const stop = (event: ReactKeyboardEvent | React.SyntheticEvent) => event.stopPropagation()
  return (
    <div
      className={className}
      style={transformStyle}
      data-testid="canvas-rich-text-editor"
      onContextMenu={stop}
      onPointerDownCapture={stop}
      onTouchEnd={stop}
      onDragStart={event => event.preventDefault()}
    >
      <div ref={mount} className={`crew-text crew-rich-text ${editorClassName}`} />
    </div>
  )
}

export function handleTextTab(editor: TipTapEditor, event: KeyboardEvent): boolean {
  event.preventDefault()
  if (editor.isActive('bulletList') || editor.isActive('orderedList')) return true
  const { state, view } = editor
  const { $from, $to } = state.selection
  let transaction = state.tr
  let position = $to.end()
  while (position >= $from.start()) {
    const line = state.doc.resolve(position).blockRange()
    if (!line) break
    const lineStart = line.start
    const lineEnd = line.end
    const text = state.doc.textBetween(lineStart, lineEnd, '\n')
    let inList = false
    state.doc.nodesBetween(lineStart, lineEnd, node => {
      if (node.type.name !== 'bulletList' && node.type.name !== 'orderedList') return true
      inList = true
      return false
    })
    if (!inList) {
      if (event.shiftKey) {
        if (text.startsWith('\t')) transaction = transaction.delete(lineStart + 1, lineStart + 2)
      } else transaction = transaction.insertText('\t', lineStart + 1)
    }
    position = lineStart - 1
  }
  transaction.setSelection(state.selection.map(transaction.doc, transaction.mapping))
  if (transaction.docChanged) view.dispatch(transaction)
  return true
}
