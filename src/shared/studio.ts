import type { Attachment } from './attachments'

export type StudioNodeType = 'frame' | 'group' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'image' | 'svg' | 'icon'

export interface StudioConstraints {
  horizontal: 'left' | 'right' | 'center' | 'stretch' | 'scale'
  vertical: 'top' | 'bottom' | 'center' | 'stretch' | 'scale'
}

export interface StudioShadow {
  x: number
  y: number
  blur: number
  color: string
}

export interface StudioNode {
  id: string
  type: StudioNodeType
  name?: string
  parentId?: string | null
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  opacity?: number
  hidden?: boolean
  locked?: boolean
  fill?: string | null
  fill2?: string | null
  gradientAngle?: number
  stroke?: string | null
  strokeWidth?: number
  radius?: number
  shadow?: StudioShadow | null
  blur?: number
  text?: string
  fontSize?: number
  fontWeight?: number
  font?: 'sans' | 'mono'
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  flip?: boolean
  src?: string | null
  layout?: 'none' | 'row' | 'column'
  gap?: number
  padding?: number
  clip?: boolean
  constraints?: StudioConstraints
  componentId?: string | null
  componentProps?: Record<string, string>
}

export interface StudioPage {
  id: string
  name: string
  order: string[]
}

export interface StudioChatEntry {
  id: string
  ts: number
  kind: 'user' | 'agent' | 'system'
  authorId: string
  authorName: string
  text: string
  mentions?: string[]
  opsApplied?: number
  build?: boolean
  attachments?: Attachment[]
}

export interface StudioAsset {
  id: string
  name: string
  rootId: string
  nodes: StudioNode[]
}

export interface StudioDoc {
  id: string
  name: string
  rev: number
  pages: StudioPage[]
  nodes: Record<string, StudioNode>
  assets: StudioAsset[]
  chat: StudioChatEntry[]
  agents: string[]
  variables: Record<string, string>
  favorite: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface StudioMeta {
  id: string
  name: string
  favorite: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
  pageCount: number
  nodeCount: number
  agents: string[]
  preview: StudioPreviewNode[]
}

export interface StudioPreviewNode {
  type: StudioNodeType
  x: number
  y: number
  w: number
  h: number
  fill: string | null
  radius: number
}

export interface StudioPresence {
  clientId: string
  memberId: string
  name: string
  pageId: string
  cursor: { x: number; y: number } | null
  selection: string[]
}

export const STUDIO_CHAT_LIMIT = 500
export const STUDIO_NODE_LIMIT = 20000

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function isStudioId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id)
}

export function emptyStudioDoc(id: string, name: string, createdBy: string): StudioDoc {
  const now = Date.now()
  return {
    id,
    name,
    rev: 0,
    pages: [{ id: newId(), name: 'Page 1', order: [] }],
    nodes: {},
    assets: [],
    chat: [],
    agents: [],
    variables: {},
    favorite: false,
    createdBy,
    createdAt: now,
    updatedAt: now
  }
}

const NODE_TYPES = new Set<StudioNodeType>([
  'frame',
  'group',
  'rect',
  'ellipse',
  'line',
  'arrow',
  'text',
  'image',
  'svg',
  'icon'
])

function num(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100
}

function str(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.slice(0, limit)
}

function color(value: unknown): string | null | undefined {
  if (value === null) return null
  const s = str(value, 64)
  if (s === undefined) return undefined
  return /^#[0-9a-fA-F]{3,8}$/.test(s) || /^(rgb|hsl|oklch)a?\(/.test(s) ? s : undefined
}

function imageSrc(value: unknown): string | null | undefined {
  if (value === null) return null
  const s = str(value, 4_000_000)
  if (s === undefined) return undefined
  if (s.startsWith('data:image/')) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s.slice(0, 2048)
  return undefined
}

export function sanitizeShadow(value: unknown): StudioShadow | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  return {
    x: num(raw.x, -500, 500, 0),
    y: num(raw.y, -500, 500, 4),
    blur: num(raw.blur, 0, 500, 16),
    color: color(raw.color) ?? 'rgba(0,0,0,0.4)'
  }
}

export function sanitizeNode(value: unknown): StudioNode | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (!isStudioId(raw.id)) return null
  if (typeof raw.type !== 'string' || !NODE_TYPES.has(raw.type as StudioNodeType)) return null
  const node: StudioNode = {
    id: raw.id,
    type: raw.type as StudioNodeType,
    x: num(raw.x, -1_000_000, 1_000_000, 0),
    y: num(raw.y, -1_000_000, 1_000_000, 0),
    w: num(raw.w, 0, 1_000_000, 100),
    h: num(raw.h, 0, 1_000_000, 100)
  }
  const patch = sanitizePatch(raw)
  delete patch.x
  delete patch.y
  delete patch.w
  delete patch.h
  return { ...node, ...patch, id: node.id, type: node.type }
}

export function sanitizePatch(raw: Record<string, unknown>): Partial<StudioNode> {
  const patch: Partial<StudioNode> = {}
  if ('x' in raw) patch.x = num(raw.x, -1_000_000, 1_000_000, 0)
  if ('y' in raw) patch.y = num(raw.y, -1_000_000, 1_000_000, 0)
  if ('w' in raw) patch.w = num(raw.w, 0, 1_000_000, 100)
  if ('h' in raw) patch.h = num(raw.h, 0, 1_000_000, 100)
  if ('name' in raw) patch.name = str(raw.name, 80)
  if ('parentId' in raw) patch.parentId = raw.parentId === null ? null : isStudioId(raw.parentId) ? raw.parentId : null
  if ('rotation' in raw) patch.rotation = num(raw.rotation, -3600, 3600, 0) % 360
  if ('opacity' in raw) patch.opacity = num(raw.opacity, 0, 1, 1)
  if ('hidden' in raw) patch.hidden = raw.hidden === true
  if ('locked' in raw) patch.locked = raw.locked === true
  if ('fill' in raw) patch.fill = color(raw.fill) ?? null
  if ('fill2' in raw) patch.fill2 = color(raw.fill2) ?? null
  if ('gradientAngle' in raw) patch.gradientAngle = num(raw.gradientAngle, 0, 360, 180)
  if ('stroke' in raw) patch.stroke = color(raw.stroke) ?? null
  if ('strokeWidth' in raw) patch.strokeWidth = num(raw.strokeWidth, 0, 200, 1)
  if ('radius' in raw) patch.radius = num(raw.radius, 0, 1000, 0)
  if ('shadow' in raw) patch.shadow = raw.shadow === null ? null : sanitizeShadow(raw.shadow)
  if ('blur' in raw) patch.blur = num(raw.blur, 0, 200, 0)
  if ('text' in raw) patch.text = str(raw.text, 10000) ?? ''
  if ('fontSize' in raw) patch.fontSize = num(raw.fontSize, 1, 512, 16)
  if ('fontWeight' in raw) patch.fontWeight = num(raw.fontWeight, 100, 900, 400)
  if ('font' in raw) patch.font = raw.font === 'mono' ? 'mono' : 'sans'
  if ('align' in raw) patch.align = raw.align === 'center' || raw.align === 'right' ? raw.align : 'left'
  if ('lineHeight' in raw) patch.lineHeight = num(raw.lineHeight, 0.5, 4, 1.3)
  if ('letterSpacing' in raw) patch.letterSpacing = num(raw.letterSpacing, -10, 100, 0)
  if ('flip' in raw) patch.flip = raw.flip === true
  if ('src' in raw) patch.src = imageSrc(raw.src) ?? null
  if ('layout' in raw) patch.layout = raw.layout === 'row' || raw.layout === 'column' ? raw.layout : 'none'
  if ('gap' in raw) patch.gap = num(raw.gap, 0, 1000, 0)
  if ('padding' in raw) patch.padding = num(raw.padding, 0, 1000, 0)
  if ('clip' in raw) patch.clip = raw.clip === true
  if ('constraints' in raw && typeof raw.constraints === 'object' && raw.constraints !== null) {
    const value = raw.constraints as Record<string, unknown>
    const horizontal = ['left', 'right', 'center', 'stretch', 'scale'].includes(String(value.horizontal))
      ? (value.horizontal as StudioConstraints['horizontal'])
      : 'left'
    const vertical = ['top', 'bottom', 'center', 'stretch', 'scale'].includes(String(value.vertical))
      ? (value.vertical as StudioConstraints['vertical'])
      : 'top'
    patch.constraints = { horizontal, vertical }
  }
  if ('componentId' in raw) patch.componentId = raw.componentId === null ? null : isStudioId(raw.componentId) ? raw.componentId : null
  if ('componentProps' in raw && typeof raw.componentProps === 'object' && raw.componentProps !== null) {
    patch.componentProps = Object.fromEntries(
      Object.entries(raw.componentProps as Record<string, unknown>)
        .filter(([key, value]) => key.length <= 40 && typeof value === 'string')
        .slice(0, 40)
        .map(([key, value]) => [key, (value as string).slice(0, 500)])
    )
  }
  return patch
}

export function isContainer(node: StudioNode): boolean {
  return node.type === 'frame' || node.type === 'group'
}

export function pageOf(doc: StudioDoc, nodeId: string): StudioPage | undefined {
  return doc.pages.find(p => p.order.includes(nodeId))
}

export function childrenOf(doc: StudioDoc, page: StudioPage, parentId: string | null): StudioNode[] {
  const out: StudioNode[] = []
  for (const id of page.order) {
    const node = doc.nodes[id]
    if (node && (node.parentId ?? null) === parentId) out.push(node)
  }
  return out
}

export function descendantsOf(doc: StudioDoc, ids: string[]): Set<string> {
  const all = new Set(ids.filter(id => doc.nodes[id]))
  let grew = true
  while (grew) {
    grew = false
    for (const node of Object.values(doc.nodes)) {
      const parent = node.parentId ?? null
      if (parent && all.has(parent) && !all.has(node.id)) {
        all.add(node.id)
        grew = true
      }
    }
  }
  return all
}

export function absoluteOrigin(doc: StudioDoc, node: StudioNode): { x: number; y: number } {
  let x = node.x
  let y = node.y
  let parentId = node.parentId ?? null
  let hops = 0
  while (parentId && hops < 200) {
    const parent = doc.nodes[parentId]
    if (!parent) break
    x += parent.x
    y += parent.y
    parentId = parent.parentId ?? null
    hops++
  }
  return { x, y }
}

export function rootAncestor(doc: StudioDoc, id: string): string {
  let current = id
  let hops = 0
  while (hops < 200) {
    const node = doc.nodes[current]
    const parent = node?.parentId ?? null
    if (!parent || !doc.nodes[parent]) return current
    current = parent
    hops++
  }
  return current
}
