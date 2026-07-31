import type { TLShape, TLShapeId } from '../../schema'
import type { BoxPointerInfo, BoxToolEditor } from '../box'

export function startEditingShapeWithRichText(
  editor: BoxToolEditor,
  shapeOrId: TLShape | TLShapeId,
  options: { info?: BoxPointerInfo } = {}
): void {
  const shape = typeof shapeOrId === 'string' ? editor.getShape(shapeOrId) : shapeOrId
  if (!shape) return
  if (editor.canEditShape && !editor.canEditShape(shape)) return
  if (!('richText' in shape.props)) throw new Error('Shape does not have rich text')
  editor.setEditingShape?.(shape)
  editor.setCurrentTool('select.editing_shape', {
    ...options.info,
    target: 'shape',
    shape
  })
}
