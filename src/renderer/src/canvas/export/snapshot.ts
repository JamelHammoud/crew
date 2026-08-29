import {
  expandBounds,
  IDENTITY,
  intersectBounds,
  matrixFor,
  matrixText,
  multiply,
  positive,
  round,
  transformBounds,
  unionBounds,
  type Matrix
} from './geometry'
import { escapeXml } from './text'
import { renderShapeBody, type ShapeBody, type ShapeRenderContext } from './shapes'
import type {
  ExportAsset,
  ExportBounds,
  ExportShape,
  ExportStore,
  SnapshotSource,
  SnapshotSvgOptions,
  SnapshotSvgResult
} from './types'

function recordsOf(source: SnapshotSource): Record<string, unknown> {
  const wrapped = source as { store?: unknown }
  if (wrapped.store && typeof wrapped.store === 'object' && !Array.isArray(wrapped.store)) {
    return wrapped.store as Record<string, unknown>
  }
  return source as Record<string, unknown>
}

function isShape(record: unknown): record is ExportShape {
  const value = record as Partial<ExportShape> | null
  return (
    !!value &&
    value.typeName === 'shape' &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    !!value.props &&
    typeof value.props === 'object'
  )
}

function isAsset(record: unknown): record is ExportAsset {
  const value = record as Partial<ExportAsset> | null
  return (
    !!value &&
    value.typeName === 'asset' &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    !!value.props &&
    typeof value.props === 'object'
  )
}

function sortShapes(shapes: ExportShape[]): ExportShape[] {
  return shapes.sort((left, right) => String(left.index ?? '').localeCompare(String(right.index ?? '')))
}

function exportStore(source: SnapshotSource): ExportStore {
  const records = recordsOf(source)
  const shapes = new Map<string, ExportShape>()
  const assets = new Map<string, ExportAsset>()
  const children = new Map<string, ExportShape[]>()
  for (const record of Object.values(records)) {
    if (isShape(record)) shapes.set(record.id, record)
    else if (isAsset(record)) assets.set(record.id, record)
  }
  for (const shape of shapes.values()) {
    const siblings = children.get(shape.parentId) ?? []
    siblings.push(shape)
    children.set(shape.parentId, siblings)
  }
  for (const siblings of children.values()) sortShapes(siblings)
  return { records, shapes, assets, children }
}

function hidden(shape: ExportShape): boolean {
  return shape.meta?.hidden === true
}

function pageId(store: ExportStore, requested: string | undefined): string | null {
  if (requested && store.records[requested]) return requested
  for (const [id, record] of Object.entries(store.records)) {
    if ((record as { typeName?: unknown })?.typeName === 'page') return id
  }
  return null
}

function hasSelectedAncestor(shape: ExportShape, selected: Set<string>, store: ExportStore): boolean {
  let parent = store.shapes.get(shape.parentId)
  const seen = new Set<string>()
  while (parent && !seen.has(parent.id)) {
    if (selected.has(parent.id)) return true
    seen.add(parent.id)
    parent = store.shapes.get(parent.parentId)
  }
  return false
}

function rootsFor(store: ExportStore, options: SnapshotSvgOptions): ExportShape[] {
  if (options.shapeIds && options.shapeIds.length > 0) {
    const selected = new Set(options.shapeIds.map(String))
    return sortShapes(
      [...selected]
        .map(id => store.shapes.get(id))
        .filter((shape): shape is ExportShape => !!shape && !hasSelectedAncestor(shape, selected, store))
    )
  }
  const page = pageId(store, options.pageId)
  if (page) return [...(store.children.get(page) ?? [])]
  return sortShapes([...store.shapes.values()].filter(shape => !store.shapes.has(shape.parentId)))
}

function worldMatrix(
  shape: ExportShape,
  store: ExportStore,
  cache: Map<string, Matrix>,
  active = new Set<string>()
): Matrix {
  const cached = cache.get(shape.id)
  if (cached) return cached
  if (active.has(shape.id)) return matrixFor(shape)
  active.add(shape.id)
  const parent = store.shapes.get(shape.parentId)
  const matrix = parent
    ? multiply(worldMatrix(parent, store, cache, active), matrixFor(shape))
    : multiply(IDENTITY, matrixFor(shape))
  active.delete(shape.id)
  cache.set(shape.id, matrix)
  return matrix
}

interface RenderedShape {
  body: ShapeBody
  children: RenderedShape[]
  matrix: Matrix
  shape: ExportShape
}

function buildTree(
  shape: ExportShape,
  store: ExportStore,
  context: ShapeRenderContext,
  matrix: Matrix,
  active = new Set<string>()
): RenderedShape | null {
  if (hidden(shape) || active.has(shape.id)) return null
  active.add(shape.id)
  const children = (store.children.get(shape.id) ?? [])
    .map(child => buildTree(child, store, context, matrixFor(child), active))
    .filter((child): child is RenderedShape => child !== null)
  active.delete(shape.id)
  return { shape, body: renderShapeBody(shape, context), children, matrix }
}

function renderedBounds(node: RenderedShape, parent: Matrix = IDENTITY): ExportBounds | null {
  const matrix = multiply(parent, node.matrix)
  let bounds = node.body.bounds ? transformBounds(node.body.bounds, matrix) : null
  let children: ExportBounds | null = null
  for (const child of node.children) children = unionBounds(children, renderedBounds(child, matrix))
  if (children && node.body.clipBounds) {
    children = intersectBounds(children, transformBounds(node.body.clipBounds, matrix))
  }
  bounds = unionBounds(bounds, children)
  return bounds
}

function renderNode(node: RenderedShape, context: ShapeRenderContext): string {
  const clipId = `export-clip-${node.shape.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  if (node.body.clip && !context.defs.has(clipId)) {
    context.defs.set(clipId, `<clipPath id="${clipId}">${node.body.clip}</clipPath>`)
  }
  const children = node.children.map(child => renderNode(child, context)).join('')
  const clippedChildren = node.body.clip && children ? `<g clip-path="url(#${clipId})">${children}</g>` : children
  const clippedBody =
    node.body.clip && (node.shape.type === 'image' || node.shape.type === 'video')
      ? `<g clip-path="url(#${clipId})">${node.body.body}</g>`
      : node.body.body
  const opacity =
    typeof node.shape.opacity === 'number' && node.shape.opacity !== 1
      ? ` opacity="${round(Math.max(0, Math.min(1, node.shape.opacity)))}"`
      : ''
  return `<g data-shape-id="${escapeXml(node.shape.id)}" data-shape-type="${escapeXml(node.shape.type)}" transform="${matrixText(node.matrix)}"${opacity}>${clippedBody}${clippedChildren}</g>`
}

function exactBounds(value: ExportBounds): ExportBounds {
  const w = positive(value.w)
  const h = positive(value.h)
  return { x: Number.isFinite(value.x) ? value.x : 0, y: Number.isFinite(value.y) ? value.y : 0, w, h }
}

export function snapshotToSvgResult(
  source: SnapshotSource,
  options: SnapshotSvgOptions = {}
): SnapshotSvgResult | null {
  const store = exportStore(source)
  const roots = rootsFor(store, options)
  if (roots.length === 0) return null
  const defs = new Map<string, string>()
  const context: ShapeRenderContext = {
    store,
    defs,
    darkMode: options.darkMode === true,
    resolveAssetUrl: options.resolveAssetUrl
  }
  const matrices = new Map<string, Matrix>()
  const rendered = roots
    .map(shape =>
      buildTree(
        shape,
        store,
        context,
        options.shapeIds && options.shapeIds.length > 0 ? worldMatrix(shape, store, matrices) : matrixFor(shape)
      )
    )
    .filter((node): node is RenderedShape => node !== null)
  let bounds = options.bounds
    ? exactBounds(options.bounds)
    : rendered.reduce<ExportBounds | null>((box, node) => unionBounds(box, renderedBounds(node)), null)
  if (!bounds) return null
  const defaultPadding = options.bounds ? 0 : options.shapeIds?.length === 1 && roots[0]?.type === 'frame' ? 0 : 32
  const padding = Math.max(0, Number.isFinite(options.padding) ? options.padding! : defaultPadding)
  bounds = expandBounds(bounds, padding)
  const scale = positive(options.scale)
  const width = bounds.w * scale
  const height = bounds.h * scale
  const body = rendered.map(node => renderNode(node, context)).join('')
  const background =
    options.background === true
      ? options.darkMode
        ? '#0d0d0d'
        : '#f9fafb'
      : typeof options.background === 'string'
        ? options.background
        : null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" direction="ltr" width="${round(width)}" height="${round(height)}" viewBox="${round(bounds.x)} ${round(bounds.y)} ${round(bounds.w)} ${round(bounds.h)}" preserveAspectRatio="${escapeXml(options.preserveAspectRatio ?? 'xMidYMid meet')}" stroke-linecap="round" stroke-linejoin="round" data-color-mode="${options.darkMode ? 'dark' : 'light'}">${defs.size > 0 ? `<defs>${[...defs.values()].join('')}</defs>` : ''}${background ? `<rect x="${round(bounds.x)}" y="${round(bounds.y)}" width="${round(bounds.w)}" height="${round(bounds.h)}" fill="${escapeXml(background)}"/>` : ''}${body}</svg>`
  return { svg, width, height, bounds }
}

export function snapshotToSvg(source: SnapshotSource, options: SnapshotSvgOptions = {}): string | null {
  return snapshotToSvgResult(source, options)?.svg ?? null
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
