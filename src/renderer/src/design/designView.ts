import type { Editor } from 'tldraw'
import { NEW_FILL, NEW_STROKE } from '../../../shared/design'
import { hasCorners, holdsChildren, nodeShapeOf, type DesignNodeProps } from '../../../shared/designNode'
import type { DesignNodeShape } from './DesignNodeUtil'
import type { NodeView } from './nodeView'

export function designView(editor: Editor, shape: DesignNodeShape): NodeView {
  const props = shape.props
  const kind = nodeShapeOf(props.shape)
  const patch = (next: Partial<DesignNodeProps>) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'design-node', props: { ...props, ...next } })
  }

  return {
    id: shape.id,
    fills: {
      items: props.fills,
      set: (at, paint) => patch({ fills: props.fills.map((fill, index) => (index === at ? paint : fill)) }),
      add: () => patch({ fills: [...props.fills, { type: 'solid', color: NEW_FILL, opacity: 1, visible: true }] }),
      remove: at => patch({ fills: props.fills.filter((_, index) => index !== at) }),
      opacity: true,
      hide: true
    },
    strokes: {
      items: props.strokes,
      set: (at, next) =>
        patch({ strokes: props.strokes.map((stroke, index) => (index === at ? { ...stroke, ...next } : stroke)) }),
      add: () =>
        patch({
          strokes: [...props.strokes, { color: NEW_STROKE, weight: 1, align: 'inside', style: 'solid', visible: true }]
        }),
      remove: at => patch({ strokes: props.strokes.filter((_, index) => index !== at) }),
      position: kind === 'rect' || kind === 'ellipse',
      hide: true
    },
    effects: {
      items: props.effects,
      set: (at, effect) => patch({ effects: props.effects.map((item, index) => (index === at ? effect : item)) }),
      add: () =>
        patch({
          effects: [
            ...props.effects,
            { type: 'shadow', x: 0, y: 8, blur: 24, spread: -4, color: '#00000059', visible: true }
          ]
        }),
      remove: at => patch({ effects: props.effects.filter((_, index) => index !== at) })
    },
    layout: holdsChildren(kind) ? { value: props.layout, set: next => patch({ layout: { ...props.layout, ...next } }) } : null,
    radius: hasCorners(kind) ? { value: props.radius, set: radius => patch({ radius }) } : null,
    text: props.text
      ? {
          value: props.type,
          set: next => patch({ type: { ...props.type, ...next } }),
          fields: { size: true, weight: true, family: true, align: true, color: true }
        }
      : null,
    blend: { value: props.blend, set: blend => patch({ blend }) },
    clip: holdsChildren(kind) ? { value: props.clip, set: clip => patch({ clip }) } : null
  }
}
