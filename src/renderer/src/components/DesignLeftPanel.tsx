import {
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/16/solid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, useValue, type Editor, type TLPageId, type TLShape, type TLShapeId } from 'tldraw'
import { CanvasGlyph, canRename, renameShape } from '../design/tools'
import Pill from './Pill'
import Tooltip from './Tooltip'

type PanelTab = 'pages' | 'layers' | 'assets'

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'pages', label: 'Pages' },
  { id: 'layers', label: 'Layers' },
  { id: 'assets', label: 'Assets' }
]

export default function DesignLeftPanel() {
  const editor = useEditor()
  const [tab, setTab] = useState<PanelTab>('layers')
  return (
    <aside
      aria-label="Design panel"
      className="w-60 shrink-0 flex flex-col min-h-0 bg-ink-900 border-r border-ink-700"
    >
      <div className="flex gap-1 p-2 shrink-0">
        {TABS.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`flex-1 h-7 rounded-full text-xs font-semibold transition-colors ${
              tab === item.id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'pages' && <Pages editor={editor} />}
      {tab === 'layers' && <Layers editor={editor} />}
      {tab === 'assets' && <Assets editor={editor} />}
    </aside>
  )
}

function Pages({ editor }: { editor: Editor }) {
  const pages = useValue('design pages', () => editor.getPages(), [editor])
  const currentId = useValue('design page', () => editor.getCurrentPageId(), [editor])
  const [renaming, setRenaming] = useState<string | null>(null)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {pages.map(page => (
          <div key={page.id} className="group flex items-center gap-0.5 pr-1 rounded-lg hover:bg-fg/[0.06]">
            {renaming === page.id ? (
              <input
                autoFocus
                defaultValue={page.name}
                onBlur={event => {
                  const name = event.target.value.trim()
                  if (name) editor.renamePage(page.id, name)
                  setRenaming(null)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(null)
                }}
                className="flex-1 min-w-0 h-7 bg-transparent px-2 text-sm text-fg outline-none"
              />
            ) : (
              <button
                onClick={() => editor.setCurrentPage(page.id)}
                onDoubleClick={() => setRenaming(page.id)}
                className={`flex-1 min-w-0 h-7 px-2 text-sm text-left truncate ${
                  page.id === currentId ? 'text-fg font-semibold' : 'text-fg-secondary'
                }`}
              >
                {page.name}
              </button>
            )}
            {pages.length > 1 && (
              <button
                onClick={() => editor.deletePage(page.id as TLPageId)}
                aria-label={`Delete ${page.name}`}
                className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger hover:bg-danger/10"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          editor.createPage({ name: `Page ${editor.getPages().length + 1}` })
          const pages = editor.getPages()
          editor.setCurrentPage(pages[pages.length - 1].id)
        }}
        className="m-2 h-8 rounded-full flex items-center justify-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg hover:bg-fg/[0.06]"
      >
        <PlusIcon className="w-4 h-4" />
        New page
      </button>
    </div>
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

function layerName(shape: TLShape): string {
  const props = shape.props as Record<string, unknown>
  const name = typeof props.name === 'string' ? props.name.trim() : ''
  if (name) return name
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim().slice(0, 40)
  if (shape.type === 'geo' && typeof props.geo === 'string') return props.geo
  return shape.type
}

function layerGlyph(shape: TLShape): string {
  const props = shape.props as Record<string, unknown>
  if (shape.type === 'geo' && typeof props.geo === 'string') return `geo-${props.geo}`
  if (shape.type === 'design-node') return 'geo-rectangle'
  if (shape.type === 'frame') return 'tool-frame'
  if (shape.type === 'draw') return 'tool-pencil'
  return `tool-${shape.type}`
}

function Layers({ editor }: { editor: Editor }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const shapes = useValue('design shapes', () => editor.getCurrentPageShapesSorted(), [editor])
  const selected = useValue('design selection', () => editor.getSelectedShapeIds(), [editor])
  const selectedSet = useMemo(() => new Set<string>(selected), [selected])
  const listRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const all = buildRows(shapes, collapsed)
    const clean = query.trim().toLowerCase()
    if (!clean) return all
    return buildRows(shapes, new Set()).filter(row => layerName(row.shape).toLowerCase().includes(clean))
  }, [shapes, collapsed, query])

  useEffect(() => {
    const first = selected[0]
    if (!first) return
    listRef.current?.querySelector(`[data-shape="${first}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <label className="mx-2 mb-2 h-7 shrink-0 flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-2.5 focus-within:bg-fg/[0.1] transition-colors">
        <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Find a layer"
          className="w-full min-w-0 bg-transparent text-xs text-fg placeholder:text-fg-muted outline-none"
        />
      </label>
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {rows.length === 0 && (
          <p className="px-2 py-6 text-xs text-fg-muted text-center">
            {query ? 'Nothing matches that.' : 'Draw something and it shows up here.'}
          </p>
        )}
        {rows.map(row => {
          const id = row.shape.id
          const hidden = row.shape.meta.hidden === true
          const active = selectedSet.has(id)
          return (
            <div
              key={id}
              data-shape={id}
              className={`group h-7 flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                active ? 'bg-fg/[0.1]' : 'hover:bg-fg/[0.06]'
              }`}
              style={{ paddingLeft: 4 + row.depth * 12 }}
            >
              {row.children > 0 && !query ? (
                <button
                  onClick={() => toggle(id)}
                  aria-label={collapsed.has(id) ? 'Expand' : 'Collapse'}
                  className="w-4 h-4 shrink-0 grid place-items-center text-fg-muted hover:text-fg"
                >
                  <ChevronRightIcon
                    className={`w-3 h-3 transition-transform ${collapsed.has(id) ? '' : 'rotate-90'}`}
                  />
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <CanvasGlyph
                name={layerGlyph(row.shape)}
                className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-fg' : 'text-fg-muted'}`}
              />
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
                  onDoubleClick={() => setRenaming(id)}
                  className={`flex-1 min-w-0 text-xs text-left truncate ${
                    hidden ? 'text-fg-faint' : active ? 'text-fg font-semibold' : 'text-fg-secondary'
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
                {hidden ? <EyeSlashIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
              </RowButton>
              <RowButton
                label={row.shape.isLocked ? 'Unlock' : 'Lock'}
                shown={row.shape.isLocked}
                onClick={() => editor.toggleLock([id as TLShapeId])}
              >
                {row.shape.isLocked ? <LockClosedIcon className="w-3 h-3" /> : <LockOpenIcon className="w-3 h-3" />}
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

function Assets({ editor }: { editor: Editor }) {
  const components = useValue(
    'design components',
    () =>
      editor
        .getCurrentPageShapesSorted()
        .filter(shape => shape.type === 'design-node' && (shape.props as { component?: string }).component),
    [editor]
  )

  if (components.length === 0) {
    return (
      <p className="px-4 py-6 text-xs text-fg-muted text-center">
        Save a layer as a component and it collects here, ready to drop back on the canvas.
      </p>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
      {components.map(shape => (
        <button
          key={shape.id}
          onClick={() => editor.select(shape.id)}
          className="w-full h-7 flex items-center gap-2 px-2 rounded-lg text-xs text-left text-fg-secondary transition-colors hover:text-fg hover:bg-fg/[0.06]"
        >
          <CanvasGlyph name="geo-rectangle" className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
          <span className="flex-1 truncate">{(shape.props as { component: string }).component}</span>
        </button>
      ))}
    </div>
  )
}
