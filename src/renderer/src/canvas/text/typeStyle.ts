import { isValidElement, type CSSProperties, type ReactNode } from 'react'
import { resolveLineHeight } from './measurement'

const TYPE_PROPERTIES = [
  'color',
  'fontFamily',
  'fontFeatureSettings',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontVariationSettings',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textDecoration',
  'textTransform',
  'wordSpacing'
] as const satisfies ReadonlyArray<keyof CSSProperties>

export function typeStyleOf(style: CSSProperties | undefined | null): CSSProperties {
  if (!style) return {}
  const lifted: Record<string, unknown> = {}
  for (const property of TYPE_PROPERTIES) {
    const value = style[property]
    if (value !== undefined) lifted[property] = value
  }
  return lifted as CSSProperties
}

function gather(node: ReactNode, into: Record<string, unknown>): void {
  if (Array.isArray(node)) {
    for (const child of node) gather(child, into)
    return
  }
  if (!isValidElement(node)) return
  const props = node.props as { style?: CSSProperties; children?: ReactNode }
  Object.assign(into, typeStyleOf(props.style))
  gather(props.children, into)
}

export function paintedTypeStyle<Shape>(util: { component(shape: Shape): ReactNode }, shape: Shape): CSSProperties {
  const gathered: Record<string, unknown> = {}
  try {
    gather(util.component(shape), gathered)
  } catch {
    return {}
  }
  return gathered as CSSProperties
}
