import { createElement, type ReactNode } from 'react'
import { Edge2d, Ellipse2d, Group2d, Polygon2d, Rectangle2d, Stadium2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { geoShapeProps, type TLGeoShapeGeoStyle as GeoKind, type TLShape as CrewShape } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { BaseBoxShapeUtil } from './ShapeUtil'
import { FONT_FAMILIES, LABEL_FONT_SIZES, STROKES, plainText, shapeElement } from './shared'
import { canvasSurface, shapeColor } from './theme'

export type GeoShape = CrewShape<'geo'>

const POLYGONS: Partial<Record<GeoKind, readonly [number, number][]>> = {
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1]
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5]
  ],
  pentagon: [
    [0.5, 0],
    [0.976, 0.345],
    [0.794, 0.905],
    [0.206, 0.905],
    [0.024, 0.345]
  ],
  hexagon: [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5]
  ],
  octagon: [
    [0.293, 0],
    [707 / 1000, 0],
    [1, 0.293],
    [1, 707 / 1000],
    [707 / 1000, 1],
    [0.293, 1],
    [0, 707 / 1000],
    [0, 0.293]
  ],
  star: [
    [0.5, 0],
    [0.612, 0.346],
    [0.976, 0.346],
    [0.682, 0.559],
    [0.794, 0.905],
    [0.5, 0.691],
    [0.206, 0.905],
    [0.318, 0.559],
    [0.024, 0.346],
    [0.388, 0.346]
  ],
  rhombus: [
    [0.2, 0],
    [1, 0],
    [0.8, 1],
    [0, 1]
  ],
  'rhombus-2': [
    [0, 0],
    [0.8, 0],
    [1, 1],
    [0.2, 1]
  ],
  trapezoid: [
    [0.2, 0],
    [0.8, 0],
    [1, 1],
    [0, 1]
  ],
  'arrow-right': [
    [0, 0.25],
    [0.6, 0.25],
    [0.6, 0],
    [1, 0.5],
    [0.6, 1],
    [0.6, 0.75],
    [0, 0.75]
  ],
  'arrow-left': [
    [1, 0.25],
    [0.4, 0.25],
    [0.4, 0],
    [0, 0.5],
    [0.4, 1],
    [0.4, 0.75],
    [1, 0.75]
  ],
  'arrow-up': [
    [0.25, 1],
    [0.25, 0.4],
    [0, 0.4],
    [0.5, 0],
    [1, 0.4],
    [0.75, 0.4],
    [0.75, 1]
  ],
  'arrow-down': [
    [0.25, 0],
    [0.25, 0.6],
    [0, 0.6],
    [0.5, 1],
    [1, 0.6],
    [0.75, 0.6],
    [0.75, 0]
  ],
  'x-box': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ],
  'check-box': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ]
}

function radialPoints(count: number, inner: number, rotate = -Math.PI / 2): Vec[] {
  return Array.from({ length: count }, (_, index) => {
    const radius = index % 2 === 0 ? 0.5 : inner
    const angle = rotate + (index * Math.PI * 2) / count
    return new Vec(0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius)
  })
}

function cloudPoints(): Vec[] {
  return Array.from({ length: 48 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 48
    const radius = 0.45 + Math.sin(angle * 6 + 0.4) * 0.055 + Math.sin(angle * 9) * 0.025
    return new Vec(0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius)
  })
}

function heartPoints(): Vec[] {
  return Array.from({ length: 48 }, (_, index) => {
    const t = (index * Math.PI * 2) / 48
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return new Vec(0.5 + x / 34, 0.47 - y / 34)
  })
}

export function geoPoints(kind: GeoKind, w: number, h: number): Vec[] | null {
  const source =
    kind === 'cloud'
      ? cloudPoints()
      : kind === 'heart'
        ? heartPoints()
        : kind === 'star'
          ? radialPoints(10, 0.2)
          : POLYGONS[kind]?.map(([x, y]) => new Vec(x, y))
  return source?.map(point => new Vec(point.x * w, point.y * h)) ?? null
}

export function geoGeometry(kind: GeoKind, w: number, h: number): Geometry2d {
  if (kind === 'ellipse') return new Ellipse2d({ width: w, height: h, isFilled: true })
  if (kind === 'oval') return new Stadium2d({ width: w, height: h, isFilled: true })
  const points = geoPoints(kind, w, h)
  const outline = points
    ? new Polygon2d({ points, isFilled: true })
    : new Rectangle2d({ width: w, height: h, isFilled: true })
  if (kind === 'x-box') {
    return new Group2d({
      children: [
        outline,
        new Edge2d({ start: new Vec(0, 0), end: new Vec(w, h) }),
        new Edge2d({ start: new Vec(w, 0), end: new Vec(0, h) })
      ]
    })
  }
  if (kind === 'check-box') {
    return new Group2d({
      children: [
        outline,
        new Edge2d({ start: new Vec(w * 0.2, h * 0.52), end: new Vec(w * 0.43, h * 0.75) }),
        new Edge2d({ start: new Vec(w * 0.43, h * 0.75), end: new Vec(w * 0.82, h * 0.25) })
      ]
    })
  }
  return outline
}

function fillFor(editor: GeoShapeUtil['editor'], shape: GeoShape): string {
  if (shape.props.fill === 'none') return 'none'
  if (shape.props.fill === 'semi') return canvasSurface(editor)
  const variant =
    shape.props.fill === 'solid' ? 'semi' : shape.props.fill === 'lined-fill' ? 'linedFill' : shape.props.fill
  return shapeColor(editor, shape.props.color, variant)
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

  getGeometry(shape: GeoShape): Geometry2d {
    return geoGeometry(shape.props.geo, Math.max(1, shape.props.w), Math.max(1, shape.props.h + shape.props.growY))
  }

  override getText(shape: GeoShape): string {
    return plainText(shape.props.richText)
  }

  component(shape: GeoShape): ReactNode {
    const { props } = shape
    const geometry = this.getGeometry(shape)
    const text = plainText(props.richText)
    const editing = this.editor.getEditingShapeId?.() === shape.id
    const label = text
      ? createElement('div', {
          className: 'crew-rich-text',
          style: {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: props.align.startsWith('start')
              ? 'flex-start'
              : props.align.startsWith('end')
                ? 'flex-end'
                : 'center',
            justifyContent:
              props.verticalAlign === 'start' ? 'flex-start' : props.verticalAlign === 'end' ? 'flex-end' : 'center',
            padding: 8,
            color: shapeColor(this.editor, props.labelColor),
            fontFamily: FONT_FAMILIES[props.font],
            fontSize: LABEL_FONT_SIZES[props.size] * props.scale,
            whiteSpace: 'pre-wrap',
            textAlign: props.align.startsWith('end') ? 'right' : props.align.startsWith('middle') ? 'center' : 'left',
            pointerEvents: 'all',
            visibility: editing ? 'hidden' : undefined
          },
          dangerouslySetInnerHTML: { __html: richTextToHtml(props.richText as RichTextDocument) }
        })
      : null
    return createElement(
      'div',
      { style: { position: 'relative', width: props.w, height: props.h + props.growY } },
      shapeElement(geometry.toSimpleSvgPath(), {
        editor: this.editor,
        color: props.color,
        fill: fillFor(this.editor, shape),
        width: STROKES[props.size] * props.scale
      }),
      label
    )
  }
}
