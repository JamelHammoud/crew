import type { StateNodeEditor } from '../state'

export interface SelectEditor extends StateNodeEditor {
  [key: string]: any
}

export interface SelectPointerInfo {
  target: 'canvas' | 'shape' | 'selection' | 'handle' | 'overlay'
  shape?: any
  handle?: any
  overlay?: any
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  accelKey?: boolean
  phase?: string
  point?: any
  onInteractionEnd?: string | (() => void)
  [key: string]: any
}
