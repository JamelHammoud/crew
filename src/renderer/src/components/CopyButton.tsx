import { useState } from 'react'
import { FilesGlyph } from './toolGlyphs'
import Tooltip from './Tooltip'

export default function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={className}>
      <Tooltip label={copied ? 'Copied' : 'Copy'}>
        <button
          onClick={event => {
            event.stopPropagation()
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            })
          }}
          className="shrink-0 p-1 rounded-md text-fg-faint hover:text-fg hover:bg-ink-700 transition-colors active:scale-95"
        >
          <FilesGlyph className="w-[15px] h-[15px]" />
        </button>
      </Tooltip>
    </span>
  )
}
