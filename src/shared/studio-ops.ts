import {
  descendantsOf,
  isStudioId,
  pageOf,
  sanitizeNode,
  sanitizePatch,
  STUDIO_NODE_LIMIT,
  type StudioAsset,
  type StudioDoc,
  type StudioNode,
  type StudioPage
} from './studio'

export type StudioOp =
  | { kind: 'upsert'; nodes: StudioNode[]; pageId?: string }
  | { kind: 'update'; id: string; patch: Partial<StudioNode> }
  | { kind: 'remove'; ids: string[] }
  | { kind: 'order'; pageId: string; order: string[] }
  | { kind: 'page.add'; page: StudioPage }
  | { kind: 'page.rename'; pageId: string; name: string }
  | { kind: 'page.remove'; pageId: string }
  | { kind: 'asset.add'; asset: StudioAsset }
  | { kind: 'asset.remove'; assetId: string }
  | { kind: 'variable.set'; name: string; value: string }
  | { kind: 'variable.remove'; name: string }

const MAX_OPS = 400
const MAX_NODES_PER_OP = 1500

export function sanitizeOps(value: unknown): StudioOp[] {
  const list = Array.isArray(value) ? value : []
  const out: StudioOp[] = []
  for (const raw of list.slice(0, MAX_OPS)) {
    const op = sanitizeOp(raw)
    if (op) out.push(op)
  }
  return out
}

function sanitizeOp(value: unknown): StudioOp | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  switch (raw.kind) {
    case 'upsert': {
      const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
        .slice(0, MAX_NODES_PER_OP)
        .map(sanitizeNode)
        .filter((n): n is StudioNode => n !== null)
      if (nodes.length === 0) return null
      return { kind: 'upsert', nodes, pageId: isStudioId(raw.pageId) ? raw.pageId : undefined }
    }
    case 'update': {
      if (!isStudioId(raw.id) || typeof raw.patch !== 'object' || raw.patch === null) return null
      const patch = sanitizePatch(raw.patch as Record<string, unknown>)
      if (Object.keys(patch).length === 0) return null
      return { kind: 'update', id: raw.id, patch }
    }
    case 'remove': {
      const ids = (Array.isArray(raw.ids) ? raw.ids : []).filter(isStudioId).slice(0, MAX_NODES_PER_OP)
      if (ids.length === 0) return null
      return { kind: 'remove', ids }
    }
    case 'order': {
      if (!isStudioId(raw.pageId)) return null
      const order = (Array.isArray(raw.order) ? raw.order : []).filter(isStudioId).slice(0, STUDIO_NODE_LIMIT)
      return { kind: 'order', pageId: raw.pageId, order }
    }
    case 'page.add': {
      const page = raw.page as Record<string, unknown> | undefined
      if (!page || !isStudioId(page.id) || typeof page.name !== 'string') return null
      const order = (Array.isArray(page.order) ? page.order : []).filter(isStudioId)
      return { kind: 'page.add', page: { id: page.id, name: page.name.slice(0, 80) || 'Page', order } }
    }
    case 'page.rename': {
      if (!isStudioId(raw.pageId) || typeof raw.name !== 'string') return null
      return { kind: 'page.rename', pageId: raw.pageId, name: raw.name.slice(0, 80) || 'Page' }
    }
    case 'page.remove': {
      if (!isStudioId(raw.pageId)) return null
      return { kind: 'page.remove', pageId: raw.pageId }
    }
    case 'asset.add': {
      const asset = raw.asset as Record<string, unknown> | undefined
      if (!asset || !isStudioId(asset.id) || !isStudioId(asset.rootId)) return null
      const nodes = (Array.isArray(asset.nodes) ? asset.nodes : [])
        .slice(0, MAX_NODES_PER_OP)
        .map(sanitizeNode)
        .filter((n): n is StudioNode => n !== null)
      if (nodes.length === 0) return null
      const name = typeof asset.name === 'string' ? asset.name.slice(0, 80) : 'Component'
      return { kind: 'asset.add', asset: { id: asset.id, rootId: asset.rootId, name: name || 'Component', nodes } }
    }
    case 'asset.remove': {
      if (!isStudioId(raw.assetId)) return null
      return { kind: 'asset.remove', assetId: raw.assetId }
    }
    case 'variable.set': {
      if (typeof raw.name !== 'string' || typeof raw.value !== 'string') return null
      const name = raw.name.trim().slice(0, 60)
      if (!name) return null
      return { kind: 'variable.set', name, value: raw.value.slice(0, 200) }
    }
    case 'variable.remove': {
      if (typeof raw.name !== 'string') return null
      const name = raw.name.trim().slice(0, 60)
      return name ? { kind: 'variable.remove', name } : null
    }
    default:
      return null
  }
}

export function cloneDoc(doc: StudioDoc): StudioDoc {
  return {
    ...doc,
    pages: doc.pages.map(p => ({ ...p, order: [...p.order] })),
    nodes: { ...doc.nodes },
    assets: [...doc.assets],
    chat: [...doc.chat],
    agents: [...doc.agents],
    variables: { ...(doc.variables ?? {}) }
  }
}

export function applyOps(doc: StudioDoc, ops: StudioOp[]): number {
  let applied = 0
  for (const op of ops) {
    if (applyOp(doc, op)) applied++
  }
  if (ops.some(op => op.kind === 'upsert' || op.kind === 'remove' || op.kind === 'page.remove')) {
    for (const node of Object.values(doc.nodes)) {
      const parent = node.parentId ?? null
      if (parent && !doc.nodes[parent]) doc.nodes[node.id] = { ...node, parentId: null }
    }
  }
  return applied
}

function applyOp(doc: StudioDoc, op: StudioOp): boolean {
  switch (op.kind) {
    case 'upsert': {
      if (Object.keys(doc.nodes).length + op.nodes.length > STUDIO_NODE_LIMIT) return false
      for (const node of op.nodes) {
        const existed = doc.nodes[node.id]
        doc.nodes[node.id] = node
        if (existed) continue
        const parentPage = node.parentId ? pageOf(doc, node.parentId) : undefined
        const page =
          parentPage ?? doc.pages.find(p => p.id === op.pageId) ?? doc.pages[0]
        if (page && !page.order.includes(node.id)) {
          const idx = doc.pages.indexOf(page)
          doc.pages[idx] = { ...page, order: [...page.order, node.id] }
        }
      }
      return op.nodes.length > 0
    }
    case 'update': {
      const node = doc.nodes[op.id]
      if (!node) return false
      doc.nodes[op.id] = { ...node, ...op.patch, id: node.id, type: node.type }
      return true
    }
    case 'remove': {
      const doomed = descendantsOf(doc, op.ids)
      if (doomed.size === 0) return false
      for (const id of doomed) delete doc.nodes[id]
      doc.pages = doc.pages.map(p =>
        p.order.some(id => doomed.has(id)) ? { ...p, order: p.order.filter(id => !doomed.has(id)) } : p
      )
      return true
    }
    case 'order': {
      const idx = doc.pages.findIndex(p => p.id === op.pageId)
      if (idx === -1) return false
      const page = doc.pages[idx]
      const current = new Set(page.order)
      const next = op.order.filter(id => current.has(id))
      const seen = new Set(next)
      for (const id of page.order) {
        if (!seen.has(id)) next.push(id)
      }
      doc.pages[idx] = { ...page, order: next }
      return true
    }
    case 'page.add': {
      if (doc.pages.some(p => p.id === op.page.id) || doc.pages.length >= 50) return false
      doc.pages = [...doc.pages, { ...op.page, order: op.page.order.filter(id => doc.nodes[id] !== undefined) }]
      return true
    }
    case 'page.rename': {
      const idx = doc.pages.findIndex(p => p.id === op.pageId)
      if (idx === -1) return false
      doc.pages = doc.pages.map(p => (p.id === op.pageId ? { ...p, name: op.name } : p))
      return true
    }
    case 'page.remove': {
      if (doc.pages.length <= 1) return false
      const page = doc.pages.find(p => p.id === op.pageId)
      if (!page) return false
      for (const id of page.order) delete doc.nodes[id]
      doc.pages = doc.pages.filter(p => p.id !== op.pageId)
      return true
    }
    case 'asset.add': {
      if (doc.assets.length >= 100) return false
      doc.assets = [...doc.assets.filter(a => a.id !== op.asset.id), op.asset]
      return true
    }
    case 'asset.remove': {
      const before = doc.assets.length
      doc.assets = doc.assets.filter(a => a.id !== op.assetId)
      return doc.assets.length !== before
    }
    case 'variable.set':
      doc.variables = { ...(doc.variables ?? {}), [op.name]: op.value }
      return true
    case 'variable.remove': {
      if (!(op.name in (doc.variables ?? {}))) return false
      const variables = { ...doc.variables }
      delete variables[op.name]
      doc.variables = variables
      return true
    }
  }
}

export function invertOps(doc: StudioDoc, ops: StudioOp[]): StudioOp[] {
  const work = cloneDoc(doc)
  const inverses: StudioOp[] = []
  for (const op of ops) {
    const inverse = invertOp(work, op)
    applyOp(work, op)
    if (inverse) inverses.push(...inverse)
  }
  return inverses.reverse()
}

function invertOp(doc: StudioDoc, op: StudioOp): StudioOp[] | null {
  switch (op.kind) {
    case 'upsert': {
      const restore: StudioNode[] = []
      const added: string[] = []
      for (const node of op.nodes) {
        const existing = doc.nodes[node.id]
        if (existing) restore.push(existing)
        else added.push(node.id)
      }
      const out: StudioOp[] = []
      if (added.length > 0) out.push({ kind: 'remove', ids: added })
      if (restore.length > 0) out.push({ kind: 'upsert', nodes: restore })
      return out.length > 0 ? out : null
    }
    case 'update': {
      const node = doc.nodes[op.id]
      return node ? [{ kind: 'upsert', nodes: [node] }] : null
    }
    case 'remove': {
      const doomed = descendantsOf(doc, op.ids)
      if (doomed.size === 0) return null
      const out: StudioOp[] = []
      for (const page of doc.pages) {
        const nodes = page.order.filter(id => doomed.has(id)).map(id => doc.nodes[id])
        if (nodes.length === 0) continue
        out.push({ kind: 'upsert', nodes, pageId: page.id })
        out.push({ kind: 'order', pageId: page.id, order: [...page.order] })
      }
      return out.length > 0 ? out : null
    }
    case 'order': {
      const page = doc.pages.find(p => p.id === op.pageId)
      return page ? [{ kind: 'order', pageId: page.id, order: [...page.order] }] : null
    }
    case 'page.add':
      return [{ kind: 'page.remove', pageId: op.page.id }]
    case 'page.rename': {
      const page = doc.pages.find(p => p.id === op.pageId)
      return page ? [{ kind: 'page.rename', pageId: page.id, name: page.name }] : null
    }
    case 'page.remove': {
      const page = doc.pages.find(p => p.id === op.pageId)
      if (!page) return null
      const nodes = page.order.map(id => doc.nodes[id]).filter((n): n is StudioNode => n !== undefined)
      const out: StudioOp[] = [{ kind: 'page.add', page: { ...page, order: [] } }]
      if (nodes.length > 0) out.push({ kind: 'upsert', nodes, pageId: page.id })
      out.push({ kind: 'order', pageId: page.id, order: [...page.order] })
      return out
    }
    case 'asset.add': {
      const existing = doc.assets.find(a => a.id === op.asset.id)
      return existing ? [{ kind: 'asset.add', asset: existing }] : [{ kind: 'asset.remove', assetId: op.asset.id }]
    }
    case 'asset.remove': {
      const asset = doc.assets.find(a => a.id === op.assetId)
      return asset ? [{ kind: 'asset.add', asset }] : null
    }
    case 'variable.set':
      return op.name in (doc.variables ?? {})
        ? [{ kind: 'variable.set', name: op.name, value: doc.variables[op.name] }]
        : [{ kind: 'variable.remove', name: op.name }]
    case 'variable.remove':
      return op.name in (doc.variables ?? {})
        ? [{ kind: 'variable.set', name: op.name, value: doc.variables[op.name] }]
        : null
  }
}

const OPS_BLOCK = /```studio-ops\s*\n([\s\S]*?)```/g

export function parseStudioOps(text: string): { ops: StudioOp[]; cleaned: string } {
  const ops: StudioOp[] = []
  const cleaned = text
    .replace(OPS_BLOCK, (_match, body: string) => {
      try {
        const parsed = JSON.parse(body)
        ops.push(...sanitizeOps(Array.isArray(parsed) ? parsed : parsed?.ops))
      } catch {
        return ''
      }
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { ops, cleaned }
}
