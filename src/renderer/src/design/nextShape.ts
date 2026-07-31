import { atom } from '../canvas'
import { type NodeShape } from '../../../shared/designNode'

const LABELS: Record<NodeShape, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star'
}

const next = atom<NodeShape>('design next node shape', 'rect')

export function setNextNodeShape(shape: NodeShape): void {
  next.set(shape)
}

export function nextNodeShape(): NodeShape {
  return next.get()
}

export function nextNodeName(shape: NodeShape): string {
  return LABELS[shape]
}
