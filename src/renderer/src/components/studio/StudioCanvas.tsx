import { useMemo, useRef, useState } from 'react'
import { absoluteOrigin, type StudioNode, type StudioPage } from '../../../../shared/studio'
import type { StudioOp } from '../../../../shared/studio-ops'
import { useCrew } from '../../state/store'
import type { StudioTool } from './StudioEditor'

type Point = { x: number; y: number }
type Drag =
  | { kind: 'pan'; start: Point; pan: Point }
  | { kind: 'draw'; start: Point }
  | { kind: 'move'; start: Point; nodes: Array<{ id: string; x: number; y: number }> }
  | { kind: 'resize'; start: Point; node: { id: string; w: number; h: number } }
  | { kind: 'marquee'; start: Point }

const SNAP = 8
const snap = (value: number) => Math.round(value / SNAP) * SNAP

export default function StudioCanvas({ page, selection, setSelection, tool, setTool, zoom, setZoom, pan, setPan, grid, commit }: {
  page: StudioPage
  selection: string[]
  setSelection: (ids: string[]) => void
  tool: StudioTool
  setTool: (tool: StudioTool) => void
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  pan: Point
  setPan: React.Dispatch<React.SetStateAction<Point>>
  grid: boolean
  commit: (ops: StudioOp[], remember?: boolean) => void
}) {
  const doc = useCrew(s => s.studioDoc)!
  const presence = useCrew(s => s.studioPresence)
  const selfId = useCrew(s => s.selfId)
  const updatePresence = useCrew(s => s.updateStudioPresence)
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const presenceAt = useRef(0)
  const [draft, setDraft] = useState<StudioNode | null>(null)
  const [preview, setPreview] = useState<Record<string, Partial<StudioNode>>>({})
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})

  const nodes = useMemo(() => page.order.map(id => doc.nodes[id]).filter((node): node is StudioNode => Boolean(node) && !node.hidden), [page.order, doc.nodes])

  const world = (clientX: number, clientY: number): Point => {
    const rect = surface.current?.getBoundingClientRect()
    return { x: (clientX - (rect?.left ?? 0) - pan.x) / zoom, y: (clientY - (rect?.top ?? 0) - pan.y) / zoom }
  }

  const beginCanvas = (event: React.PointerEvent) => {
    if (event.button === 1 || event.altKey) {
      drag.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, pan }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    const at = world(event.clientX, event.clientY)
    if (tool === 'select') {
      if (!event.shiftKey) setSelection([])
      drag.current = { kind: 'marquee', start: at }
      setMarquee({ x: at.x, y: at.y, w: 0, h: 0 })
    } else if (tool === 'image' || tool === 'svg') {
      pickImage(tool)
      return
    } else {
      drag.current = { kind: 'draw', start: at }
      setDraft(defaultNode(tool, snap(at.x), snap(at.y)))
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const beginNode = (event: React.PointerEvent, node: StudioNode) => {
    if (tool !== 'select' || node.locked) return
    event.stopPropagation()
    const next = event.shiftKey
      ? selection.includes(node.id) ? selection.filter(id => id !== node.id) : [...selection, node.id]
      : selection.includes(node.id) ? selection : [node.id]
    setSelection(next)
    const at = world(event.clientX, event.clientY)
    drag.current = { kind: 'move', start: at, nodes: next.map(id => doc.nodes[id]).filter(Boolean).map(item => ({ id: item.id, x: item.x, y: item.y })) }
    surface.current?.setPointerCapture(event.pointerId)
  }

  const beginResize = (event: React.PointerEvent, node: StudioNode) => {
    event.stopPropagation()
    drag.current = { kind: 'resize', start: world(event.clientX, event.clientY), node: { id: node.id, w: node.w, h: node.h } }
    surface.current?.setPointerCapture(event.pointerId)
  }

  const move = (event: React.PointerEvent) => {
    const at = world(event.clientX, event.clientY)
    const now = Date.now()
    if (now - presenceAt.current > 45) {
      presenceAt.current = now
      updatePresence(page.id, at, selection)
    }
    const active = drag.current
    if (!active) return
    if (active.kind === 'pan') {
      setPan({ x: active.pan.x + event.clientX - active.start.x, y: active.pan.y + event.clientY - active.start.y })
      return
    }
    if (active.kind === 'draw') {
      const x = snap(Math.min(active.start.x, at.x)); const y = snap(Math.min(active.start.y, at.y))
      const w = Math.max(SNAP, snap(Math.abs(at.x - active.start.x))); const h = Math.max(SNAP, snap(Math.abs(at.y - active.start.y)))
      setDraft(current => current ? { ...current, x, y, w, h: current.type === 'line' || current.type === 'arrow' ? 2 : h } : current)
      setGuides({ x, y })
      return
    }
    if (active.kind === 'move') {
      const dx = snap(at.x - active.start.x); const dy = snap(at.y - active.start.y)
      const next: Record<string, Partial<StudioNode>> = {}
      for (const item of active.nodes) next[item.id] = { x: item.x + dx, y: item.y + dy }
      setPreview(next)
      const first = next[active.nodes[0]?.id]
      setGuides({ x: first?.x, y: first?.y })
      return
    }
    if (active.kind === 'resize') {
      setPreview({ [active.node.id]: { w: Math.max(SNAP, snap(active.node.w + at.x - active.start.x)), h: Math.max(SNAP, snap(active.node.h + at.y - active.start.y)) } })
      return
    }
    if (active.kind === 'marquee') {
      const box = { x: Math.min(active.start.x, at.x), y: Math.min(active.start.y, at.y), w: Math.abs(at.x - active.start.x), h: Math.abs(at.y - active.start.y) }
      setMarquee(box)
      const inside = nodes.filter(node => {
        const origin = absoluteOrigin(doc, node)
        return origin.x >= box.x && origin.y >= box.y && origin.x + node.w <= box.x + box.w && origin.y + node.h <= box.y + box.h
      }).map(node => node.id)
      setSelection(inside)
    }
  }

  const finish = () => {
    const active = drag.current
    drag.current = null
    setMarquee(null); setGuides({})
    if (!active) return
    if (active.kind === 'draw' && draft) {
      commit([{ kind: 'upsert', nodes: [draft], pageId: page.id }])
      setSelection([draft.id]); setDraft(null); setTool('select')
    } else if ((active.kind === 'move' || active.kind === 'resize') && Object.keys(preview).length) {
      commit(Object.entries(preview).map(([id, patch]) => ({ kind: 'update', id, patch })))
      setPreview({})
    }
  }

  const pickImage = (kind: 'image' | 'svg') => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = kind === 'svg' ? '.svg,image/svg+xml' : 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const node: StudioNode = { ...defaultNode(kind, snap((-pan.x + 320) / zoom), snap((-pan.y + 220) / zoom)), src: String(reader.result), w: 360, h: 240 }
        commit([{ kind: 'upsert', nodes: [node], pageId: page.id }]); setSelection([node.id]); setTool('select')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const wheel = (event: React.WheelEvent) => {
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      const rect = surface.current?.getBoundingClientRect(); if (!rect) return
      const old = zoom; const next = Math.min(4, Math.max(.1, old * Math.exp(-event.deltaY * .002)))
      const px = event.clientX - rect.left; const py = event.clientY - rect.top
      setPan({ x: px - ((px - pan.x) / old) * next, y: py - ((py - pan.y) / old) * next }); setZoom(next)
    } else setPan(value => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }))
  }

  const editText = (node: StudioNode) => {
    if (node.type !== 'text') return
    const text = window.prompt('Edit text', node.text ?? '')
    if (text !== null) commit([{ kind: 'update', id: node.id, patch: { text } }])
  }

  return (
    <div ref={surface} className={`studio-canvas ${tool !== 'select' ? 'drawing' : ''} ${grid ? 'has-grid' : ''}`} onPointerDown={beginCanvas} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onWheel={wheel}>
      <div className="studio-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {nodes.map(node => <CanvasNode key={node.id} node={{ ...node, ...preview[node.id] }} doc={doc} selected={selection.includes(node.id)} onPointerDown={event => beginNode(event, node)} onResize={event => beginResize(event, node)} onDoubleClick={() => editText(node)} />)}
        {draft && <CanvasNode node={draft} doc={doc} selected={false} draft />}
        {marquee && <div className="studio-marquee" style={marquee} />}
        {guides.x !== undefined && <i className="studio-guide vertical" style={{ left: guides.x }} />}
        {guides.y !== undefined && <i className="studio-guide horizontal" style={{ top: guides.y }} />}
        {presence.filter(peer => peer.memberId !== selfId && peer.pageId === page.id && peer.cursor).map(peer => <div key={peer.clientId} className="studio-remote-cursor" style={{ left: peer.cursor!.x, top: peer.cursor!.y, '--cursor-color': `hsl(${hue(peer.name)} 78% 62%)` } as React.CSSProperties}><svg viewBox="0 0 20 24"><path d="M2 2v17l5-4 3.2 6 3-1.6-3.1-5.9 6.7-.8Z" /></svg><span>{peer.name}</span></div>)}
      </div>
    </div>
  )
}

function CanvasNode({ node, doc, selected, draft, onPointerDown, onResize, onDoubleClick }: { node: StudioNode; doc: NonNullable<ReturnType<typeof useCrew.getState>['studioDoc']>; selected: boolean; draft?: boolean; onPointerDown?: (event: React.PointerEvent) => void; onResize?: (event: React.PointerEvent) => void; onDoubleClick?: () => void }) {
  const origin = absoluteOrigin(doc, node)
  const gradient = node.fill2 ? `linear-gradient(${node.gradientAngle ?? 180}deg, ${node.fill ?? 'transparent'}, ${node.fill2})` : node.fill ?? 'transparent'
  const style: React.CSSProperties = {
    left: origin.x, top: origin.y, width: node.w, height: node.h, opacity: node.opacity ?? 1,
    transform: `rotate(${node.rotation ?? 0}deg)`, background: gradient,
    border: node.stroke ? `${node.strokeWidth ?? 1}px solid ${node.stroke}` : undefined,
    borderRadius: node.type === 'ellipse' ? '50%' : node.radius,
    boxShadow: node.shadow ? `${node.shadow.x}px ${node.shadow.y}px ${node.shadow.blur}px ${node.shadow.color}` : undefined,
    filter: node.blur ? `blur(${node.blur}px)` : undefined,
    overflow: node.clip ? 'hidden' : 'visible'
  }
  if (node.type === 'line' || node.type === 'arrow') {
    style.height = Math.max(1, node.strokeWidth ?? 2); style.background = node.stroke ?? node.fill ?? '#fff'; style.transformOrigin = 'left center'
  }
  return <div className={`studio-node type-${node.type} ${selected ? 'selected' : ''} ${draft ? 'draft' : ''} ${node.locked ? 'locked' : ''}`} style={style} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
    {node.parentId === null || node.parentId === undefined ? node.type === 'frame' && <label>{node.name ?? 'Frame'}</label> : null}
    {node.type === 'text' && <div style={{ color: node.fill ?? '#fff', fontFamily: node.font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: node.fontSize ?? 16, fontWeight: node.fontWeight ?? 400, textAlign: node.align ?? 'left', lineHeight: node.lineHeight ?? 1.3, letterSpacing: node.letterSpacing ?? 0 }}>{node.text || 'Text'}</div>}
    {(node.type === 'image' || node.type === 'svg') && node.src && <img src={node.src} draggable={false} />}
    {node.type === 'icon' && <span className="studio-canvas-icon">✦</span>}
    {node.type === 'arrow' && <span className="studio-arrow-head" />}
    {selected && !node.locked && <><i className="studio-selection-outline" /><button className="studio-resize-handle" onPointerDown={onResize} aria-label="Resize" /></>}
  </div>
}

function defaultNode(type: Exclude<StudioTool, 'select'>, x: number, y: number): StudioNode {
  const base = { id: crypto.randomUUID(), type, name: type[0].toUpperCase() + type.slice(1), x, y, w: 160, h: 112, opacity: 1, radius: 12 }
  switch (type) {
    case 'frame': return { ...base, w: 560, h: 420, fill: '#ffffff', radius: 18 }
    case 'group': return { ...base, fill: null }
    case 'rect': return { ...base, fill: '#6d5dfc' }
    case 'ellipse': return { ...base, fill: '#35c5f0' }
    case 'line': case 'arrow': return { ...base, w: 180, h: 2, fill: '#e5e7eb', strokeWidth: 2, radius: 0 }
    case 'text': return { ...base, w: 240, h: 58, text: 'Type something', fontSize: 32, fontWeight: 600, fill: '#f8fafc', radius: 0 }
    case 'icon': return { ...base, w: 64, h: 64, fill: '#f8fafc', radius: 0 }
    case 'image': case 'svg': return { ...base, w: 320, h: 220, fill: '#27272a' }
  }
}

function hue(value: string): number { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360; return hash }
