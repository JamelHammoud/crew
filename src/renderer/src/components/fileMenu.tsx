import { useState, type MouseEvent, type ReactNode } from 'react'
import { PlusGlyph, PopOutGlyph } from '../icons'
import { makeFileTab, useBrowser } from '../state/browser'
import { MenuItem, Popover } from './Popover'

// The right click on anything in Files. The rows it hangs off are three
// different shapes, in the folder listing and in the tree beside it, so what is
// shared is the menu rather than the row: a handler for the button and the card
// to stand beside it.
export function useFileMenu(path: string): {
  onContextMenu: (event: MouseEvent) => void
  menu: ReactNode
} {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  return {
    onContextMenu: event => {
      event.preventDefault()
      setAt({ x: event.clientX, y: event.clientY })
    },
    menu: (
      <Popover open={at !== null} onClose={() => setAt(null)} at={at ?? undefined}>
        <MenuItem
          icon={<PlusGlyph />}
          label="Open in a new tab"
          onClick={() => {
            setAt(null)
            useBrowser.getState().addFileTab(path)
          }}
        />
        <MenuItem
          icon={<PopOutGlyph />}
          label="Open in new window"
          onClick={() => {
            setAt(null)
            void window.crew.popOutBrowserTab(makeFileTab(path))
          }}
        />
      </Popover>
    )
  }
}
