import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export type MailFormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'insertOrderedList'
  | 'insertUnorderedList'
  | 'formatBlock'

export interface MailFormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  ordered: boolean
  unordered: boolean
  align: 'left' | 'center' | 'right'
  block: 'p' | 'h1' | 'h2' | 'blockquote'
}

export interface RichEditorHandle {
  focus: () => void
  format: (command: MailFormatCommand, value?: string) => void
}

export const EMPTY_MAIL_FORMATS: MailFormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  ordered: false,
  unordered: false,
  align: 'left',
  block: 'p'
}

function currentBlock(): MailFormatState['block'] {
  const value = document.queryCommandValue('formatBlock').toString().toLowerCase().replace(/[<>]/g, '')
  return value === 'h1' || value === 'h2' || value === 'blockquote' ? value : 'p'
}

function currentFormats(): MailFormatState {
  return {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strike: document.queryCommandState('strikeThrough'),
    ordered: document.queryCommandState('insertOrderedList'),
    unordered: document.queryCommandState('insertUnorderedList'),
    align: document.queryCommandState('justifyCenter')
      ? 'center'
      : document.queryCommandState('justifyRight')
        ? 'right'
        : 'left',
    block: currentBlock()
  }
}

const RichEditor = forwardRef<RichEditorHandle, {
  draftId: string
  html?: string
  text: string
  autoFocus?: boolean
  onChange: (value: { html: string; text: string }) => void
  onFormatsChange: (value: MailFormatState) => void
}>(function RichEditor({
  draftId,
  html,
  text,
  autoFocus,
  onChange,
  onFormatsChange
}, handle) {
  const editor = useRef<HTMLDivElement>(null)
  const selection = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(!text.trim())

  useEffect(() => {
    const node = editor.current
    if (!node) return
    node.innerHTML = html ?? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    setEmpty(!node.textContent?.trim())
    if (autoFocus) node.focus()
  }, [draftId, autoFocus])

  const change = () => {
    const node = editor.current
    if (!node) return
    const plain = node.innerText.replace(/\n{3,}/g, '\n\n')
    setEmpty(!plain.trim())
    onChange({ html: node.innerHTML, text: plain })
  }

  const readFormats = () => {
    const found = window.getSelection()
    if (found?.rangeCount && editor.current?.contains(found.anchorNode)) selection.current = found.getRangeAt(0).cloneRange()
    onFormatsChange(currentFormats())
  }

  useImperativeHandle(handle, () => ({
    focus: () => editor.current?.focus(),
    format: (command, value) => {
      editor.current?.focus()
      const found = window.getSelection()
      if (selection.current && found) {
        found.removeAllRanges()
        found.addRange(selection.current)
      }
      document.execCommand(command, false, value)
      change()
      readFormats()
    }
  }))

  const input = () => {
    change()
    readFormats()
  }

  return (
    <div className="min-h-0 flex-1 relative">
      {empty && <span className="absolute left-[18px] top-4 text-sm text-fg/30 pointer-events-none">Write a message</span>}
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Message"
        onInput={input}
        onKeyUp={readFormats}
        onPointerUp={readFormats}
        onFocus={readFormats}
        className="select-text h-full min-h-[190px] overflow-y-auto px-[18px] py-4 text-sm leading-6 text-fg/80 outline-none whitespace-pre-wrap"
      />
    </div>
  )
})

export default RichEditor
