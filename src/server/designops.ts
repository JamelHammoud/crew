import { randomBytes } from 'node:crypto'
import {
  DESIGN_COLORS,
  plainTextOf,
  richTextOf,
  type DesignDocument,
  type DesignOp,
  type DesignOpResult,
  type DesignShapeKind
} from '../shared/design'

const GEO_KINDS = new Set([
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'star',
  'cloud',
  'hexagon',
  'oval',
  'x-box',
  'check-box'
])

const FILLS = new Set(['none', 'semi', 'solid', 'pattern'])
const COLORS = new Set<string>(DESIGN_COLORS)
const INDEX_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

interface ShapeRecord {
  id: string
  typeName: 'shape'
  type: string
  x: number
  y: number
  rotation: number
  index: string
  parentId: string
  isLocked: boolean
  opacity: number
  meta: Record<string, never>
  props: Record<string, unknown>
}

export interface AppliedOps {
  put: ShapeRecord[]
  remove: string[]
  results: DesignOpResult[]
  cursors: Array<{ x: number; y: number }>
}

export function newShapeId(): string {
  return `shape:${randomBytes(8).toString('hex')}`
}

// Fractional index keys sort as plain strings. Bumping the last digit (or
// appending when it is already the largest) always yields a valid key that
// sorts above everything present, which is all stacking order needs here.
export function indexAbove(top: string | null): string {
  if (!top) return 'a1'
  const last = top[top.length - 1]
  const at = INDEX_DIGITS.indexOf(last)
  if (at === -1 || last === 'z') return `${top}1`
  return top.slice(0, -1) + INDEX_DIGITS[at + 1]
}

function pageIdOf(document: DesignDocument): string | null {
  for (const [id] of Object.entries(document.store)) {
    if (id.startsWith('page:')) return id
  }
  return null
}

function topIndexOn(document: DesignDocument, parentId: string): string | null {
  let top: string | null = null
  for (const record of Object.values(document.store)) {
    const shape = record as Partial<ShapeRecord>
    if (shape.typeName !== 'shape' || shape.parentId !== parentId) continue
    if (typeof shape.index === 'string' && (top === null || shape.index > top)) top = shape.index
  }
  return top
}

function baseProps(color: string, fill: string, text: string): Record<string, unknown> {
  return {
    dash: 'draw',
    url: '',
    growY: 0,
    scale: 1,
    labelColor: 'black',
    color,
    fill,
    size: 'm',
    font: 'draw',
    align: 'middle',
    verticalAlign: 'middle',
    richText: richTextOf(text)
  }
}

function propsFor(kind: DesignShapeKind, op: Extract<DesignOp, { op: 'create' }>): Record<string, unknown> {
  const color = op.color && COLORS.has(op.color) ? op.color : 'black'
  const fill = op.fill && FILLS.has(op.fill) ? op.fill : 'none'
  const text = op.text ?? ''
  const w = op.w && op.w > 0 ? op.w : 200
  const h = op.h && op.h > 0 ? op.h : kind === 'frame' ? 200 : 120
  if (GEO_KINDS.has(kind)) return { ...baseProps(color, fill, text), geo: kind, w, h }
  switch (kind) {
    case 'text':
      return {
        color,
        size: 'm',
        font: 'draw',
        textAlign: 'start',
        w: op.w && op.w > 0 ? op.w : 300,
        richText: richTextOf(text),
        scale: 1,
        autoSize: op.w === undefined
      }
    case 'note':
      return {
        color: op.color && COLORS.has(op.color) ? op.color : 'yellow',
        labelColor: 'black',
        size: 'm',
        font: 'draw',
        fontSizeAdjustment: null,
        align: 'middle',
        verticalAlign: 'middle',
        growY: 0,
        url: '',
        richText: richTextOf(text),
        scale: 1,
        textLastEditedBy: null
      }
    case 'frame':
      return { w, h, name: op.name ?? op.text ?? 'Frame', color: 'black' }
    case 'arrow':
      return {
        kind: 'arc',
        labelColor: 'black',
        color,
        fill,
        dash: 'draw',
        size: 'm',
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        font: 'draw',
        start: { x: 0, y: 0 },
        end: { x: (op.endX ?? op.x + 200) - op.x, y: (op.endY ?? op.y) - op.y },
        bend: 0,
        richText: richTextOf(text),
        labelPosition: 0.5,
        scale: 1,
        elbowMidPoint: 0.5
      }
    case 'line':
      return {
        color,
        dash: 'draw',
        size: 'm',
        spline: 'line',
        points: {
          a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
          a2: { id: 'a2', index: 'a2', x: (op.endX ?? op.x + 200) - op.x, y: (op.endY ?? op.y) - op.y }
        },
        scale: 1
      }
    default:
      return {}
  }
}

const SHAPE_TYPE: Record<string, string> = {
  text: 'text',
  note: 'note',
  frame: 'frame',
  arrow: 'arrow',
  line: 'line'
}

function typeFor(kind: DesignShapeKind): string | null {
  if (GEO_KINDS.has(kind)) return 'geo'
  return SHAPE_TYPE[kind] ?? null
}

function shapeAt(document: DesignDocument, id: string): ShapeRecord | null {
  const record = document.store[id] as ShapeRecord | undefined
  return record && record.typeName === 'shape' ? record : null
}

function childrenOf(document: DesignDocument, id: string): string[] {
  const out: string[] = []
  for (const [recordId, record] of Object.entries(document.store)) {
    const shape = record as Partial<ShapeRecord>
    if (shape.typeName === 'shape' && shape.parentId === id) {
      out.push(recordId, ...childrenOf(document, recordId))
    }
  }
  return out
}

function applyCreate(document: DesignDocument, op: Extract<DesignOp, { op: 'create' }>, applied: AppliedOps): void {
  const type = typeFor(op.kind)
  if (!type) {
    applied.results.push({ error: `Unknown shape kind: ${String(op.kind)}` })
    return
  }
  if (typeof op.x !== 'number' || typeof op.y !== 'number' || !isFinite(op.x) || !isFinite(op.y)) {
    applied.results.push({ error: 'x and y must be numbers' })
    return
  }
  const parentId = op.parent && shapeAt(document, op.parent)?.type === 'frame' ? op.parent : pageIdOf(document)
  if (!parentId) {
    applied.results.push({ error: 'Board has no page yet. Open it in the app first.' })
    return
  }
  const record: ShapeRecord = {
    id: newShapeId(),
    typeName: 'shape',
    type,
    x: op.x,
    y: op.y,
    rotation: 0,
    index: indexAbove(topIndexOn(document, parentId)),
    parentId,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: propsFor(op.kind, op)
  }
  document.store[record.id] = record
  applied.put.push(record)
  applied.results.push({ id: record.id })
  applied.cursors.push({ x: op.x, y: op.y })
}

function applyUpdate(document: DesignDocument, op: Extract<DesignOp, { op: 'update' }>, applied: AppliedOps): void {
  const shape = shapeAt(document, op.id)
  if (!shape) {
    applied.results.push({ error: `No shape ${op.id}` })
    return
  }
  const next: ShapeRecord = { ...shape, props: { ...shape.props } }
  if (typeof op.x === 'number' && isFinite(op.x)) next.x = op.x
  if (typeof op.y === 'number' && isFinite(op.y)) next.y = op.y
  if (typeof op.w === 'number' && op.w > 0 && 'w' in next.props) next.props.w = op.w
  if (typeof op.h === 'number' && op.h > 0 && 'h' in next.props) next.props.h = op.h
  if (typeof op.text === 'string' && 'richText' in next.props) next.props.richText = richTextOf(op.text)
  if (op.color && COLORS.has(op.color) && 'color' in next.props) next.props.color = op.color
  if (op.fill && FILLS.has(op.fill) && 'fill' in next.props) next.props.fill = op.fill
  if (typeof op.name === 'string' && shape.type === 'frame') next.props.name = op.name
  document.store[op.id] = next
  applied.put.push(next)
  applied.results.push({ id: op.id })
  applied.cursors.push({ x: next.x, y: next.y })
}

function applyDelete(document: DesignDocument, op: Extract<DesignOp, { op: 'delete' }>, applied: AppliedOps): void {
  const shape = shapeAt(document, op.id)
  if (!shape) {
    applied.results.push({ error: `No shape ${op.id}` })
    return
  }
  applied.cursors.push({ x: shape.x, y: shape.y })
  for (const id of [op.id, ...childrenOf(document, op.id)]) {
    delete document.store[id]
    applied.remove.push(id)
  }
  applied.results.push({ id: op.id })
}

export function applyDesignOps(document: DesignDocument, ops: DesignOp[]): AppliedOps {
  const applied: AppliedOps = { put: [], remove: [], results: [], cursors: [] }
  for (const op of ops) {
    if (!op || typeof op !== 'object') {
      applied.results.push({ error: 'Not an op' })
      continue
    }
    if (op.op === 'create') applyCreate(document, op, applied)
    else if (op.op === 'update') applyUpdate(document, op, applied)
    else if (op.op === 'delete') applyDelete(document, op, applied)
    else if (op.op === 'point' && typeof op.x === 'number' && typeof op.y === 'number') {
      applied.results.push({})
      applied.cursors.push({ x: op.x, y: op.y })
    } else applied.results.push({ error: `Unknown op: ${String((op as { op?: unknown }).op)}` })
  }
  return applied
}

export function boardSummary(id: string, name: string, document: DesignDocument | null): unknown {
  const shapes: unknown[] = []
  if (document) {
    for (const record of Object.values(document.store)) {
      const shape = record as Partial<ShapeRecord>
      if (shape.typeName !== 'shape') continue
      const props = (shape.props ?? {}) as Record<string, unknown>
      shapes.push({
        id: shape.id,
        kind: shape.type === 'geo' ? props.geo : shape.type,
        x: shape.x,
        y: shape.y,
        w: props.w,
        h: props.h,
        text:
          shape.type === 'frame'
            ? props.name
            : 'richText' in props
              ? plainTextOf(props.richText)
              : undefined,
        color: props.color,
        fill: props.fill,
        parentId: shape.parentId?.startsWith('shape:') ? shape.parentId : undefined
      })
    }
  }
  return { id, name, shapes }
}
