import { useState, type MouseEvent, type ReactNode } from 'react'
import { CopyGlyph } from '../icons'
import { MenuItem, Popover } from './Popover'

export function useImageMenu(src: string | undefined): {
  menuOpen: boolean
  menu: ReactNode
  onContextMenu: ((event: MouseEvent) => void) | undefined
} {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  return {
    menuOpen: menuAt !== null,
    onContextMenu: src
      ? event => {
          event.preventDefault()
          event.stopPropagation()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }
      : undefined,
    menu: src ? (
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem
          icon={<CopyGlyph />}
          label="Copy image"
          onClick={() => {
            setMenuAt(null)
            void window.crew.copyImage(src)
          }}
        />
      </Popover>
    ) : null
  }
}
