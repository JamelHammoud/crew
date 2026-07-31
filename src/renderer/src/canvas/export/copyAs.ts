import type { TLShapeId } from '../schema/records'
import type { ClipboardExportEditor, CopyAsOptions, ImageExportOptions } from './types'

export const TLDRAW_CUSTOM_PNG_MIME_TYPE = 'web image/vnd.tldraw+png'

function rewritten(blob: Blob, type: string): Blob {
  return blob.type === type ? blob : blob.slice(0, blob.size, type)
}

function clipboardItem(types: Record<string, Promise<Blob> | Blob>): ClipboardItem {
  const Constructor = globalThis.ClipboardItem
  if (!Constructor) throw new Error('Copy not supported')
  return new Constructor(types)
}

function supports(type: string): boolean {
  const Constructor = globalThis.ClipboardItem
  return !!Constructor && typeof Constructor.supports === 'function' && Constructor.supports(type)
}

function write(types: Record<string, Promise<Blob>>): Promise<void> {
  const clipboard = navigator.clipboard
  const entries = Object.entries(types)
  for (const promise of Object.values(types)) promise.catch(() => {})
  return clipboard.write([clipboardItem(types)]).catch(() => Promise.all(entries.map(async ([type, promise]) => [type, await promise] as const)).then(resolved => clipboard.write([clipboardItem(Object.fromEntries(resolved))])))
}

function selectedIds(editor: ClipboardExportEditor, ids: readonly (TLShapeId | string)[]): TLShapeId[] {
  return (ids.length > 0 ? [...ids] : [...editor.getCurrentPageShapeIds()]) as TLShapeId[]
}

function svgText(editor: ClipboardExportEditor, ids: TLShapeId[], options: ImageExportOptions): Promise<string> {
  return editor.getSvgString(ids, options).then(result => {
    if (!result) throw new Error('Failed to copy')
    return result.svg
  })
}

export function copyAs(
  editor: ClipboardExportEditor,
  ids: readonly (TLShapeId | string)[],
  options: CopyAsOptions
): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return Promise.reject(new Error('Copy not supported'))
  const chosen = selectedIds(editor, ids)
  const imageOptions: ImageExportOptions = { ...options, format: options.format }
  if (navigator.clipboard.write) {
    const type = options.format === 'png' ? 'image/png' : 'text/plain'
    const blob = editor.toImage(chosen, imageOptions).then(result => rewritten(result.blob, type))
    const types: Record<string, Promise<Blob>> = { [type]: blob }
    if (options.format === 'png' && supports(TLDRAW_CUSTOM_PNG_MIME_TYPE)) {
      types[TLDRAW_CUSTOM_PNG_MIME_TYPE] = blob.then(value => rewritten(value, TLDRAW_CUSTOM_PNG_MIME_TYPE))
    }
    return write(types)
  }
  if (options.format === 'svg' && navigator.clipboard.writeText) {
    return svgText(editor, chosen, imageOptions).then(value => navigator.clipboard.writeText(value))
  }
  throw new Error('Copy not supported')
}
