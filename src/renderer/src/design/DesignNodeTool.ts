import { BaseBoxShapeTool } from '../canvas'

export class DesignNodeTool extends BaseBoxShapeTool {
  static override id = 'design-node'
  static override initial = 'idle' as const
  override shapeType = 'design-node' as const
}
