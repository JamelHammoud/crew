import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import {
  FormattingToolbarController,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { DocTableBlock } from '../../../shared/docTables'
import {
  applyTableAligns,
  applyTableWidths,
  mendDocTableRows,
  readDocTableAligns,
  readDocTableWidths,
  tableAlignsOf,
  tableWidthsOf,
  writeDocTableAligns,
  writeDocTableWidths
} from '../../../shared/docTables'
import { useCrew } from '../state/store'
import { useTheme } from '../state/theme'
import { docEmoji } from './doc/docEmoji'
import { DocEmojiMenu, docEmojiItems } from './doc/DocEmojiMenu'
import { docFence } from './doc/docFence'
import DocSideMenu from './doc/DocSideMenu'
import { DocSlashMenu, docSlashItems, slashMatches } from './doc/DocSlashMenu'
import { docDictionary, docSchema } from './doc/docSchema'
import DocTableHandles from './doc/DocTableHandles'
import DocToolbar from './doc/DocToolbar'
import { localizeDoc, relativizeDoc, uploadImage } from './images'

export interface DocEditorHandle {
  focusStart: () => void
  flush: () => void
  discard: () => void
}

export default forwardRef<
  DocEditorHandle,
  { text: string; onChange: (markdown: string) => void; uploadFile?: (file: File) => Promise<string> }
>(function DocEditor({ text, onChange, uploadFile }, ref) {
  const httpBase = useCrew(s => s.httpBase)
  const httpBaseRef = useRef(httpBase)
  httpBaseRef.current = httpBase
  const uploadFileRef = useRef(uploadFile)
  uploadFileRef.current = uploadFile
  const upload = useCallback(
    (file: File) => uploadFileRef.current?.(file) ?? uploadImage(httpBaseRef.current, file),
    []
  )
  const editor = useCreateBlockNote({
    schema: docSchema,
    dictionary: docDictionary,
    extensions: [docEmoji, docFence],
    disableExtensions: ['previousBlockType'],
    dropCursor: { width: 2, color: false },
    tables: { headers: true },
    links: {
      onClick: (event: MouseEvent) => {
        const href = (event.target as HTMLElement).closest('a')?.getAttribute('href')
        if (href) void window.crew?.openExternal(href)
      }
    },
    uploadFile: upload
  })
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastMarkdown = useRef('')
  const loaded = useRef(false)
  const timer = useRef<number | null>(null)

  const toMarkdown = useCallback(() => {
    const blocks = editor.document as DocTableBlock[]
    const markdown = mendDocTableRows(relativizeDoc(editor.blocksToMarkdownLossy(editor.document), httpBaseRef.current))
    return writeDocTableWidths(writeDocTableAligns(markdown, tableAlignsOf(blocks)), tableWidthsOf(blocks))
  }, [editor])
  const toMarkdownRef = useRef(toMarkdown)
  toMarkdownRef.current = toMarkdown

  useEffect(() => {
    const focused = containerRef.current?.contains(document.activeElement) ?? false
    if (loaded.current && (focused || text === lastMarkdown.current)) return
    const read = readDocTableWidths(text || '')
    const aligns = readDocTableAligns(read.text)
    const blocks: PartialBlock[] = editor.tryParseMarkdownToBlocks(localizeDoc(read.text, httpBaseRef.current))
    applyTableWidths(blocks as DocTableBlock[], read.widths)
    applyTableAligns(blocks as DocTableBlock[], aligns)
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph', content: [] }])
    lastMarkdown.current = text
    loaded.current = true
  }, [editor, text])

  const save = () => {
    const markdown = toMarkdownRef.current()
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
        lastMarkdown.current = toMarkdownRef.current()
      }
    }),
    [editor]
  )

  const handleChange = () => {
    if (!loaded.current) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveRef.current(), 600)
  }

  const addImage = useCallback(() => fileRef.current?.click(), [])

  const onPick = async (file: File) => {
    const url = await upload(file)
    insertOrUpdateBlockForSlashMenu(editor, { type: 'image', props: { url } })
    editor.focus()
  }

  const slashItems = useCallback(
    async (query: string) => slashMatches(docSlashItems(editor, addImage), query),
    [addImage, editor]
  )
  const emojiItems = useCallback(async (query: string) => docEmojiItems(editor, query), [editor])
  const pick = useCallback((item: { onItemClick: () => void }) => item.onItemClick(), [])

  return (
    <div ref={containerRef} className="doc flex-1 min-h-0">
      <BlockNoteView
        editor={editor}
        theme={theme === 'light' ? 'light' : 'dark'}
        onChange={handleChange}
        formattingToolbar={false}
        slashMenu={false}
        emojiPicker={false}
        sideMenu={false}
        filePanel={false}
        tableHandles={false}
      >
        <FormattingToolbarController formattingToolbar={DocToolbar} />
        <SuggestionMenuController
          triggerCharacter="/"
          suggestionMenuComponent={DocSlashMenu}
          getItems={slashItems}
          onItemClick={pick}
        />
        <SuggestionMenuController
          triggerCharacter=":"
          minQueryLength={2}
          suggestionMenuComponent={DocEmojiMenu}
          getItems={emojiItems}
          onItemClick={pick}
        />
        <SideMenuController sideMenu={DocSideMenu} />
        <DocTableHandles />
      </BlockNoteView>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onPick(file)
        }}
      />
    </div>
  )
})
