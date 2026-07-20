import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface DocEditorHandle {
  focusStart: () => void
}

export default forwardRef<DocEditorHandle, { text: string; onChange: (markdown: string) => void }>(
  function DocEditor({ text, onChange }, ref) {
  const editor = useCreateBlockNote()
  const containerRef = useRef<HTMLDivElement>(null)
  const lastMarkdown = useRef('')
  const loaded = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const focused = containerRef.current?.contains(document.activeElement) ?? false
    if (loaded.current && (focused || text === lastMarkdown.current)) return
    const blocks: PartialBlock[] = editor.tryParseMarkdownToBlocks(text || '')
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph', content: [] }])
    lastMarkdown.current = text
    loaded.current = true
  }, [editor, text])

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focusStart: () => {
        const first = editor.document[0]
        if (first) editor.setTextCursorPosition(first, 'start')
        editor.focus()
      }
    }),
    [editor]
  )

  const save = () => {
    const markdown = editor.blocksToMarkdownLossy(editor.document)
    if (markdown === lastMarkdown.current) return
    lastMarkdown.current = markdown
    onChange(markdown)
  }

  const handleChange = () => {
    if (!loaded.current) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, 600)
  }

  return (
    <div ref={containerRef} className="doc flex-1 min-h-0">
      <BlockNoteView editor={editor} theme="dark" onChange={handleChange} filePanel={false} />
    </div>
  )
})
