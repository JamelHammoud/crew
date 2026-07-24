import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/16/solid'
import { SwatchIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { DefaultNavigationPanel, DefaultStylePanel, useCanRedo, useCanUndo, useEditor, useRelevantStyles } from 'tldraw'
import Tooltip from './Tooltip'

export function DesignNavigation() {
  const editor = useEditor()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  return (
    <div className="flex items-end">
      <DefaultNavigationPanel />
      <div className="glass rounded-full flex items-center h-10 px-1 mb-2 pointer-events-auto">
        <Tooltip label="Undo">
          <button
            onClick={() => editor.undo()}
            disabled={!canUndo}
            aria-label="Undo"
            className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted enabled:hover:text-fg enabled:hover:bg-fg/[0.06] transition-all enabled:active:scale-95 disabled:opacity-30"
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Redo">
          <button
            onClick={() => editor.redo()}
            disabled={!canRedo}
            aria-label="Redo"
            className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted enabled:hover:text-fg enabled:hover:bg-fg/[0.06] transition-all enabled:active:scale-95 disabled:opacity-30"
          >
            <ArrowUturnRightIcon className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export function DesignStylePanel() {
  const styles = useRelevantStyles()
  const [open, setOpen] = useState(false)
  if (!styles) return null
  return (
    <div className="flex flex-col items-end gap-2 m-2 pointer-events-none">
      <Tooltip label={open ? 'Hide styles' : 'Styles'}>
        <button
          onClick={() => setOpen(value => !value)}
          aria-label="Styles"
          className={`pointer-events-auto w-10 h-10 rounded-full glass flex items-center justify-center transition-all duration-150 active:scale-95 ${
            open ? 'text-fg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          <SwatchIcon className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </Tooltip>
      {open && (
        <div className="pointer-events-auto">
          <DefaultStylePanel />
        </div>
      )}
    </div>
  )
}
