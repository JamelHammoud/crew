export { CrewCanvas, type CrewCanvasOptions, type CrewCanvasProps } from './CrewCanvas'
export { Editor } from './editor'
export type { TLResizeInfo } from './tools/transforms/resizeBox'
export {
  ArrowShapeUtil,
  FrameShapeUtil,
  GeoShapeUtil,
  ShapeUtil,
  TextShapeUtil,
  defaultBindingUtils,
  defaultShapeUtils
} from './shapes'
export { BaseBoxShapeTool } from './tools'
export { resizeBox } from './tools/transforms/resizeBox'
export { copyAs } from './export'
export { atom, computed, useValue } from './signals'
export { Ellipse2d, Polygon2d, Rectangle2d } from './geometry'
export { Vec } from './math'
export {
  InstancePresenceRecordType,
  T,
  createShapeId,
  createTLSchema,
  createTLStore,
  designNodeShapeProps,
  getSnapshot,
  loadSnapshot,
  renderHtmlFromRichTextForMeasurement
} from './schema'
export type {
  TLCursorType,
  TLDefaultColorStyle,
  TLDefaultDashStyle,
  TLDefaultSizeStyle,
  TLPageId,
  TLRecord,
  TLShape,
  TLShapeId,
  TLUserId
} from './schema'
export type { TLStoreSnapshot } from './schema/tlStore'
export {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFontStyle,
  LineShapeSplineStyle,
  getColorValue
} from './styles'
export {
  EditorContext,
  useCanRedo,
  useCanUndo,
  useEditor,
  useMaybeEditor
} from './react'
export { HTMLContainer } from './primitives'
export type { SelectionForegroundOverlayUtil } from './primitives'

export type TLFrameShape = import('./schema').TLShape<'frame'>
export type TLTextShape = import('./schema').TLShape<'text'>
