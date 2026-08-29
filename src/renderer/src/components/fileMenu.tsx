import { useState, type MouseEvent, type ReactNode } from 'react'
import { CopyGlyph, FileGlyph, FolderGlyph, PopOutGlyph } from '../icons'
import { makeFileTab, useBrowser } from '../state/browser'
import { toast } from '../state/toast'
import { MenuDivider, MenuItem, Popover } from './Popover'

interface MenuAt {
  x: number
  y: number
}

export function FileMenu({
  path,
  line = null,
  diff = null,
  at,
  onClose,
  onNewFile,
  onNewFolder,
  showInFolder = false
}: {
  path: string
  line?: number | null
  diff?: string | null
  at: MenuAt | null
  onClose: () => void
  onNewFile?: () => void
  onNewFolder?: () => void
  showInFolder?: boolean
}) {
  const copy = (kind: 'relative' | 'absolute'): void => {
    onClose()
    void window.crew.copyPaths(path).then(paths => navigator.clipboard.writeText(paths[kind]))
  }

  return (
    <Popover open={at !== null} onClose={onClose} at={at ?? undefined}>
      {onNewFile && onNewFolder && (
        <>
          <MenuItem
            icon={<FileGlyph />}
            label="New file"
            onClick={() => {
              onClose()
              onNewFile()
            }}
          />
          <MenuItem
            icon={<FolderGlyph />}
            label="New folder"
            onClick={() => {
              onClose()
              onNewFolder()
            }}
          />
          <MenuDivider />
        </>
      )}
      <MenuItem
        icon={<FileGlyph />}
        label="Open in a new tab"
        onClick={() => {
          onClose()
          useBrowser.getState().addFileTab(path, line, diff)
        }}
      />
      <MenuItem
        icon={<PopOutGlyph />}
        label="Open in new window"
        onClick={() => {
          onClose()
          void window.crew.popOutBrowserTab(makeFileTab(path, line, diff))
        }}
      />
      {showInFolder && (
        <MenuItem
          icon={<FolderGlyph />}
          label="Show in folder"
          onClick={() => {
            onClose()
            void window.crew.revealFile(path).then(opened => {
              if (!opened) toast.fail('That item is not there any more', { key: 'show-folder' })
            })
          }}
        />
      )}
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
export function useFileMenu(
  path: string,
  line: number | null = null,
  diff: string | null = null,
  create?: { file: () => void; folder: () => void },
  showInFolder = false
): {
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
    menu: (
      <FileMenu
        path={path}
        line={line}
        diff={diff}
        at={at}
        onClose={() => setAt(null)}
        onNewFile={create?.file}
        onNewFolder={create?.folder}
        showInFolder={showInFolder}
      />
    ),
    menuOpen: at !== null
  }
}
