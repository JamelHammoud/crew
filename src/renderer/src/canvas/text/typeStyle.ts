import { isValidElement, type CSSProperties, type ReactNode } from 'react'

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

function styleOf(node: ReactNode): CSSProperties | null {
  if (!isValidElement(node)) return null
  const props = node.props as { style?: CSSProperties; children?: ReactNode }
  if (props.style) return props.style
  const children = Array.isArray(props.children) ? props.children : [props.children]
  for (const child of children) {
    const found = styleOf(child)
    if (found) return found
  }
  return null
}

export function paintedTypeStyle<Shape>(
  util: { component(shape: Shape): ReactNode },
  shape: Shape
): CSSProperties {
  try {
    return typeStyleOf(styleOf(util.component(shape)))
  } catch {
    return {}
  }
}
