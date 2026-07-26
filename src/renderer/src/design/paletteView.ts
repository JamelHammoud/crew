import type { Editor, TLShape } from 'tldraw'
import { BASE_TYPE, type Stroke, type TypeStyle } from '../../../shared/designNode'
import {
  alignOf,
  dashStyle,
  familyOf,
  fontSize,
  labelAlign,
  labelVertical,
  nearestColor,
  paletteHex,
  sizeFont,
  sizeWeight,
  styleDash,
  verticalOf,
  weightSize
} from './palette'
import { emptyView, type NodeView } from './nodeView'

export function paletteView(editor: Editor, shape: TLShape): NodeView {
  const props = shape.props as Record<string, unknown>
  const has = (key: string) => key in props
  const view = emptyView(shape.id)
  const patch = (next: Record<string, unknown>) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: shape.type, props: next })
  }

  if (!has('color')) return view
  const hex = paletteHex(editor, props.color)
  const labelled = has('richText') || has('text')
  const paints = has('fill')

  if (paints) {
    const filled = props.fill !== 'none'
    view.fills = {
      items: filled ? [{ type: 'solid', color: hex, opacity: 1, visible: true }] : [],
      set: (_at, paint) => paint.type === 'solid' && patch({ color: nearestColor(editor, paint.color) }),
      add: filled ? undefined : () => patch({ fill: 'fill' }),
      remove: filled ? () => patch({ fill: 'none' }) : undefined,
      opacity: false,
      hide: false
    }
  } else if (labelled) {
    view.fills = {
      items: [{ type: 'solid', color: hex, opacity: 1, visible: true }],
      set: (_at, paint) => paint.type === 'solid' && patch({ color: nearestColor(editor, paint.color) }),
      opacity: false,
      hide: false
    }
  }

  if (has('dash')) {
    view.strokes = {
      items: [
        {
          color: hex,
          weight: sizeWeight(props.size),
          align: 'center',
          style: dashStyle(props.dash),
          visible: true
        }
      ],
      set: (_at, next) => {
        const out: Record<string, unknown> = {}
        if (next.color !== undefined) out.color = nearestColor(editor, next.color)
        if (next.weight !== undefined) out.size = weightSize(next.weight)
        if (next.style !== undefined) out.dash = styleDash(next.style as Stroke['style'])
        if (Object.keys(out).length > 0) patch(out)
      },
      position: false,
      hide: false
    }
  }

  if (labelled) {
    const alignKey = has('textAlign') ? 'textAlign' : has('align') ? 'align' : null
    const colorKey = has('labelColor') ? 'labelColor' : paints ? null : 'color'
    const value: TypeStyle = {
      ...BASE_TYPE,
      family: familyOf(props.font),
      size: sizeFont(props.size),
      align: alignKey ? alignOf(props[alignKey]) : BASE_TYPE.align,
      vertical: verticalOf(props.verticalAlign),
      color: paletteHex(editor, colorKey ? props[colorKey] : props.color)
    }
    view.text = {
      value,
      set: next => {
        const out: Record<string, unknown> = {}
        if (next.size !== undefined) out.size = fontSize(next.size)
        if (next.family !== undefined) out.font = next.family
        if (next.align !== undefined && alignKey) out[alignKey] = labelAlign(next.align)
        if (next.vertical !== undefined && has('verticalAlign')) out.verticalAlign = labelVertical(next.vertical)
        if (next.color !== undefined && colorKey) out[colorKey] = nearestColor(editor, next.color)
        if (Object.keys(out).length > 0) patch(out)
      },
      fields: {
        size: has('size'),
        weight: false,
        family: has('font'),
        align: alignKey !== null,
        vertical: has('verticalAlign'),
        lineHeight: false,
        spacing: false,
        settings: false,
        color: colorKey !== null && colorKey !== 'color'
      }
    }
  }

  return view
}
