import type { DesignNodeProps } from '../../../../shared/designNode'
import type { TLRichText } from './richText'
import { T, type Validatable, type Validator } from './validate'

export const DEFAULT_COLORS = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
] as const

export const DEFAULT_DASHES = ['draw', 'solid', 'dashed', 'dotted', 'none'] as const
export const DEFAULT_FILLS = ['none', 'semi', 'solid', 'pattern', 'fill', 'lined-fill'] as const
export const DEFAULT_SIZES = ['s', 'm', 'l', 'xl'] as const
export const DEFAULT_FONTS = ['draw', 'sans', 'serif', 'mono'] as const
export const HORIZONTAL_ALIGNS = ['start', 'middle', 'end', 'start-legacy', 'end-legacy', 'middle-legacy'] as const
export const VERTICAL_ALIGNS = ['start', 'middle', 'end'] as const
export const TEXT_ALIGNS = ['start', 'middle', 'end'] as const
export const GEO_KINDS = [
  'cloud',
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'rhombus',
  'rhombus-2',
  'oval',
  'trapezoid',
  'arrow-right',
  'arrow-left',
  'arrow-up',
  'arrow-down',
  'x-box',
  'check-box',
  'heart'
] as const
export const ARROW_KINDS = ['arc', 'elbow'] as const
export const ARROWHEADS = ['arrow', 'triangle', 'square', 'dot', 'pipe', 'diamond', 'inverted', 'bar', 'none'] as const
export const SPLINES = ['cubic', 'line'] as const

export type TLDefaultColorStyle = (typeof DEFAULT_COLORS)[number]
export type TLDefaultDashStyle = (typeof DEFAULT_DASHES)[number]
export type TLDefaultFillStyle = (typeof DEFAULT_FILLS)[number]
export type TLDefaultSizeStyle = (typeof DEFAULT_SIZES)[number]
export type TLDefaultFontStyle = (typeof DEFAULT_FONTS)[number]
export type TLDefaultHorizontalAlignStyle = (typeof HORIZONTAL_ALIGNS)[number]
export type TLDefaultVerticalAlignStyle = (typeof VERTICAL_ALIGNS)[number]
export type TLDefaultTextAlignStyle = (typeof TEXT_ALIGNS)[number]
export type TLGeoShapeGeoStyle = (typeof GEO_KINDS)[number]
export type TLArrowShapeKind = (typeof ARROW_KINDS)[number]
export type TLArrowShapeArrowheadStyle = (typeof ARROWHEADS)[number]
export type TLLineShapeSplineStyle = (typeof SPLINES)[number]

export const colorStyle = T.literalEnum(...DEFAULT_COLORS)
export const dashStyle = T.literalEnum(...DEFAULT_DASHES)
export const fillStyle = T.literalEnum(...DEFAULT_FILLS)
export const sizeStyle = T.literalEnum(...DEFAULT_SIZES)
export const fontStyle = T.literalEnum(...DEFAULT_FONTS)
export const horizontalAlignStyle = T.literalEnum(...HORIZONTAL_ALIGNS)
export const verticalAlignStyle = T.literalEnum(...VERTICAL_ALIGNS)
export const textAlignStyle = T.literalEnum(...TEXT_ALIGNS)
export const geoStyle = T.literalEnum(...GEO_KINDS)
export const arrowKindStyle = T.literalEnum(...ARROW_KINDS)
export const arrowheadStyle = T.literalEnum(...ARROWHEADS)
export const splineStyle = T.literalEnum(...SPLINES)

export const richTextValidator = T.object({
  type: T.string,
  content: T.arrayOf(T.unknown),
  attrs: T.any.optional()
}).allowUnknownProperties() as unknown as Validator<TLRichText>

export interface VecModel {
  x: number
  y: number
  z?: number
}

export const vecModelValidator = T.object<VecModel>({
  x: T.number,
  y: T.number,
  z: T.number.optional()
})

export interface TLShapeCrop {
  topLeft: VecModel
  bottomRight: VecModel
  isCircle?: boolean
}

export const cropValidator = T.object<TLShapeCrop>({
  topLeft: vecModelValidator,
  bottomRight: vecModelValidator,
  isCircle: T.boolean.optional()
})

export interface CanvasDrawShapeSegment {
  type: 'free' | 'straight'
  path: string
  dim?: 2 | 3
}

export const drawSegmentValidator = T.object<CanvasDrawShapeSegment>({
  type: T.literalEnum('free', 'straight'),
  path: T.string,
  dim: T.literalEnum(2, 3).optional()
})

export interface TLLineShapePoint {
  id: string
  index: string
  x: number
  y: number
}

export const linePointValidator = T.object<TLLineShapePoint>({
  id: T.string,
  index: T.string,
  x: T.number,
  y: T.number
})

export interface TLGeoShapeProps {
  geo: TLGeoShapeGeoStyle
  dash: TLDefaultDashStyle
  url: string
  w: number
  h: number
  growY: number
  scale: number
  labelColor: TLDefaultColorStyle
  color: TLDefaultColorStyle
  fill: TLDefaultFillStyle
  size: TLDefaultSizeStyle
  font: TLDefaultFontStyle
  align: TLDefaultHorizontalAlignStyle
  verticalAlign: TLDefaultVerticalAlignStyle
  richText: TLRichText
}

export interface TLTextShapeProps {
  color: TLDefaultColorStyle
  size: TLDefaultSizeStyle
  font: TLDefaultFontStyle
  textAlign: TLDefaultTextAlignStyle
  w: number
  richText: TLRichText
  scale: number
  autoSize: boolean
}

export interface TLNoteShapeProps {
  color: TLDefaultColorStyle
  labelColor: TLDefaultColorStyle
  size: TLDefaultSizeStyle
  font: TLDefaultFontStyle
  fontSizeAdjustment: number | null
  align: TLDefaultHorizontalAlignStyle
  verticalAlign: TLDefaultVerticalAlignStyle
  growY: number
  url: string
  richText: TLRichText
  scale: number
  textLastEditedBy: string | null
}

export interface TLArrowShapeProps {
  kind: TLArrowShapeKind
  labelColor: TLDefaultColorStyle
  color: TLDefaultColorStyle
  fill: TLDefaultFillStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  arrowheadStart: TLArrowShapeArrowheadStyle
  arrowheadEnd: TLArrowShapeArrowheadStyle
  font: TLDefaultFontStyle
  start: VecModel
  end: VecModel
  bend: number
  richText: TLRichText
  labelPosition: number
  scale: number
  elbowMidPoint: number
}

export interface TLLineShapeProps {
  color: TLDefaultColorStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  spline: TLLineShapeSplineStyle
  points: Record<string, TLLineShapePoint>
  scale: number
}

export interface CanvasDrawShapeProps {
  color: TLDefaultColorStyle
  fill: TLDefaultFillStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  segments: CanvasDrawShapeSegment[]
  isComplete: boolean
  isClosed: boolean
  isPen: boolean
  scale: number
  scaleX: number
  scaleY: number
}

export interface TLHighlightShapeProps {
  color: TLDefaultColorStyle
  size: TLDefaultSizeStyle
  segments: CanvasDrawShapeSegment[]
  isComplete: boolean
  isPen: boolean
  scale: number
  scaleX: number
  scaleY: number
}

export interface TLFrameShapeProps {
  w: number
  h: number
  name: string
  color: TLDefaultColorStyle
}

export type TLGroupShapeProps = Record<string, never>

export interface TLImageShapeProps {
  w: number
  h: number
  playing: boolean
  url: string
  assetId: string | null
  crop: TLShapeCrop | null
  flipX: boolean
  flipY: boolean
  altText: string
}

export interface TLVideoShapeProps {
  w: number
  h: number
  time: number
  playing: boolean
  autoplay: boolean
  url: string
  assetId: string | null
  altText: string
}

export interface TLBookmarkShapeProps {
  w: number
  h: number
  assetId: string | null
  url: string
}

export interface TLEmbedShapeProps {
  w: number
  h: number
  url: string
}

export interface TLShapePropsMap {
  geo: TLGeoShapeProps
  text: TLTextShapeProps
  note: TLNoteShapeProps
  arrow: TLArrowShapeProps
  line: TLLineShapeProps
  draw: CanvasDrawShapeProps
  highlight: TLHighlightShapeProps
  frame: TLFrameShapeProps
  group: TLGroupShapeProps
  image: TLImageShapeProps
  video: TLVideoShapeProps
  bookmark: TLBookmarkShapeProps
  embed: TLEmbedShapeProps
  'design-node': DesignNodeProps
}

export type TLShapeType = keyof TLShapePropsMap

export type PropsConfig<Props> = { readonly [K in keyof Props]: Validatable<Props[K]> }

const assetId = T.string.nullable()

export const geoShapeProps: PropsConfig<TLGeoShapeProps> = {
  geo: geoStyle,
  dash: dashStyle,
  url: T.linkUrl,
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  growY: T.positiveNumber,
  scale: T.nonZeroNumber,
  labelColor: colorStyle,
  color: colorStyle,
  fill: fillStyle,
  size: sizeStyle,
  font: fontStyle,
  align: horizontalAlignStyle,
  verticalAlign: verticalAlignStyle,
  richText: richTextValidator
}

export const textShapeProps: PropsConfig<TLTextShapeProps> = {
  color: colorStyle,
  size: sizeStyle,
  font: fontStyle,
  textAlign: textAlignStyle,
  w: T.nonZeroNumber,
  richText: richTextValidator,
  scale: T.nonZeroNumber,
  autoSize: T.boolean
}

export const noteShapeProps: PropsConfig<TLNoteShapeProps> = {
  color: colorStyle,
  labelColor: colorStyle,
  size: sizeStyle,
  font: fontStyle,
  fontSizeAdjustment: T.positiveNumber.nullable(),
  align: horizontalAlignStyle,
  verticalAlign: verticalAlignStyle,
  growY: T.positiveNumber,
  url: T.linkUrl,
  richText: richTextValidator,
  scale: T.nonZeroNumber,
  textLastEditedBy: T.string.nullable()
}

export const arrowShapeProps: PropsConfig<TLArrowShapeProps> = {
  kind: arrowKindStyle,
  labelColor: colorStyle,
  color: colorStyle,
  fill: fillStyle,
  dash: dashStyle,
  size: sizeStyle,
  arrowheadStart: arrowheadStyle,
  arrowheadEnd: arrowheadStyle,
  font: fontStyle,
  start: vecModelValidator,
  end: vecModelValidator,
  bend: T.number,
  richText: richTextValidator,
  labelPosition: T.number,
  scale: T.nonZeroNumber,
  elbowMidPoint: T.number
}

export const lineShapeProps: PropsConfig<TLLineShapeProps> = {
  color: colorStyle,
  dash: dashStyle,
  size: sizeStyle,
  spline: splineStyle,
  points: T.dict(T.string, linePointValidator),
  scale: T.nonZeroNumber
}

export const drawShapeProps: PropsConfig<CanvasDrawShapeProps> = {
  color: colorStyle,
  fill: fillStyle,
  dash: dashStyle,
  size: sizeStyle,
  segments: T.arrayOf(drawSegmentValidator),
  isComplete: T.boolean,
  isClosed: T.boolean,
  isPen: T.boolean,
  scale: T.nonZeroNumber,
  scaleX: T.nonZeroFiniteNumber,
  scaleY: T.nonZeroFiniteNumber
}

export const highlightShapeProps: PropsConfig<TLHighlightShapeProps> = {
  color: colorStyle,
  size: sizeStyle,
  segments: T.arrayOf(drawSegmentValidator),
  isComplete: T.boolean,
  isPen: T.boolean,
  scale: T.nonZeroNumber,
  scaleX: T.nonZeroFiniteNumber,
  scaleY: T.nonZeroFiniteNumber
}

export const frameShapeProps: PropsConfig<TLFrameShapeProps> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  name: T.string,
  color: colorStyle
}

export const groupShapeProps: PropsConfig<TLGroupShapeProps> = {}

export const imageShapeProps: PropsConfig<TLImageShapeProps> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  playing: T.boolean,
  url: T.linkUrl,
  assetId,
  crop: cropValidator.nullable(),
  flipX: T.boolean,
  flipY: T.boolean,
  altText: T.string
}

export const videoShapeProps: PropsConfig<TLVideoShapeProps> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  time: T.number,
  playing: T.boolean,
  autoplay: T.boolean,
  url: T.linkUrl,
  assetId,
  altText: T.string
}

export const bookmarkShapeProps: PropsConfig<TLBookmarkShapeProps> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  assetId,
  url: T.linkUrl
}

export const embedShapeProps: PropsConfig<TLEmbedShapeProps> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  url: T.string
}

export const designNodeShapeProps: PropsConfig<DesignNodeProps> = {
  w: T.number,
  h: T.number,
  name: T.string,
  shape: T.any,
  radius: T.any,
  fills: T.any,
  strokes: T.any,
  effects: T.any,
  layout: T.any,
  text: T.string,
  type: T.any,
  clip: T.boolean,
  mask: T.boolean,
  blend: T.string,
  component: T.string,
  instanceOf: T.string
}

export const SHAPE_PROPS: { [K in TLShapeType]: PropsConfig<TLShapePropsMap[K]> } = {
  geo: geoShapeProps,
  text: textShapeProps,
  note: noteShapeProps,
  arrow: arrowShapeProps,
  line: lineShapeProps,
  draw: drawShapeProps,
  highlight: highlightShapeProps,
  frame: frameShapeProps,
  group: groupShapeProps,
  image: imageShapeProps,
  video: videoShapeProps,
  bookmark: bookmarkShapeProps,
  embed: embedShapeProps,
  'design-node': designNodeShapeProps
}

export interface TLImageAssetProps {
  w: number
  h: number
  name: string
  isAnimated: boolean
  mimeType: string | null
  src: string | null
  fileSize?: number
  pixelRatio?: number
}

export interface TLVideoAssetProps {
  w: number
  h: number
  name: string
  isAnimated: boolean
  mimeType: string | null
  src: string | null
  fileSize?: number
}

export interface TLBookmarkAssetProps {
  title: string
  description: string
  image: string
  favicon: string
  src: string | null
}

export interface TLAssetPropsMap {
  image: TLImageAssetProps
  video: TLVideoAssetProps
  bookmark: TLBookmarkAssetProps
}

export type TLAssetType = keyof TLAssetPropsMap

export const ASSET_PROPS: { [K in TLAssetType]: PropsConfig<TLAssetPropsMap[K]> } = {
  image: {
    w: T.number,
    h: T.number,
    name: T.string,
    isAnimated: T.boolean,
    mimeType: T.string.nullable(),
    src: T.srcUrl.nullable(),
    fileSize: T.nonZeroNumber.optional(),
    pixelRatio: T.positiveNumber.optional()
  },
  video: {
    w: T.number,
    h: T.number,
    name: T.string,
    isAnimated: T.boolean,
    mimeType: T.string.nullable(),
    src: T.srcUrl.nullable(),
    fileSize: T.number.optional()
  },
  bookmark: {
    title: T.string,
    description: T.string,
    image: T.string,
    favicon: T.string,
    src: T.srcUrl.nullable()
  }
}

export interface TLArrowBindingProps {
  terminal: 'start' | 'end'
  normalizedAnchor: VecModel
  isExact: boolean
  isPrecise: boolean
  snap: 'center' | 'edge-point' | 'edge' | 'none'
}

export interface TLBindingPropsMap {
  arrow: TLArrowBindingProps
}

export type TLBindingType = keyof TLBindingPropsMap

export const BINDING_PROPS: { [K in TLBindingType]: PropsConfig<TLBindingPropsMap[K]> } = {
  arrow: {
    terminal: T.literalEnum('start', 'end'),
    normalizedAnchor: vecModelValidator,
    isExact: T.boolean,
    isPrecise: T.boolean,
    snap: T.literalEnum('center', 'edge-point', 'edge', 'none')
  }
}
