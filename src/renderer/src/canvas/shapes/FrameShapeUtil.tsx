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

export class FrameShapeUtil extends BaseBoxShapeUtil<FrameShape> {
  static override type = 'frame' as const
  static override props = frameShapeProps

  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): FrameShape['props'] {
    return { w: 320, h: 180, name: '', color: 'black' }
  }
  getGeometry(shape: FrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false })
  }
  override isFrameLike(_shape: FrameShape): boolean {
    return true
  }
  override providesBackgroundForChildren(_shape: FrameShape): boolean {
    return true
  }
  override canReceiveNewChildrenOfType(_shape: FrameShape): boolean {
    return true
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
            style: {
              position: 'absolute',
              bottom: '100%',
              left: 0,
              paddingBottom: 4,
              fontSize: 12,
              color: stroke,
              whiteSpace: 'nowrap'
            }
          },
          shape.props.name
        )
    )
  }
}
