import {
  Ellipse2d,
  HTMLContainer,
  Polygon2d,
  Rectangle2d,
  resizeBox,
  ShapeUtil,
  T,
  Vec,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import { nodeDefaults, nodeShapeOf, type DesignNodeProps } from '../../../shared/designNode'
import { nodeStyle, polygonFillStyle, polygonStyle, strokeDash, textBoxStyle, textStyle } from './nodeCss'
import { nodePolygon, polygonPath, type UnitPoint } from './nodeShape'
import { nextNodeName, nextNodeShape } from './nextShape'

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'design-node': DesignNodeProps
  }
}

export type DesignNodeShape = TLShape<'design-node'>

export class DesignNodeUtil extends ShapeUtil<DesignNodeShape> {
  static override type = 'design-node' as const

  static override props = {
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

  getDefaultProps(): DesignNodeProps {
    const shape = nextNodeShape()
    return { ...nodeDefaults(), shape, name: nextNodeName(shape) }
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
    const { w, h } = shape.props
    const kind = nodeShapeOf(shape.props.shape)
    if (kind === 'ellipse') return new Ellipse2d({ width: w, height: h, isFilled: true })
    const points = nodePolygon(kind)
    if (points) return new Polygon2d({ points: points.map(point => new Vec(point.x * w, point.y * h)), isFilled: true })
    return new Rectangle2d({ width: w, height: h, isFilled: true })
  }

  component(shape: DesignNodeShape) {
    const { props } = shape
    const points = nodePolygon(nodeShapeOf(props.shape))
    return (
      <HTMLContainer style={{ width: props.w, height: props.h, pointerEvents: 'all' }}>
        {points ? <PolygonNode shape={shape} points={points} /> : <BoxNode props={props} />}
      </HTMLContainer>
    )
  }

  getIndicatorPath(shape: DesignNodeShape) {
    const { w, h } = shape.props
    const kind = nodeShapeOf(shape.props.shape)
    const path = new Path2D()
    if (kind === 'ellipse') {
      path.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      return path
    }
    const points = nodePolygon(kind)
    if (points) return new Path2D(polygonPath(points, w, h))
    const [tl, tr, br, bl] = shape.props.radius
    path.roundRect(0, 0, w, h, [tl, tr, br, bl])
    return path
  }
}

function NodeText({ props, centered }: { props: DesignNodeProps; centered?: boolean }) {
  if (!props.text) return null
  loadFonts([props.type.family])
  return (
    <div
      style={{
        width: '100%',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...(centered ? { position: 'absolute', top: '50%', transform: 'translateY(-50%)' } : textBoxStyle(props.type)),
        ...textStyle(props.type)
      }}
    >
      {props.text}
    </div>
  )
}

function BoxNode({ props }: { props: DesignNodeProps }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', ...nodeStyle(props) }}>
      <NodeText props={props} />
    </div>
  )
}

function PolygonNode({ shape, points }: { shape: DesignNodeShape; points: UnitPoint[] }) {
  const props = shape.props
  const { w, h } = props
  const key = shape.id.replace(/[^a-zA-Z0-9]/g, '')
  const path = polygonPath(points, w, h)
  const strokes = props.strokes.filter(stroke => stroke.visible && stroke.weight > 0)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', ...polygonStyle(props) }}>
      <div style={{ position: 'absolute', inset: 0, ...polygonFillStyle(props, points) }} />
      {strokes.length > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <clipPath id={`node-in-${key}`}>
              <path d={path} />
            </clipPath>
            <mask id={`node-out-${key}`}>
              <rect x={-w} y={-h} width={w * 3} height={h * 3} fill="white" />
              <path d={path} fill="black" />
            </mask>
          </defs>
          {strokes.map((stroke, at) => (
            <path
              key={at}
              d={path}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.align === 'center' ? stroke.weight : stroke.weight * 2}
              strokeDasharray={strokeDash(stroke)}
              strokeLinecap={stroke.style === 'dotted' ? 'round' : 'butt'}
              strokeLinejoin="round"
              clipPath={stroke.align === 'inside' ? `url(#node-in-${key})` : undefined}
              mask={stroke.align === 'outside' ? `url(#node-out-${key})` : undefined}
            />
          ))}
        </svg>
      )}
      <NodeText props={props} centered />
    </div>
  )
}
