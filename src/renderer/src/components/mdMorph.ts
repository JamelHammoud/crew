const WRAP = 'md-in'

type Slot = { texts: Text[] } | { node: Element }

const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE

const isWrap = (node: Node): boolean => isElement(node) && node.classList.contains(WRAP)

function slots(parent: Node): Slot[] {
  const out: Slot[] = []
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (isWrap(child)) walk(child)
      else if (isText(child)) {
        const last = out[out.length - 1]
        if (last && 'texts' in last) last.texts.push(child)
        else out.push({ texts: [child] })
      } else if (isElement(child)) out.push({ node: child })
    }
  }
  walk(parent)
  return out
}

const nodesOf = (slot: Slot): ChildNode[] => ('texts' in slot ? slot.texts : [slot.node])

function textOf(slot: Slot): string {
  return nodesOf(slot)
    .map(node => node.textContent ?? '')
    .join('')
}

function copyOf(slot: Slot): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const node of nodesOf(slot)) frag.appendChild(node.cloneNode(true))
  return frag
}

function unwrap(span: Element): void {
  const parent = span.parentNode
  if (!parent) return
  while (span.firstChild) parent.insertBefore(span.firstChild, span)
  span.remove()
  parent.normalize()
}

function wrapped(text: string): HTMLElement {
  const span = document.createElement('span')
  span.className = WRAP
  span.textContent = text
  span.addEventListener('animationend', () => unwrap(span), { once: true })
  return span
}

function fade(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (isText(child)) {
      if (child.data.trim()) child.replaceWith(wrapped(child.data))
    } else if (isElement(child)) fade(child)
  }
}

function outermost(node: ChildNode, root: Element): ChildNode {
  let at = node
  while (at.parentNode && at.parentNode !== root) at = at.parentNode as ChildNode
  return at
}

function patchText(texts: Text[], value: string, root: Element, animate: boolean): void {
  const current = texts.map(text => text.data).join('')
  if (current === value) return
  if (animate && current.length > 0 && value.startsWith(current)) {
    outermost(texts[texts.length - 1], root).after(wrapped(value.slice(current.length)))
    return
  }
  texts[0].data = value
  for (const extra of texts.slice(1)) extra.remove()
}

function patchAttrs(live: Element, next: Element): void {
  for (const attr of Array.from(next.attributes)) {
    if (live.getAttribute(attr.name) !== attr.value) live.setAttribute(attr.name, attr.value)
  }
  for (const attr of Array.from(live.attributes)) {
    if (!next.hasAttribute(attr.name)) live.removeAttribute(attr.name)
  }
}

function patch(live: Element, next: Element, animate: boolean): void {
  const here = slots(live)
  const there = slots(next)
  const shared = Math.min(here.length, there.length)

  for (let i = 0; i < shared; i++) {
    const a = here[i]
    const b = there[i]
    if ('texts' in a && 'texts' in b) {
      patchText(a.texts, textOf(b), live, animate)
    } else if ('node' in a && 'node' in b && a.node.tagName === b.node.tagName) {
      patchAttrs(a.node, b.node)
      patch(a.node, b.node, animate)
    } else {
      const nodes = nodesOf(a)
      nodes[0].replaceWith(copyOf(b))
      for (const extra of nodes.slice(1)) extra.remove()
    }
  }

  for (let i = shared; i < here.length; i++) {
    for (const node of nodesOf(here[i])) node.remove()
  }

  for (let i = shared; i < there.length; i++) {
    const added = copyOf(there[i])
    if (animate) fade(added)
    live.appendChild(added)
  }
}

export function morph(live: Element, html: string, animate: boolean): void {
  const next = document.createElement('div')
  next.innerHTML = html
  const grew = (next.textContent?.length ?? 0) > (live.textContent?.length ?? 0)
  patch(live, next, animate && grew)
  for (const span of Array.from(live.querySelectorAll(`.${WRAP}`))) {
    if (!span.firstChild) span.remove()
  }
}
