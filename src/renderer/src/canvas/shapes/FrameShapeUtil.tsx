import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d, type Geometry2d } from '../geometry'
import type { Vec } from '../math/Vec'
import { frameShapeProps, type TLShape as CrewShape } from '../schema'
import { BaseBoxShapeUtil } from './ShapeUtil'
import { boxPath, shapeElement } from './shared'
import { shapeColor } from './theme'

export type FrameShape = CrewShape<'frame'>

const HEADING_FONT_SIZE = 12
const HEADING_HEIGHT = 20
const HEADING_GAP = 4
const MAX_HEADING_SCALE = 3.5

export const ZOOM_VAR = '--crew-zoom'
export const SCALE_VAR = '--crew-scale'

function headingWidth(name: string): number {
  return name.length * HEADING_FONT_SIZE * 0.58
}

export class FrameShapeUtil extends BaseBoxShapeUtil<FrameShape> {
  static override type = 'frame' as const
  static override props = frameShapeProps

  override options = { resizeChildren: false, getCustomDisplayValues: () => ({}) }

  getDefaultProps(): FrameShape['props'] {
    return { w: 320, h: 180, name: '', color: 'black' }
  }
  getGeometry(shape: FrameShape): Geometry2d {
    const body = new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false })
    if (!shape.props.name) return body
    const width = Math.min(shape.props.w, headingWidth(shape.props.name))
    return new Group2d({
      children: [
        body,
        new Rectangle2d({
          x: 0,
          y: -(HEADING_HEIGHT + HEADING_GAP),
          width: Math.max(1, width),
          height: HEADING_HEIGHT,
          isFilled: true,
          isLabel: true,
          excludeFromShapeBounds: true
        })
      ]
    })
  }
  override getClipPath(shape: FrameShape): Vec[] | undefined {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false }).vertices
  }
  override canEdit(): boolean {
    return true
  }
  override canResizeChildren(): boolean {
    return this.options.resizeChildren
  }
  override isExportBoundsContainer(): boolean {
    return true
  }
  override isFrameLike(_shape: FrameShape): boolean {
    return true
  }
  override providesBackgroundForChildren(_shape: FrameShape): boolean {
    return true
  }
  override canReceiveNewChildrenOfType(shape: FrameShape): boolean {
    return !shape.isLocked
  }
  override canRemoveChildrenOfType(shape: FrameShape): boolean {
    return !shape.isLocked
  }
  override getText(shape: FrameShape): string {
    return shape.props.name
  }
  override getAriaDescriptor(shape: FrameShape): string {
    return shape.props.name
  }
  component(shape: FrameShape): ReactNode {
    const configured = this.options.getCustomDisplayValues as (
      editor: unknown,
      shape: FrameShape
    ) => { fillColor?: string; strokeColor?: string }
    const values = configured(this.editor, shape)
    const stroke = values.strokeColor ?? shapeColor(this.editor, shape.props.color, 'frameStroke')
    const frame = shapeElement(boxPath(shape.props.w, shape.props.h), {
      editor: this.editor,
      color: shape.props.color,
      stroke,
      fill: values.fillColor ?? shapeColor(this.editor, shape.props.color, 'frameFill'),
      width: 1
    })
    return createElement(
      'div',
      { style: { position: 'relative', width: shape.props.w, height: shape.props.h, color: stroke } },
      frame,
      shape.props.name &&
        createElement(
          'div',
          {
            className: 'crew-frame-heading',
            style: {
              position: 'absolute',
              bottom: '100%',
              left: 0,
              maxWidth: `calc(var(${ZOOM_VAR}, 1) * ${Math.ceil(shape.props.w)}px)`,
              transformOrigin: '0% 100%',
              transform: `scale(min(var(${SCALE_VAR}, 1), ${MAX_HEADING_SCALE}))`,
              paddingBottom: HEADING_GAP,
              fontSize: HEADING_FONT_SIZE,
              lineHeight: `${HEADING_HEIGHT}px`,
              color: stroke,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'all'
            }
          },
          shape.props.name
        )
    )
  }
}
