import { BaseBoxShapeTool, type TLShape } from 'tldraw'
import { corner, nodeDefaults, solid, type DesignNodeProps } from '../../../shared/designNode'

export interface NodePreset {
  id: string
  label: string
  props: Partial<DesignNodeProps>
}

export const NODE_PRESETS: NodePreset[] = [
  {
    id: 'node-frame',
    label: 'Frame',
    props: {
      name: 'Frame',
      fills: [solid('#141414')],
      strokes: [{ color: '#ffffff14', weight: 1, align: 'inside', style: 'solid' }],
      clip: true
    }
  },
  { id: 'node-box', label: 'Rectangle', props: { name: 'Rectangle', fills: [solid('#3b82f6')] } },
  {
    id: 'node-ellipse',
    label: 'Ellipse',
    props: { name: 'Ellipse', radius: corner(9999), fills: [solid('#3b82f6')] }
  },
  {
    id: 'node-text',
    label: 'Text',
    props: { name: 'Text', text: 'Text', h: 24, fills: [] }
  },
  {
    id: 'node-glass',
    label: 'Glass',
    props: {
      name: 'Glass',
      radius: corner(20),
      fills: [{ type: 'glass', tint: '#ffffff14', blur: 24, opacity: 1 }],
      strokes: [{ color: '#ffffff26', weight: 1, align: 'inside', style: 'solid' }]
    }
  }
]

export function nodeTool(preset: NodePreset) {
  return class extends BaseBoxShapeTool {
    static override id = preset.id
    static override initial = 'idle'
    override shapeType = 'design-node' as const

    override onCreate(shape: TLShape | null) {
      if (!shape) return
      this.editor.updateShape({
        id: shape.id,
        type: 'design-node',
        props: { ...nodeDefaults(), ...preset.props }
      })
      this.editor.setCurrentTool('select')
    }
  }
}

export const nodeTools = NODE_PRESETS.map(nodeTool)
