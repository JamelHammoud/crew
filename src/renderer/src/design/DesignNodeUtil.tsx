import {
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  ShapeUtil,
  T,
  type TLBaseShape,
  type TLResizeInfo
} from 'tldraw'
import { nodeDefaults, type DesignNodeProps } from '../../../shared/designNode'
import { nodeStyle, textStyle } from './nodeCss'

export type DesignNodeShape = TLBaseShape<'design-node', DesignNodeProps>

export class DesignNodeUtil extends ShapeUtil<DesignNodeShape> {
  static override type = 'design-node' as const

  static override props = {
    w: T.number,
    h: T.number,
    name: T.string,
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

  getDefaultProps(): DesignNodeProps {
    return nodeDefaults()
  }

  override canResize() {
    return true
  }

  override canEdit() {
    return true
  }

  override onResize(shape: DesignNodeShape, info: TLResizeInfo<DesignNodeShape>) {
    return resizeBox(shape, info)
  }

  getGeometry(shape: DesignNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: DesignNodeShape) {
    const { props } = shape
    return (
      <HTMLContainer style={{ width: props.w, height: props.h, pointerEvents: 'all' }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', ...nodeStyle(props) }}>
          {props.text && (
            <div
              style={{
                width: '100%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...textStyle(props.type)
              }}
            >
              {props.text}
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: DesignNodeShape) {
    const [tl, tr, br, bl] = shape.props.radius
    const radius = Math.max(tl, tr, br, bl)
    return <rect width={shape.props.w} height={shape.props.h} rx={radius} ry={radius} />
  }
}
