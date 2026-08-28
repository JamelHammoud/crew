import { useState, type MouseEvent, type ReactNode } from 'react'
import type { DocScope } from '../../../../shared/docs'
import { GhostGlyph, LockGlyph, PlusGlyph } from '../../icons'
import { MenuItem, Popover } from '../Popover'

export function useDocsMenu(onCreate: (scope?: DocScope) => void): {
  onContextMenu: (event: MouseEvent) => void
  menu: ReactNode
} {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  const create = (scope?: DocScope) => {
    setAt(null)
    onCreate(scope)
  }

  return {
    onContextMenu: event => {
      event.preventDefault()
      setAt({ x: event.clientX, y: event.clientY })
    },
    menu: (
      <Popover open={at !== null} onClose={() => setAt(null)} at={at ?? undefined} className="min-w-48">
        <MenuItem icon={<PlusGlyph />} label="New page" onClick={() => create()} />
        <MenuItem icon={<LockGlyph />} label="New private page" onClick={() => create('private')} />
        <MenuItem icon={<GhostGlyph />} label="New ghost page" onClick={() => create('ghost')} />
      </Popover>
    )
  }
}
