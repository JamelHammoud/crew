import { useState } from 'react'
import { ChevronDownGlyph } from '../../icons'
import type { Glyph } from '../glyph'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import {
  AlignTextCenterGlyph,
  AlignTextLeftGlyph,
  AlignTextRightGlyph,
  BoldGlyph,
  BulletListGlyph,
  Heading1Glyph,
  Heading2Glyph,
  ItalicGlyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  StrikeGlyph,
  UnderlineGlyph
} from '../doc/docGlyphs'
import type { MailFormatCommand, MailFormatState } from './RichEditor'

const BLOCKS: Array<{ value: MailFormatState['block']; label: string; mark: Glyph }> = [
  { value: 'p', label: 'Normal text', mark: ParagraphGlyph },
  { value: 'h1', label: 'Heading 1', mark: Heading1Glyph },
  { value: 'h2', label: 'Heading 2', mark: Heading2Glyph },
  { value: 'blockquote', label: 'Quote', mark: QuoteGlyph }
]

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-fg/10" />
}

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
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-[background-color,color,transform] active:scale-90 ${
          active ? 'bg-fg/[0.11] text-fg' : 'text-fg/45 hover:bg-fg/[0.07] hover:text-fg'
        }`}
      >
        <Mark className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

export default function MailFormatting({
  state,
  onFormat
}: {
  state: MailFormatState
  onFormat: (command: MailFormatCommand, value?: string) => void
}) {
  const [blocksOpen, setBlocksOpen] = useState(false)
  const block = BLOCKS.find(option => option.value === state.block) ?? BLOCKS[0]

  return (
    <div id="mail-formatting" role="toolbar" aria-label="Formatting" className="h-12 shrink-0 px-3.5 border-t border-fg/[0.06] flex items-center gap-0.5">
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Text style"
          aria-expanded={blocksOpen}
          onMouseDown={event => event.preventDefault()}
          onClick={() => setBlocksOpen(open => !open)}
          className={`h-8 pl-2.5 pr-1.5 rounded-full flex items-center gap-1.5 text-xs font-medium transition-[background-color,color,transform] active:scale-95 ${
            blocksOpen ? 'bg-fg/[0.11] text-fg' : 'text-fg/55 hover:bg-fg/[0.07] hover:text-fg'
          }`}
        >
          <block.mark className="w-4 h-4" />
          <span>{block.label}</span>
          <ChevronDownGlyph className={`w-3.5 h-3.5 text-fg/35 transition-transform ${blocksOpen ? 'rotate-180' : ''}`} />
        </button>
        <Popover open={blocksOpen} onClose={() => setBlocksOpen(false)} side="top" align="start" className="min-w-44">
          {BLOCKS.map(option => (
            <MenuItem
              key={option.value}
              icon={<option.mark className="w-4 h-4" />}
              label={option.label}
              checked={state.block === option.value}
              onClick={() => {
                setBlocksOpen(false)
                onFormat('formatBlock', option.value)
              }}
            />
          ))}
        </Popover>
      </div>
      <Divider />
      <FormatButton label="Bold" mark={BoldGlyph} active={state.bold} onPress={() => onFormat('bold')} />
      <FormatButton label="Italic" mark={ItalicGlyph} active={state.italic} onPress={() => onFormat('italic')} />
      <FormatButton label="Underline" mark={UnderlineGlyph} active={state.underline} onPress={() => onFormat('underline')} />
      <FormatButton label="Strikethrough" mark={StrikeGlyph} active={state.strike} onPress={() => onFormat('strikeThrough')} />
      <Divider />
      <FormatButton label="Align left" mark={AlignTextLeftGlyph} active={state.align === 'left'} onPress={() => onFormat('justifyLeft')} />
      <FormatButton label="Align center" mark={AlignTextCenterGlyph} active={state.align === 'center'} onPress={() => onFormat('justifyCenter')} />
      <FormatButton label="Align right" mark={AlignTextRightGlyph} active={state.align === 'right'} onPress={() => onFormat('justifyRight')} />
      <Divider />
      <FormatButton label="Numbered list" mark={NumberedListGlyph} active={state.ordered} onPress={() => onFormat('insertOrderedList')} />
      <FormatButton label="Bulleted list" mark={BulletListGlyph} active={state.unordered} onPress={() => onFormat('insertUnorderedList')} />
    </div>
  )
}
