import { createElement, type ReactNode } from 'react'
import { Rectangle2d } from '../geometry'
import { frameShapeProps, type TLShape } from '../schema'
import { BaseBoxShapeUtil } from './ShapeUtil'
import { COLORS, boxPath, shapeElement } from './shared'

export type TLFrameShape = TLShape<'frame'>

export class FrameShapeUtil extends BaseBoxShapeUtil<TLFrameShape> {
  static override type = 'frame' as const
  static override props = frameShapeProps

  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLFrameShape['props'] { return { w: 320, h: 180, name: '', color: 'black' } }
  getGeometry(shape: TLFrameShape) { return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false }) }
  override isFrameLike(): boolean { return true }
  override providesBackgroundForChildren(): boolean { return true }
  override canReceiveNewChildrenOfType(): boolean { return true }
  override getAriaDescriptor(shape: TLFrameShape): string { return shape.props.name }
  component(shape: TLFrameShape): ReactNode {
    const configured = this.options.getCustomDisplayValues as ((editor: unknown, shape: TLFrameShape) => { fillColor?: string; strokeColor?: string })
    const values = configured(this.editor, shape)
    const stroke = values.strokeColor ?? COLORS[shape.props.color]
    const frame = shapeElement(boxPath(shape.props.w, shape.props.h), { color: shape.props.color, fill: values.fillColor ?? 'none', width: 1 })
    return createElement('div', { style: { position: 'relative', width: shape.props.w, height: shape.props.h, color: stroke } }, frame, shape.props.name && createElement('div', { style: { position: 'absolute', bottom: '100%', left: 0, paddingBottom: 4, fontSize: 12, color: stroke, whiteSpace: 'nowrap' } }, shape.props.name))
  }
}
