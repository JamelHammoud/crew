import { useActiveStyles, useBlockNoteEditor, useSelectedBlocks } from '@blocknote/react'
import {
  BoldIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon
} from '@heroicons/react/16/solid'
import { useEffect, useRef, useState } from 'react'
import type { Glyph } from '../glyph'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { DOC_BLOCKS, kindOf, shortcutLabel } from './docBlocks'

const STYLES: Array<{ style: string; label: string; shortcut: string; mark: Glyph }> = [
  { style: 'bold', label: 'Bold', shortcut: 'Mod-B', mark: BoldIcon },
  { style: 'italic', label: 'Italic', shortcut: 'Mod-I', mark: ItalicIcon },
  { style: 'underline', label: 'Underline', shortcut: 'Mod-U', mark: UnderlineIcon },
  { style: 'strike', label: 'Strikethrough', shortcut: 'Mod-Shift-S', mark: StrikethroughIcon },
  { style: 'code', label: 'Code', shortcut: 'Mod-E', mark: CodeBracketIcon }
]

export default function DocToolbar() {
  const editor = useBlockNoteEditor<any, any, any>()
  const styles = useActiveStyles() as Record<string, unknown>
  const blocks = useSelectedBlocks()
  const [turnOpen, setTurnOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openLink = () => setLink(editor.getSelectedLinkUrl() ?? '')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      openLink()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (link !== null) inputRef.current?.focus()
  }, [link])

  const commitLink = () => {
    const url = (link ?? '').trim()
    setLink(null)
    if (url) editor.createLink(url)
    editor.focus()
  }

  const styleable = blocks.some(block => block.content !== undefined)
  if (!styleable) return null
  const kind = blocks.length === 1 ? kindOf(blocks[0]) : undefined

  if (link !== null)
    return (
      <div className="glass flex h-9 w-80 items-center gap-1.5 rounded-full pl-3 pr-1.5 animate-pop">
        <LinkIcon className="w-4 h-4 shrink-0 text-fg-muted" />
        <input
          ref={inputRef}
          value={link}
          onChange={event => setLink(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitLink()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setLink(null)
              editor.focus()
            }
          }}
          placeholder="Paste a link"
          className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-faint outline-none"
        />
        <button
          onClick={commitLink}
          className="h-6 px-2.5 rounded-full text-xs font-semibold bg-fg text-ink-900 transition-all active:scale-95 shrink-0"
        >
          Link
        </button>
      </div>
    )

  return (
    <div role="toolbar" aria-label="Text" className="glass flex h-9 w-fit items-center gap-0.5 px-1.5 rounded-full animate-pop">
      {kind && (
        <span className="relative flex items-center">
          <button
            onMouseDown={event => event.preventDefault()}
            onClick={() => setTurnOpen(open => !open)}
            aria-expanded={turnOpen}
            className={`flex h-7 items-center gap-1 pl-2.5 pr-1.5 rounded-full text-sm transition-colors ${
              turnOpen ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:text-fg hover:bg-fg/[0.06]'
            }`}
          >
            <span className="whitespace-nowrap">{kind.title}</span>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-fg-muted transition-transform ${turnOpen ? 'rotate-180' : ''}`} />
          </button>
          <Popover open={turnOpen} onClose={() => setTurnOpen(false)} align="start" className="min-w-48">
            {DOC_BLOCKS.filter(option => option.convert).map(option => (
              <MenuItem
                key={option.key}
                icon={<option.mark />}
                label={option.title}
                hint={option.shortcut ? shortcutLabel(option.shortcut) : undefined}
                onClick={() => {
                  setTurnOpen(false)
                  editor.updateBlock(blocks[0], option.block)
                  editor.focus()
                }}
              />
            ))}
          </Popover>
          <span className="mx-1 h-5 w-px bg-fg/10" />
        </span>
      )}
      {STYLES.map(item => {
        const active = styles[item.style] === true
        return (
          <Tooltip key={item.style} label={`${item.label}  ${shortcutLabel(item.shortcut)}`} disabled={turnOpen}>
            <button
              onMouseDown={event => event.preventDefault()}
              onClick={() => editor.toggleStyles({ [item.style]: true })}
              aria-label={item.label}
              aria-pressed={active}
              className={`w-7 h-7 rounded-full grid place-items-center transition-all active:scale-95 ${
                active ? 'bg-fg text-ink-900' : 'text-fg-secondary hover:text-fg hover:bg-fg/[0.08]'
              }`}
            >
              <item.mark className="w-4 h-4" />
            </button>
          </Tooltip>
        )
      })}
      <span className="mx-1 h-5 w-px bg-fg/10" />
      <Tooltip label={`Link  ${shortcutLabel('Mod-K')}`} disabled={turnOpen}>
        <button
          onMouseDown={event => event.preventDefault()}
          onClick={openLink}
          aria-label="Link"
          className="w-7 h-7 rounded-full grid place-items-center text-fg-secondary hover:text-fg hover:bg-fg/[0.08] transition-all active:scale-95"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  )
}
