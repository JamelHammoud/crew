import { BaseBoxShapeTool } from '../canvas'

export class DesignNodeTool extends BaseBoxShapeTool {
  static override id = 'design-node'
  static override initial = 'idle'
  override shapeType = 'design-node' as const
}
