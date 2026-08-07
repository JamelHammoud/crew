import { useState } from 'react'
import { FilesGlyph } from './toolGlyphs'
import Tooltip from './Tooltip'

// Glass is the other half of this. Nothing on a floating panel is set in a solid
// grey, because a photograph behind it lifts the surface past `fg-faint` and the
// mark vanishes, and the round button is the shape every other control on a
// settings page wears.
export default function CopyButton({
  text,
  label = 'Copy',
  glass,
  className = ''
}: {
  text: string | (() => string)
  label?: string
  glass?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <span className={className}>
      <Tooltip label={copied ? 'Copied' : label}>
        <button
          onClick={event => {
            event.stopPropagation()
            void navigator.clipboard.writeText(typeof text === 'function' ? text() : text).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            })
          }}
          className={`shrink-0 flex items-center justify-center transition-colors active:scale-95 ${
            glass
              ? 'w-8 h-8 rounded-full text-fg/45 hover:text-fg hover:bg-fg/[0.07]'
              : 'p-1 rounded-md text-fg-faint hover:text-fg hover:bg-ink-700'
          }`}
        >
          <FilesGlyph className={glass ? 'w-4 h-4' : 'w-[15px] h-[15px]'} />
        </button>
      </Tooltip>
    </span>
  )
}
