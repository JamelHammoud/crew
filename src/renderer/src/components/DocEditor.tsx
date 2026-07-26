import '@blocknote/mantine/style.css'
import type { PartialBlock } from '@blocknote/core'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import {
  FormattingToolbarController,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { useCrew } from '../state/store'
import { useTheme } from '../state/theme'
import { DocEmojiMenu, docEmojiItems } from './doc/DocEmojiMenu'
import DocSideMenu from './doc/DocSideMenu'
import { DocSlashMenu, docSlashItems } from './doc/DocSlashMenu'
import { docDictionary, docSchema } from './doc/docSchema'
import DocToolbar from './doc/DocToolbar'
import { localizeDoc, relativizeDoc, uploadImage } from './images'

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
      schema: docSchema,
      dictionary: docDictionary,
      dropCursor: { width: 2, color: false },
      links: {
        onClick: (event: MouseEvent) => {
          const href = (event.target as HTMLElement).closest('a')?.getAttribute('href')
          if (href) void window.crew?.openExternal(href)
        }
      },
      uploadFile: (file: File) => uploadImage(httpBaseRef.current, file)
    })
    const theme = useTheme()
    const containerRef = useRef<HTMLDivElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)
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

    const addImage = useCallback(() => fileRef.current?.click(), [])

    const onPick = async (file: File) => {
      const url = await uploadImage(httpBaseRef.current, file)
      insertOrUpdateBlockForSlashMenu(editor, { type: 'image', props: { url } })
      editor.focus()
    }

    const slashItems = useCallback(
      async (query: string) => filterSuggestionItems(docSlashItems(editor, addImage), query),
      [addImage, editor]
    )
    const emojiItems = useCallback(async (query: string) => docEmojiItems(editor, query), [editor])
    const pick = useCallback((item: { onItemClick: () => void }) => item.onItemClick(), [])

    return (
      <div ref={containerRef} className="doc flex-1 min-h-0">
        <BlockNoteView
          editor={editor}
          theme={theme}
          onChange={handleChange}
          formattingToolbar={false}
          slashMenu={false}
          emojiPicker={false}
          sideMenu={false}
          filePanel={false}
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
  }
)
