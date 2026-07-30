import type { ReactNode } from 'react'
import { fileSize } from '../../../../shared/attachments'
import { ExternalLinkGlyph, WarningGlyph } from '../../icons'
import { markFor } from '../attachmentMark'
import Skeleton from '../Skeleton'
import Tooltip from '../Tooltip'

const WIDTHS = ['w-1/2', 'w-4/5', 'w-2/3', 'w-3/4', 'w-1/3', 'w-4/5', 'w-3/5', 'w-2/5']

export function Loading() {
  return (
    <div className="absolute inset-0 p-4 flex flex-col gap-3">
      {WIDTHS.map((width, index) => (
        <Skeleton key={index} className={`h-4 rounded-full ${width}`} />
      ))}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="select-none px-4 py-3 font-sans text-xs text-fg-muted">{children}</p>
}

export function Failed({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
      <WarningGlyph className="w-8 h-8 text-fg-faint" />
      <p className="text-sm text-fg-muted text-center">{label}</p>
    </div>
  )
}

export function FileMark({ mime }: { mime: string }) {
  const Mark = markFor(mime)
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Mark className="w-10 h-10 text-fg-faint" />
    </div>
  )
}

export const headerButton =
  'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95'

export default function Frame({
  name,
  mime,
  size,
  url,
  tools,
  children
}: {
  name: string
  mime: string
  size: number
  url: string
  tools?: ReactNode
  children: ReactNode
}) {
  const Mark = markFor(mime)
  return (
    <div className="absolute inset-0 bg-ink-900 flex flex-col">
      <div className="shrink-0 h-11 pl-4 pr-2 flex items-center gap-2.5 border-b border-ink-700">
        <Mark className="w-4 h-4 shrink-0 text-fg-muted" />
        <span className="flex-1 min-w-0 truncate text-sm text-fg-secondary">{name}</span>
        {size > 0 && <span className="shrink-0 text-xs text-fg-faint tabular-nums">{fileSize(size)}</span>}
        <Tooltip label="Open on this computer">
          <button
            onClick={() => void window.crew.openExternal(url)}
            aria-label="Open on this computer"
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
          >
            <ExternalLinkGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  )
}
