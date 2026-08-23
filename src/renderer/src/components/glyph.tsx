import { Children, Fragment, isValidElement, type ComponentType, type ReactNode } from 'react'
import { STROKE, wearWeight } from '../icons/keylines'

export type Glyph = ComponentType<{ className?: string; strokeWidth?: number }> & {
  element: (doc: Document, className?: string, strokeWidth?: number) => SVGSVGElement
}

const ATTRIBUTE: Record<string, string> = {
  className: 'class',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin'
}

function appendArt(doc: Document, parent: Element, node: ReactNode): void {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue
    if (child.type === Fragment) {
      appendArt(doc, parent, child.props.children as ReactNode)
      continue
    }
    if (typeof child.type !== 'string') continue
    const element = doc.createElementNS('http://www.w3.org/2000/svg', child.type)
    for (const [key, value] of Object.entries(child.props)) {
      if (key === 'children' || value === undefined || value === null || typeof value === 'function') continue
      element.setAttribute(ATTRIBUTE[key] ?? key, String(value))
    }
    appendArt(doc, element, child.props.children as ReactNode)
    parent.appendChild(element)
  }
}

// The weight a drawing carries is the weight it wants at 16, which is where
// nearly everything in the app is worn. Worn smaller or larger, the stroke is
// adjusted for it: a stroke does not scale with the icon, so the same number
// comes out spindly on a 12 and chunky on a 32. The size is read off the class
// the caller already writes, so no call site has to know any of this, and a
// strokeWidth of its own still wins.
export function glyph(art: ReactNode, weight = STROKE): Glyph {
  function CrewGlyph({ className = 'w-4 h-4', strokeWidth }: { className?: string; strokeWidth?: number }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth ?? wearWeight(weight, className)}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {art}
      </svg>
    )
  }
  CrewGlyph.element = (doc: Document, className = 'w-4 h-4', strokeWidth?: number) => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', String(strokeWidth ?? wearWeight(weight, className)))
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('class', className)
    appendArt(doc, svg, art)
    return svg
  }
  return CrewGlyph
}
