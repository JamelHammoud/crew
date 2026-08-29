import type { TLAsset, TLRecord, TLShape, TLShapeId } from '../schema/records'

export interface ExportBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface SnapshotSvgOptions {
  shapeIds?: readonly (TLShapeId | string)[]
  pageId?: string
  bounds?: ExportBounds
  padding?: number
  scale?: number
  background?: boolean | string
  darkMode?: boolean
  preserveAspectRatio?: string
  resolveAssetUrl?: (source: string) => string
}

export interface SnapshotSvgResult {
  svg: string
  width: number
  height: number
  bounds: ExportBounds
}

export type SnapshotSource = { store: Record<string, unknown>; schema?: unknown } | Record<string, unknown>

export interface ExportShape extends Omit<TLShape, 'props'> {
  props: Record<string, unknown>
}

export interface ExportAsset extends Omit<TLAsset, 'props'> {
  props: Record<string, unknown>
}

export interface ExportStore {
  records: Record<string, unknown>
  shapes: Map<string, ExportShape>
  assets: Map<string, ExportAsset>
  children: Map<string, ExportShape[]>
}

export interface ImageExportOptions {
  format?: 'svg' | 'png' | 'jpeg' | 'webp'
  bounds?: ExportBounds
  scale?: number
  pixelRatio?: number
  background?: boolean
  padding?: number | 'auto'
  darkMode?: boolean
  preserveAspectRatio?: string
  quality?: number
  resolveAssetUrl?: (source: string) => string
}

export interface ClipboardExportEditor {
  getCurrentPageShapeIds(): Iterable<string>
  getSvgString: (...args: never[]) => Promise<{ svg: string; width: number; height: number } | undefined>
  toImage: (...args: never[]) => Promise<{ blob: Blob; width: number; height: number }>
}

export interface CopyAsOptions extends Omit<ImageExportOptions, 'format'> {
  format: 'svg' | 'png'
}

export type ExportRecord = TLRecord | ExportShape | ExportAsset
