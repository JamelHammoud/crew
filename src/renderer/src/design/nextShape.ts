import { nodeShapeOf, type NodeShape } from '../../../shared/designNode'

const LABELS: Record<NodeShape, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star'
}

let next: NodeShape = 'rect'

export function setNextNodeShape(shape: NodeShape): void {
  next = shape
}

export function nextNodeShape(): NodeShape {
  return next
}

export function nextNodeName(shape: NodeShape): string {
  return LABELS[shape]
}

export function nodeShapeLabel(shape: unknown): string {
  return LABELS[nodeShapeOf(shape)]
}
