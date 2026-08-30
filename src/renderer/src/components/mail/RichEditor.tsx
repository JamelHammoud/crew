import { useEffect, useRef, useState } from 'react'
import type { Glyph } from '../glyph'
import Tooltip from '../Tooltip'
import { BoldGlyph, ItalicGlyph, UnderlineGlyph } from '../doc/docGlyphs'

function FormatButton({
  label,
  mark: Mark,
  active,
  onPress
}: {
  label: string
  mark: Glyph
  active: boolean
  onPress: () => void
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={event => event.preventDefault()}
        onClick={onPress}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-[background-color,color,transform] active:scale-90 ${
          active ? 'bg-fg/[0.11] text-fg' : 'text-fg/45 hover:bg-fg/[0.07] hover:text-fg'
        }`}
      >
        <Mark className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

export default function RichEditor({
  draftId,
  html,
  text,
  onChange
}: {
  draftId: string
  html?: string
  text: string
  onChange: (value: { html: string; text: string }) => void
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(!text.trim())
  const [active, setActive] = useState({ bold: false, italic: false, underline: false })

  useEffect(() => {
    const node = editor.current
    if (!node) return
    node.innerHTML = html ?? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    setEmpty(!node.textContent?.trim())
  }, [draftId])

  const change = () => {
    const node = editor.current
    if (!node) return
    const plain = node.innerText.replace(/\n{3,}/g, '\n\n')
    setEmpty(!plain.trim())
    onChange({ html: node.innerHTML, text: plain })
  }

  const readFormats = () => {
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    })
  }

  const format = (command: 'bold' | 'italic' | 'underline') => {
    editor.current?.focus()
    document.execCommand(command)
    change()
    readFormats()
  }

  return (
    <div className="min-h-0 flex-1 flex flex-col">
      <div role="toolbar" aria-label="Formatting" className="h-11 shrink-0 px-3.5 border-b border-fg/[0.06] flex items-center gap-0.5">
        <FormatButton label="Bold" mark={BoldGlyph} active={active.bold} onPress={() => format('bold')} />
        <FormatButton label="Italic" mark={ItalicGlyph} active={active.italic} onPress={() => format('italic')} />
        <FormatButton label="Underline" mark={UnderlineGlyph} active={active.underline} onPress={() => format('underline')} />
      </div>
      <div className="min-h-0 flex-1 relative">
        {empty && <span className="absolute left-[18px] top-4 text-sm text-fg/30 pointer-events-none">Write a message</span>}
        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Message"
          onInput={change}
          onKeyUp={readFormats}
          onPointerUp={readFormats}
          className="select-text h-full min-h-[190px] overflow-y-auto px-[18px] py-4 text-sm leading-6 text-fg/80 outline-none whitespace-pre-wrap"
        />
      </div>
    </div>
  )
}
