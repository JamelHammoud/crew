import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { localizeDoc, relativizeDoc, uploadImage } from './images'
import { useCrew } from '../state/store'
import { useTheme } from '../state/theme'

export interface DocEditorHandle {
  focusStart: () => void
  flush: () => void
  discard: () => void
}

export default forwardRef<DocEditorHandle, { text: string; onChange: (markdown: string) => void }>(
  function DocEditor({ text, onChange }, ref) {
    const httpBase = useCrew(s => s.httpBase)
    const httpBaseRef = useRef(httpBase)
    httpBaseRef.current = httpBase
    const editor = useCreateBlockNote({
      uploadFile: (file: File) => uploadImage(httpBaseRef.current, file)
    })
    const theme = useTheme()
    const containerRef = useRef<HTMLDivElement>(null)
    const lastMarkdown = useRef('')
    const loaded = useRef(false)
    const timer = useRef<number | null>(null)

  useEffect(() => {
    const focused = containerRef.current?.contains(document.activeElement) ?? false
    if (loaded.current && (focused || text === lastMarkdown.current)) return
    const blocks: PartialBlock[] = editor.tryParseMarkdownToBlocks(localizeDoc(text || '', httpBaseRef.current))
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph', content: [] }])
    lastMarkdown.current = text
    loaded.current = true
  }, [editor, text])

  const save = () => {
    const markdown = relativizeDoc(editor.blocksToMarkdownLossy(editor.document), httpBaseRef.current)
    if (markdown === lastMarkdown.current) return
    lastMarkdown.current = markdown
    onChange(markdown)
  }
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (loaded.current) saveRef.current()
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => {
    return () => flushRef.current()
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focusStart: () => {
        const first = editor.document[0]
        if (first) editor.setTextCursorPosition(first, 'start')
        editor.focus()
      },
      flush: () => flushRef.current(),
      discard: () => {
        if (timer.current !== null) {
          window.clearTimeout(timer.current)
          timer.current = null
        }
        lastMarkdown.current = relativizeDoc(editor.blocksToMarkdownLossy(editor.document), httpBaseRef.current)
      }
    }),
    [editor]
  )

  const handleChange = () => {
    if (!loaded.current) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveRef.current(), 600)
  }

  return (
    <div ref={containerRef} className="doc flex-1 min-h-0">
      <BlockNoteView editor={editor} theme={theme} onChange={handleChange} filePanel={false} />
    </div>
  )
})
