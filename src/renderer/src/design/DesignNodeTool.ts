import { BaseBoxShapeTool } from 'tldraw'

export class DesignNodeTool extends BaseBoxShapeTool {
  static override id = 'design-node'
  static override initial = 'idle'
  override shapeType = 'design-node'
}
