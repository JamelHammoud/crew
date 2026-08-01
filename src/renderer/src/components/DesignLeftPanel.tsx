import { useMemo, useState } from 'react'
import { useEditor, useValue, type Editor, type TLShape, type TLShapeId } from '../canvas'
import DesignPanel from '../design/DesignPanel'
import { glyphForShape } from '../design/glyphs'
import { useLayerShapes } from '../design/layerShapes'
import { canRename, layerName, renameShape } from '../design/tools'
import {
  ChevronRightGlyph,
  CloseGlyph,
  EyeGlyph,
  EyeOffGlyph,
  LockGlyph,
  SearchGlyph,
  UnlockGlyph
} from '../icons'
import { PanelButton } from './DesignControls'
import Pill from './Pill'
import Tooltip from './Tooltip'

export default function DesignLeftPanel() {
  const editor = useEditor()
  const selection = useValue('design selection size', () => editor.getSelectedShapeIds().length, [editor])
  return (
    <aside
      aria-label={selection > 0 ? 'Design' : 'Layers'}
      className="w-64 shrink-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-ink-900 border-r border-ink-700"
    >
      <div data-design-layers hidden={selection > 0}>
        <Layers editor={editor} />
      </div>
      <div data-design-inspector hidden={selection === 0}>
        <DesignPanel />
      </div>
    </aside>
  )
}

interface LayerRow {
  shape: TLShape
  depth: number
  children: number
}

function buildRows(shapes: TLShape[], collapsed: Set<string>): LayerRow[] {
  const byParent = new Map<string, TLShape[]>()
  for (const shape of shapes) {
    const list = byParent.get(shape.parentId) ?? []
    list.push(shape)
    byParent.set(shape.parentId, list)
  }
  const rows: LayerRow[] = []
  const walk = (parentId: string, depth: number) => {
    const list = byParent.get(parentId) ?? []
    for (const shape of [...list].reverse()) {
      const children = byParent.get(shape.id)?.length ?? 0
      rows.push({ shape, depth, children })
      if (children > 0 && !collapsed.has(shape.id)) walk(shape.id, depth + 1)
    }
  }
  for (const parentId of byParent.keys()) {
    if (parentId.startsWith('page:')) walk(parentId, 0)
  }
  return rows
}

function Layers({ editor }: { editor: Editor }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const shapes = useLayerShapes(editor)

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  const rows = useMemo(() => {
    const all = buildRows(shapes, collapsed)
    const clean = query.trim().toLowerCase()
    if (!clean) return all
    return buildRows(shapes, new Set()).filter(row => layerName(row.shape).toLowerCase().includes(clean))
  }, [shapes, collapsed, query])

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-1 pl-4 pr-2">
        {searching ? (
          <label className="flex-1 min-w-0 h-8 flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-3">
            <SearchGlyph className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.key === 'Escape' && closeSearch()}
              onBlur={() => query.trim() === '' && setSearching(false)}
              placeholder="Find a layer"
              className="w-full min-w-0 bg-transparent text-xs text-fg placeholder:text-fg-muted outline-none"
            />
          </label>
        ) : (
          <span className="flex-1 text-xs font-semibold text-fg-muted">Layers</span>
        )}
        <PanelButton
          label={searching ? 'Close search' : 'Find a layer'}
          onClick={() => (searching ? closeSearch() : setSearching(true))}
        >
          {searching ? <CloseGlyph className="w-4 h-4" /> : <SearchGlyph className="w-4 h-4" />}
        </PanelButton>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {rows.length === 0 && (
          <p className="px-2 py-6 text-xs text-fg-muted text-center">
            {query ? 'Nothing matches that.' : 'Draw something and it shows up here.'}
          </p>
        )}
        {rows.map(row => {
          const id = row.shape.id
          const hidden = row.shape.meta.hidden === true
          const Glyph = glyphForShape(row.shape)
          return (
            <div
              key={id}
              data-shape={id}
              className="group h-7 flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-fg/[0.06]"
              style={{ paddingLeft: 4 + row.depth * 12 }}
            >
              {row.children > 0 && !query ? (
                <button
                  onClick={() => toggle(id)}
                  aria-label={collapsed.has(id) ? 'Expand' : 'Collapse'}
                  className="w-4 h-4 shrink-0 grid place-items-center text-fg-muted hover:text-fg"
                >
                  <ChevronRightGlyph
                    className={`w-3 h-3 transition-transform ${collapsed.has(id) ? '' : 'rotate-90'}`}
                  />
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <Glyph className="w-4 h-4 shrink-0 text-fg-muted" />
              {renaming === id ? (
                <input
                  autoFocus
                  defaultValue={layerName(row.shape)}
                  onBlur={event => {
                    const name = event.target.value.trim()
                    if (name) renameShape(editor, row.shape, name)
                    setRenaming(null)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') setRenaming(null)
                  }}
                  className="flex-1 min-w-0 bg-transparent text-xs text-fg outline-none"
                />
              ) : (
                <button
                  onClick={() => editor.select(id as TLShapeId)}
                  onDoubleClick={() => canRename(row.shape) && setRenaming(id)}
                  className={`flex-1 min-w-0 text-xs text-left truncate ${
                    hidden ? 'text-fg-faint' : 'text-fg-secondary'
                  }`}
                >
                  {layerName(row.shape)}
                </button>
              )}
              {row.shape.type === 'design-node' && (row.shape.props as { component?: string }).component && (
                <Pill>Component</Pill>
              )}
              <RowButton
                label={hidden ? 'Show' : 'Hide'}
                shown={hidden}
                onClick={() =>
                  editor.updateShape({ id: id as TLShapeId, type: row.shape.type, meta: { hidden: !hidden } })
                }
              >
                {hidden ? <EyeOffGlyph className="w-3 h-3" /> : <EyeGlyph className="w-3 h-3" />}
              </RowButton>
              <RowButton
                label={row.shape.isLocked ? 'Unlock' : 'Lock'}
                shown={row.shape.isLocked}
                onClick={() => editor.toggleLock([id as TLShapeId])}
              >
                {row.shape.isLocked ? <LockGlyph className="w-3 h-3" /> : <UnlockGlyph className="w-3 h-3" />}
              </RowButton>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RowButton({
  label,
  shown,
  onClick,
  children
}: {
  label: string
  shown: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={`w-5 h-5 shrink-0 rounded-full grid place-items-center text-fg-muted transition-opacity hover:text-fg ${
          shown ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}
