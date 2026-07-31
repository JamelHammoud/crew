import { Editor as TipTapEditor, type Extensions, type JSONContent } from '@tiptap/core'
import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { TLRichText } from '../schema/richText'
import { richTextExtensions } from './richText'
import { IDENTITY_TEXT_TRANSFORM, textTransformCss, type TextPoint, type TextTransform } from './transform'

export interface RichTextEditorProps {
  richText: TLRichText
  editing: boolean
  transform?: TextTransform
  className?: string
  style?: CSSProperties
  editorClassName?: string
  extensions?: Extensions
  selectAll?: boolean
  caret?: TextPoint | null
  onChange(richText: TLRichText): void
  onReady?(editor: TipTapEditor | null): void
  onFocus?(): void
  onBlur?(): void
  onComplete?(): void
  onKeyDown?(event: KeyboardEvent): void
  onPaste?(event: ClipboardEvent): boolean | void
}

function sameDocument(one: TLRichText, two: TLRichText): boolean {
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
  onPaste
}: RichTextEditorProps) {
  const mount = useRef<HTMLDivElement>(null)
  const instance = useRef<TipTapEditor | null>(null)
  const current = useRef(richText)
  const callbacks = useRef({ onChange, onReady, onFocus, onBlur, onComplete, onKeyDown, onPaste })
  callbacks.current = { onChange, onReady, onFocus, onBlur, onComplete, onKeyDown, onPaste }

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
        const document = next.state.doc.toJSON() as TLRichText
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
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            callbacks.current.onComplete?.()
          }
          callbacks.current.onKeyDown?.(event)
          return event.defaultPrevented
        },
        handlePaste: (_view, event) => callbacks.current.onPaste?.(event) === true
      }
    })
    instance.current = editor
    callbacks.current.onReady?.(editor)
    return () => {
      callbacks.current.onReady?.(null)
      instance.current = null
      editor.destroy()
    }
  }, [editing, extensions, selectAll, caret?.x, caret?.y])

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
      <div ref={mount} className={editorClassName} />
    </div>
  )
}
