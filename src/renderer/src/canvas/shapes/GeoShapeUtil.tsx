import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Group2d, Rectangle2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { lerp } from '../math/utils'
import { geoShapeProps, type TLGeoShapeProps as CrewGeoProps } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { getGeoShapePath, getGeoTypeDefinition, type GeoShape } from './geoPaths'
import { BaseBoxShapeUtil, type ShapeEditor, type ShapeResizeInfo } from './ShapeUtil'
import { FONT_FAMILIES, LABEL_FONT_SIZES, LABEL_PADDING, STROKES, plainText } from './shared'
import { canvasSurface, shapeColor } from './theme'

export type { GeoShape } from './geoPaths'

const MIN_LABEL_WIDTHS = { s: 12, m: 14, l: 16, xl: 20 } as const
const HORIZONTAL_ALIGNS = {
  start: 'start',
  middle: 'center',
  end: 'end',
  'start-legacy': 'start',
  'end-legacy': 'end',
  'middle-legacy': 'center'
} as const
const VERTICAL_ALIGNS = { start: 'start', middle: 'middle', end: 'end' } as const
const LABEL_EDGE_MARGIN = 8
const MIN_SIZE_WITH_LABEL = (LABEL_PADDING + 1) * 3
const LINE_HEIGHT = 1.35

interface GeoDisplayValues {
  strokeColor: string
  strokeWidth: number
  strokeRoundness: number
  fillColor: string
  labelColor: string
  labelFontFamily: string
  labelFontSize: number
  labelMinWidth: number
  labelExtraPadding: number
  labelHorizontalAlign: 'start' | 'center' | 'end'
  labelVerticalAlign: 'start' | 'middle' | 'end'
}

function isEmptyRichText(value: unknown): boolean {
  return plainText(value).length === 0
}

export class GeoShapeUtil extends BaseBoxShapeUtil<GeoShape> {
  static override type = 'geo' as const
  static override props = geoShapeProps

  override options = { showTextOutline: true, getCustomDisplayValues: () => ({}) }

  getDefaultProps(): GeoShape['props'] {
    return {
      w: 100,
      h: 100,
      geo: 'rectangle',
      dash: 'draw',
      growY: 0,
      url: '',
      scale: 1,
      color: 'black',
      labelColor: 'black',
      fill: 'none',
      size: 'm',
      font: 'draw',
      align: 'middle',
      verticalAlign: 'middle',
      richText: { type: 'doc', content: [{ type: 'paragraph' }] }
    }
  }

  override canEdit(): boolean {
    return true
  }

  displayValues(shape: GeoShape): GeoDisplayValues {
    const { color, size, labelColor, fill, align, verticalAlign, font } = shape.props
    return {
      strokeColor: shapeColor(this.editor, color),
      strokeWidth: STROKES[size],
      strokeRoundness: STROKES[size] * 2,
      fillColor:
        fill === 'none'
          ? 'transparent'
          : fill === 'semi'
            ? canvasSurface(this.editor)
            : shapeColor(this.editor, color, fill === 'solid' ? 'semi' : fill === 'lined-fill' ? 'linedFill' : fill),
      labelColor: shapeColor(this.editor, labelColor),
      labelFontFamily: FONT_FAMILIES[font],
      labelFontSize: LABEL_FONT_SIZES[size],
      labelMinWidth: MIN_LABEL_WIDTHS[size],
      labelExtraPadding: STROKES[size],
      labelHorizontalAlign: HORIZONTAL_ALIGNS[align],
      labelVerticalAlign: VERTICAL_ALIGNS[verticalAlign]
    }
  }

  getGeometry(shape: GeoShape): Geometry2d {
    const { props } = shape
    const { scale } = props
    const dv = this.displayValues(shape)
    const pathGeometry = getGeoShapePath(shape, dv.strokeWidth).toGeometry()

    const scaledW = Math.max(1, props.w)
    const scaledH = Math.max(1, props.h + props.growY)
    const unscaledShapeW = scaledW / scale
    const unscaledShapeH = scaledH / scale

    const isEmptyLabel = isEmptyRichText(props.richText)
    const unscaledLabelSize = isEmptyLabel ? { w: 0, h: 0 } : this.unscaledLabelSize(shape)

    const unscaledMinWidth = Math.min(100, unscaledShapeW / 2)
    const unscaledMinHeight = Math.min(
      Math.round(dv.labelFontSize * LINE_HEIGHT) + LABEL_PADDING * 2,
      unscaledShapeH / 2
    )

    const unscaledLabelW = Math.min(
      unscaledShapeW,
      Math.max(unscaledLabelSize.w, Math.min(unscaledMinWidth, Math.max(1, unscaledShapeW - LABEL_EDGE_MARGIN)))
    )
    const unscaledLabelH = Math.min(
      unscaledShapeH,
      Math.max(unscaledLabelSize.h, Math.min(unscaledMinHeight, Math.max(1, unscaledShapeH - LABEL_EDGE_MARGIN)))
    )

    const unscaledX =
      dv.labelHorizontalAlign === 'start'
        ? 0
        : dv.labelHorizontalAlign === 'end'
          ? unscaledShapeW - unscaledLabelW
          : (unscaledShapeW - unscaledLabelW) / 2

    const unscaledY =
      dv.labelVerticalAlign === 'start'
        ? 0
        : dv.labelVerticalAlign === 'end'
          ? unscaledShapeH - unscaledLabelH
          : (unscaledShapeH - unscaledLabelH) / 2

    return new Group2d({
      children: [
        pathGeometry,
        new Rectangle2d({
          x: unscaledX * scale,
          y: unscaledY * scale,
          width: unscaledLabelW * scale,
          height: unscaledLabelH * scale,
          isFilled: true,
          isLabel: true,
          excludeFromShapeBounds: true
        })
      ]
    })
  }

  getHandleSnapGeometry(shape: GeoShape): { outline: Geometry2d; points: Vec[] } {
    const geometry = this.getGeometry(shape) as Group2d
    const outline = geometry.children[0]
    const definition = getGeoTypeDefinition(shape.props.geo)
    if (definition?.snapType === 'blobby') return { outline, points: [geometry.bounds.center] }
    return { outline, points: [...outline.vertices, geometry.bounds.center] }
  }

  override getText(shape: GeoShape): string {
    return plainText(shape.props.richText)
  }

  override getIndicatorPath(shape: GeoShape): Path2D | undefined {
    if (typeof Path2D === 'undefined') return undefined
    const { dash, scale } = shape.props
    const dv = this.displayValues(shape)
    return getGeoShapePath(shape, dv.strokeWidth).toPath2D({
      style: dash === 'draw' ? 'draw' : 'solid',
      strokeWidth: 1,
      passes: 1,
      randomSeed: shape.id,
      offset: 0,
      roundness: dv.strokeRoundness * scale
    })
  }

  component(shape: GeoShape): ReactNode {
    const { props } = shape
    const dv = this.displayValues(shape)
    const text = plainText(props.richText)
    const editing = this.editor.getEditingShapeId?.() === shape.id

    return createElement(
      'div',
      { style: { position: 'relative', width: props.w, height: props.h + props.growY } },
      createElement(
        'svg',
        {
          className: 'crew-shape',
          width: '100%',
          height: '100%',
          style: { overflow: 'visible', pointerEvents: 'all' } as CSSProperties
        },
        geoBody(shape, dv)
      ),
      text ? this.label(shape, dv, editing) : null
    )
  }

  private label(shape: GeoShape, dv: GeoDisplayValues, editing: boolean): ReactNode {
    const { props } = shape
    return createElement('div', {
      className: 'crew-rich-text',
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems:
          dv.labelHorizontalAlign === 'start'
            ? 'flex-start'
            : dv.labelHorizontalAlign === 'end'
              ? 'flex-end'
              : 'center',
        justifyContent:
          dv.labelVerticalAlign === 'start' ? 'flex-start' : dv.labelVerticalAlign === 'end' ? 'flex-end' : 'center',
        padding: LABEL_PADDING,
        color: dv.labelColor,
        fontFamily: dv.labelFontFamily,
        fontSize: dv.labelFontSize * props.scale,
        lineHeight: LINE_HEIGHT,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        textAlign: dv.labelHorizontalAlign,
        pointerEvents: 'all',
        visibility: editing ? 'hidden' : undefined
      } as CSSProperties,
      dangerouslySetInnerHTML: { __html: richTextToHtml(props.richText as RichTextDocument) }
    })
  }

  override onResize(shape: GeoShape, info: ShapeResizeInfo<GeoShape>): GeoShape {
    const { handle, newPoint, scaleX, scaleY, initialShape } = info
    const { scale } = shape.props
    const unscaledInitialW = initialShape.props.w / initialShape.props.scale
    const unscaledInitialH = (initialShape.props.h + initialShape.props.growY) / initialShape.props.scale

    let unscaledW = unscaledInitialW * scaleX
    let unscaledH = unscaledInitialH * scaleY
    let overShrinkX = 0
    let overShrinkY = 0

    if (!isEmptyRichText(shape.props.richText)) {
      const absW = Math.abs(unscaledW)
      const absH = Math.abs(unscaledH)
      const labelSize = this.measureUnscaledLabel({
        ...shape,
        props: {
          ...shape.props,
          w: Math.max(absW, MIN_SIZE_WITH_LABEL) * scale,
          h: Math.max(absH, MIN_SIZE_WITH_LABEL) * scale
        }
      })

      const constrainedW = Math.max(absW, labelSize.w)
      const constrainedH = Math.max(absH, labelSize.h)

      overShrinkX = constrainedW - absW
      overShrinkY = constrainedH - absH

      unscaledW = constrainedW * Math.sign(unscaledW || 1)
      unscaledH = constrainedH * Math.sign(unscaledH || 1)
    }

    const scaledW = unscaledW * scale
    const scaledH = unscaledH * scale
    const offset = new Vec(0, 0)

    if (scaleX < 0) offset.x += scaledW
    if (handle === 'left' || handle === 'top_left' || handle === 'bottom_left') {
      offset.x += scaleX < 0 ? overShrinkX : -overShrinkX
    }

    if (scaleY < 0) offset.y += scaledH
    if (handle === 'top' || handle === 'top_left' || handle === 'top_right') {
      offset.y += scaleY < 0 ? overShrinkY : -overShrinkY
    }

    const { x, y } = offset.rot(shape.rotation).add(newPoint)

    return {
      ...shape,
      x,
      y,
      props: { ...shape.props, w: Math.max(Math.abs(scaledW), 1), h: Math.max(Math.abs(scaledH), 1), growY: 0 }
    }
  }

  override onBeforeCreate(next: GeoShape): GeoShape | undefined {
    const { props } = next

    if (isEmptyRichText(props.richText)) {
      return props.growY !== 0 ? { ...next, props: { ...props, growY: 0 } } : undefined
    }

    const unscaledShapeH = props.h / props.scale
    const unscaledLabelH = this.unscaledLabelSize(next).h
    const unscaledGrowY = growYFor(unscaledShapeH, unscaledLabelH, props.growY / props.scale)

    if (unscaledGrowY === null) return undefined
    return { ...next, props: { ...props, growY: unscaledGrowY * props.scale } }
  }

  override onBeforeUpdate(previous: GeoShape, next: GeoShape): GeoShape | undefined {
    const before = previous.props
    const after = next.props

    if (before.richText === after.richText && before.font === after.font && before.size === after.size) {
      return undefined
    }
    if (
      plainText(before.richText) === plainText(after.richText) &&
      before.font === after.font &&
      before.size === after.size
    ) {
      return undefined
    }

    const wasEmpty = isEmptyRichText(before.richText)
    const isEmpty = isEmptyRichText(after.richText)

    if (wasEmpty && isEmpty) return undefined
    if (isEmpty) return after.growY !== 0 ? { ...next, props: { ...after, growY: 0 } } : undefined

    const { scale } = after
    const unscaledPrevW = before.w / before.scale
    const unscaledPrevH = before.h / before.scale
    const unscaledPrevGrowY = before.growY / before.scale
    const labelSize = this.unscaledLabelSize(next)

    if (wasEmpty) {
      let w = Math.max(unscaledPrevW, labelSize.w)
      let h = Math.max(unscaledPrevH, labelSize.h)
      if (unscaledPrevW < MIN_SIZE_WITH_LABEL && unscaledPrevH < MIN_SIZE_WITH_LABEL) {
        const side = Math.max(Math.max(w, MIN_SIZE_WITH_LABEL), Math.max(h, MIN_SIZE_WITH_LABEL))
        w = side
        h = side
      }
      return { ...next, props: { ...after, w: w * scale, h: h * scale, growY: 0 } }
    }

    const unscaledNextW = after.w / scale
    const needsWidthExpand = labelSize.w > unscaledNextW
    const unscaledGrowY = growYFor(unscaledPrevH, labelSize.h, unscaledPrevGrowY)

    if (unscaledGrowY === null && !needsWidthExpand) return undefined

    return {
      ...next,
      props: {
        ...after,
        growY: (unscaledGrowY ?? unscaledPrevGrowY) * scale,
        w: Math.max(unscaledNextW, labelSize.w) * scale
      }
    }
  }

  getInterpolatedProps(start: GeoShape, end: GeoShape, t: number): CrewGeoProps {
    return {
      ...(t > 0.5 ? end.props : start.props),
      w: lerp(start.props.w, end.props.w, t),
      h: lerp(start.props.h, end.props.h, t),
      scale: lerp(start.props.scale, end.props.scale, t)
    }
  }

  private unscaledLabelSize(shape: GeoShape): { w: number; h: number } {
    return this.measureUnscaledLabel(shape)
  }

  private measureUnscaledLabel(shape: GeoShape): { w: number; h: number } {
    const dv = this.displayValues(shape)
    const maxWidth = Math.max(
      0,
      Math.ceil(dv.labelMinWidth + dv.labelExtraPadding),
      Math.ceil(shape.props.w / shape.props.scale - LABEL_PADDING * 2)
    )
    const size = measureLabel(this.editor, plainText(shape.props.richText), {
      fontFamily: dv.labelFontFamily,
      fontSize: dv.labelFontSize,
      lineHeight: LINE_HEIGHT,
      maxWidth,
      minWidth: dv.labelMinWidth
    })
    return { w: size.w + LABEL_PADDING * 2, h: size.h + LABEL_PADDING * 2 }
  }
}

function growYFor(unscaledShapeH: number, unscaledLabelH: number, unscaledCurrentGrowY: number): number | null {
  if (unscaledLabelH > unscaledShapeH) return unscaledLabelH - unscaledShapeH
  if (unscaledCurrentGrowY > 0) return 0
  return null
}

interface LabelMeasureOptions {
  fontFamily: string
  fontSize: number
  lineHeight: number
  maxWidth: number
  minWidth: number
}

function measureLabel(editor: ShapeEditor, text: string, options: LabelMeasureOptions): { w: number; h: number } {
  const measurer = editor.textMeasure
  if (measurer?.measureText) {
    return measurer.measureText(text, {
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      maxWidth: options.maxWidth
    })
  }
  const lines = text.split('\n')
  const widest = Math.max(options.minWidth, ...lines.map(line => line.length * options.fontSize * 0.58))
  const w = Math.min(widest, options.maxWidth || widest)
  const wrapped = lines.reduce((total, line) => {
    const width = line.length * options.fontSize * 0.58
    return total + Math.max(1, Math.ceil(width / Math.max(1, w)))
  }, 0)
  return { w, h: Math.max(1, wrapped) * Math.round(options.fontSize * options.lineHeight) }
}

function geoBody(shape: GeoShape, dv: GeoDisplayValues): ReactNode {
  const { dash, fill, scale } = shape.props
  const strokeWidth = dv.strokeWidth * scale
  const path = getGeoShapePath(shape, dv.strokeWidth)

  const fillPath =
    dash === 'draw'
      ? path.toDrawD({ strokeWidth, randomSeed: shape.id, passes: 1, offset: 0, onlyFilled: true })
      : path.toD({ onlyFilled: true })

  return [
    fill === 'none' ? null : createElement('path', { key: 'fill', fill: dv.fillColor, d: fillPath, stroke: 'none' }),
    createElement(
      'g',
      { key: 'stroke' },
      path.toSvg({
        style: dash,
        strokeWidth,
        randomSeed: shape.id,
        props: { fill: 'none', stroke: dv.strokeColor, strokeLinecap: 'round', strokeLinejoin: 'round' }
      })
    )
  ]
}
