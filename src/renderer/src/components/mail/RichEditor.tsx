import { useEffect, useRef, useState } from 'react'
import Tooltip from '../Tooltip'

function FormatButton({ label, mark, onPress }: { label: string; mark: string; onPress: () => void }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onMouseDown={event => event.preventDefault()}
        onClick={onPress}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-fg/45 transition-colors hover:bg-fg/[0.07] hover:text-fg active:scale-90"
      >
        {mark}
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

  const format = (command: 'bold' | 'italic' | 'underline') => {
    editor.current?.focus()
    document.execCommand(command)
    change()
  }

  return (
    <div className="min-h-0 flex-1 flex flex-col">
      <div className="h-9 shrink-0 px-3 border-b border-fg/[0.06] flex items-center gap-0.5">
        <FormatButton label="Bold" mark="B" onPress={() => format('bold')} />
        <FormatButton label="Italic" mark="I" onPress={() => format('italic')} />
        <FormatButton label="Underline" mark="U" onPress={() => format('underline')} />
      </div>
      <div className="min-h-0 flex-1 relative">
        {empty && <span className="absolute left-4 top-3 text-sm text-fg/30 pointer-events-none">Write a message</span>}
        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Message"
          onInput={change}
          className="select-text h-full min-h-[170px] overflow-y-auto px-4 py-3 text-sm leading-6 text-fg/80 outline-none whitespace-pre-wrap"
        />
      </div>
    </div>
  )
}
