import {
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  CloudIcon,
  CursorArrowRaysIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { absoluteOrigin, descendantsOf, type StudioNode, type StudioNodeType } from '../../../../shared/studio'
import { invertOps, type StudioOp } from '../../../../shared/studio-ops'
import { useCrew } from '../../state/store'
import StudioCanvas from './StudioCanvas'
import StudioChat from './StudioChat'
import { StudioInspector, StudioSidebar } from './StudioPanels'

export type StudioTool = 'select' | StudioNodeType

const TOOLS: Array<{ id: StudioTool; label: string; glyph: string }> = [
  { id: 'select', label: 'Select (V)', glyph: '↖' },
  { id: 'frame', label: 'Frame (F)', glyph: '⌗' },
  { id: 'rect', label: 'Rectangle (R)', glyph: '□' },
  { id: 'ellipse', label: 'Ellipse (O)', glyph: '○' },
  { id: 'line', label: 'Line (L)', glyph: '╱' },
  { id: 'arrow', label: 'Arrow (A)', glyph: '→' },
  { id: 'text', label: 'Text (T)', glyph: 'T' },
  { id: 'image', label: 'Image', glyph: '▧' },
  { id: 'icon', label: 'Icon', glyph: '✦' }
]

export default function StudioEditor() {
  const doc = useCrew(s => s.studioDoc)!
  const agents = useCrew(s => s.agents)
  const presence = useCrew(s => s.studioPresence)
  const closeStudio = useCrew(s => s.closeStudio)
  const renameStudio = useCrew(s => s.renameStudio)
  const applyStudioOps = useCrew(s => s.applyStudioOps)
  const updatePresence = useCrew(s => s.updateStudioPresence)
  const [pageId, setPageId] = useState(doc.pages[0]?.id ?? '')
  const [selection, setSelection] = useState<string[]>([])
  const [tool, setTool] = useState<StudioTool>('select')
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 340, y: 170 })
  const [chatOpen, setChatOpen] = useState(true)
  const [grid, setGrid] = useState(true)
  const undoStack = useRef<StudioOp[][]>([])
  const redoStack = useRef<StudioOp[][]>([])
  const clipboard = useRef<StudioNode[]>([])
  const pasteCount = useRef(0)

  const page = doc.pages.find(item => item.id === pageId) ?? doc.pages[0]
  useEffect(() => {
    if (!page && doc.pages[0]) setPageId(doc.pages[0].id)
  }, [page, doc.pages])

  const commit = useCallback((ops: StudioOp[], remember = true) => {
    const current = useCrew.getState().studioDoc
    if (!current || ops.length === 0) return
    if (remember) {
      const inverse = invertOps(current, ops)
      if (inverse.length > 0) {
        undoStack.current.push(inverse)
        if (undoStack.current.length > 100) undoStack.current.shift()
        redoStack.current = []
      }
    }
    applyStudioOps(ops)
  }, [applyStudioOps])

  const undo = useCallback(() => {
    const ops = undoStack.current.pop()
    const current = useCrew.getState().studioDoc
    if (!ops || !current) return
    const redo = invertOps(current, ops)
    if (redo.length > 0) redoStack.current.push(redo)
    applyStudioOps(ops)
  }, [applyStudioOps])

  const redo = useCallback(() => {
    const ops = redoStack.current.pop()
    const current = useCrew.getState().studioDoc
    if (!ops || !current) return
    const inverse = invertOps(current, ops)
    if (inverse.length > 0) undoStack.current.push(inverse)
    applyStudioOps(ops)
  }, [applyStudioOps])

  const selectedNodes = useMemo(() => selection.map(id => doc.nodes[id]).filter((node): node is StudioNode => Boolean(node)), [selection, doc.nodes])
  const assigned = agents.filter(agent => doc.agents.includes(agent.id))

  useEffect(() => {
    updatePresence(page?.id ?? '', null, selection)
  }, [selection, page?.id, updatePresence])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      if (mod && event.key.toLowerCase() === 'c' && selection.length) {
        event.preventDefault()
        const ids = descendantsOf(doc, selection)
        clipboard.current = [...ids].map(id => doc.nodes[id]).filter((item): item is StudioNode => Boolean(item)).map(item => structuredClone(item))
        pasteCount.current = 0
        return
      }
      if (mod && event.key.toLowerCase() === 'v' && clipboard.current.length) {
        event.preventDefault(); pasteCount.current += 1
        const ids = new Map(clipboard.current.map(item => [item.id, crypto.randomUUID()]))
        const offset = 24 * pasteCount.current
        const copies = clipboard.current.map(item => ({ ...structuredClone(item), id: ids.get(item.id)!, parentId: item.parentId && ids.has(item.parentId) ? ids.get(item.parentId)! : item.parentId, x: item.x + (item.parentId && ids.has(item.parentId) ? 0 : offset), y: item.y + (item.parentId && ids.has(item.parentId) ? 0 : offset), name: `${item.name ?? item.type} copy` }))
        commit([{ kind: 'upsert', nodes: copies, pageId: page.id }]); setSelection(copies.filter(item => !item.parentId || !ids.has(item.parentId)).map(item => item.id))
        return
      }
      if (mod && event.key.toLowerCase() === 'g' && selection.length) {
        event.preventDefault()
        if (event.shiftKey && selection.length === 1 && doc.nodes[selection[0]]?.type === 'group') {
          const group = doc.nodes[selection[0]]
          const children = Object.values(doc.nodes).filter(item => item.parentId === group.id)
          const ops: StudioOp[] = children.map(item => ({ kind: 'update', id: item.id, patch: { parentId: group.parentId ?? null, x: item.x + group.x, y: item.y + group.y } }))
          ops.push({ kind: 'remove', ids: [group.id] }); commit(ops); setSelection(children.map(item => item.id)); return
        }
        if (selection.length > 1) {
          const picked = selection.map(id => doc.nodes[id]).filter((item): item is StudioNode => Boolean(item))
          const origins = picked.map(item => ({ item, ...absoluteOrigin(doc, item) }))
          const minX = Math.min(...origins.map(item => item.x)); const minY = Math.min(...origins.map(item => item.y))
          const maxX = Math.max(...origins.map(item => item.x + item.item.w)); const maxY = Math.max(...origins.map(item => item.y + item.item.h))
          const group: StudioNode = { id: crypto.randomUUID(), type: 'group', name: 'Group', x: minX, y: minY, w: maxX - minX, h: maxY - minY, fill: null }
          commit([{ kind: 'upsert', nodes: [group], pageId: page.id }, ...origins.map(({ item, x, y }) => ({ kind: 'update' as const, id: item.id, patch: { parentId: group.id, x: x - minX, y: y - minY } }))]); setSelection([group.id]); return
        }
      }
      const keyTools: Record<string, StudioTool> = { v: 'select', f: 'frame', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', t: 'text' }
      if (!mod && keyTools[event.key.toLowerCase()]) setTool(keyTools[event.key.toLowerCase()])
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection.length) {
        event.preventDefault(); commit([{ kind: 'remove', ids: selection }]); setSelection([])
      }
      if (mod && event.key.toLowerCase() === 'd' && selectedNodes.length) {
        event.preventDefault()
        const map = new Map(selectedNodes.map(node => [node.id, crypto.randomUUID()]))
        const copies = selectedNodes.map(node => ({ ...node, id: map.get(node.id)!, parentId: node.parentId && map.get(node.parentId) ? map.get(node.parentId)! : node.parentId, x: node.x + 24, y: node.y + 24, name: `${node.name ?? node.type} copy` }))
        commit([{ kind: 'upsert', nodes: copies, pageId: page.id }]); setSelection(copies.map(node => node.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, doc, page?.id, redo, selection, selectedNodes, undo])

  const rename = () => {
    const next = window.prompt('Rename Studio', doc.name)?.trim()
    if (next) renameStudio(doc.id, next)
  }

  return (
    <div className="studio-editor h-full pt-[70px]">
      <header className="studio-editor-bar">
        <div className="studio-editor-file">
          <button onClick={closeStudio} className="studio-icon-button" aria-label="Back to Studio"><ArrowLeftIcon /></button>
          <button onDoubleClick={rename} onClick={rename} className="studio-file-name"><strong>{doc.name}</strong><small><CloudIcon /> Saved automatically</small></button>
        </div>
        <div className="studio-toolbar" role="toolbar">
          {TOOLS.map(item => <button key={item.id} title={item.label} className={tool === item.id ? 'active' : ''} onClick={() => setTool(item.id)}><span>{item.glyph}</span></button>)}
        </div>
        <div className="studio-editor-actions">
          <div className="studio-collaborators">
            {presence.slice(0, 3).map(peer => <span key={peer.clientId} title={peer.name} style={{ '--avatar-hue': hue(peer.name) } as React.CSSProperties}>{peer.name.slice(0, 1).toUpperCase()}</span>)}
            {assigned.slice(0, 3).map(agent => <span key={agent.id} title={agent.label} className="agent-avatar"><SparklesIcon /></span>)}
          </div>
          <button onClick={() => setChatOpen(value => !value)} className={`studio-chat-toggle ${chatOpen ? 'active' : ''}`}><ChatBubbleBottomCenterTextIcon /><span>Agents</span></button>
        </div>
      </header>

      <div className="studio-workspace">
        <StudioSidebar pageId={page.id} setPageId={setPageId} selection={selection} setSelection={setSelection} commit={commit} />
        <main className="studio-canvas-wrap">
          <StudioCanvas page={page} selection={selection} setSelection={setSelection} tool={tool} setTool={setTool} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} grid={grid} commit={commit} />
          <div className="studio-view-controls">
            <button onClick={undo} title="Undo"><ArrowUturnLeftIcon /></button>
            <button onClick={redo} title="Redo"><ArrowUturnRightIcon /></button>
            <i />
            <button onClick={() => setZoom(value => Math.max(.1, value - .1))}><MinusIcon /></button>
            <button className="zoom-label" onClick={() => { setZoom(.8); setPan({ x: 340, y: 170 }) }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(value => Math.min(4, value + .1))}><PlusIcon /></button>
            <i />
            <button className={grid ? 'active' : ''} onClick={() => setGrid(value => !value)}>Grid</button>
          </div>
        </main>
        <StudioInspector nodes={selectedNodes} commit={commit} />
      </div>
      {chatOpen && <StudioChat pageId={page.id} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

function hue(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}
