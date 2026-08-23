import { useState, type MouseEvent, type ReactNode } from 'react'
import { CopyGlyph, FileGlyph, PopOutGlyph } from '../icons'
import { makeFileTab, useBrowser } from '../state/browser'
import { MenuDivider, MenuItem, Popover } from './Popover'

interface MenuAt {
  x: number
  y: number
}

export function FileMenu({
  path,
  line = null,
  at,
  onClose
}: {
  path: string
  line?: number | null
  at: MenuAt | null
  onClose: () => void
}) {
  const copy = (kind: 'relative' | 'absolute'): void => {
    onClose()
    void window.crew.copyPaths(path).then(paths => navigator.clipboard.writeText(paths[kind]))
  }

  return (
    <Popover open={at !== null} onClose={onClose} at={at ?? undefined}>
      <MenuItem
        icon={<FileGlyph />}
        label="Open"
        onClick={() => {
          onClose()
          useBrowser.getState().openFile(path, line)
        }}
      />
      <MenuItem
        icon={<PopOutGlyph />}
        label="Open in new window"
        onClick={() => {
          onClose()
          void window.crew.popOutBrowserTab(makeFileTab(path, line))
        }}
      />
      <MenuDivider />
      <MenuItem icon={<CopyGlyph />} label="Copy relative path" onClick={() => copy('relative')} />
      <MenuItem icon={<CopyGlyph />} label="Copy absolute path" onClick={() => copy('absolute')} />
    </Popover>
  )
}

// The right click on anything in Files. The rows it hangs off are three
// different shapes, in the folder listing and in the tree beside it, so what is
// shared is the menu rather than the row: a handler for the button and the card
// to stand beside it.
export function useFileMenu(path: string, line: number | null = null): {
  onContextMenu: (event: MouseEvent) => void
  menu: ReactNode
  menuOpen: boolean
} {
  const [at, setAt] = useState<MenuAt | null>(null)

  return {
    onContextMenu: event => {
      event.preventDefault()
      event.stopPropagation()
      setAt({ x: event.clientX, y: event.clientY })
    },
    menu: <FileMenu path={path} line={line} at={at} onClose={() => setAt(null)} />,
    menuOpen: at !== null
  }
}
