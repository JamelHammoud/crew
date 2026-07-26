// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { blockHandleOffset } from '../src/renderer/src/components/doc/blockAnchor'

const boxes = new WeakMap<Node, DOMRect>()
const lines = new WeakMap<Node, DOMRect[]>()

function rect(top: number, height: number): DOMRect {
  return { top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top } as DOMRect
}

Element.prototype.getBoundingClientRect = function () {
  return boxes.get(this) ?? rect(0, 0)
}

Range.prototype.getClientRects = function () {
  return (lines.get(this.startContainer) ?? []) as unknown as DOMRectList
}

function block(options: { height: number; content: number; line?: number }) {
  const outer = document.createElement('div')
  const content = document.createElement('div')
  content.className = 'bn-block-content'
  outer.append(content)
  boxes.set(outer, rect(100, options.height))
  boxes.set(content, rect(100, options.content))
  if (options.line) {
    const inline = document.createElement('span')
    inline.className = 'bn-inline-content'
    content.append(inline)
    lines.set(inline, [rect(104, options.line)])
  }
  return outer
}

describe('block handle offset', () => {
  it('centers on a block that is one line tall', () => {
    const paragraph = block({ height: 35, content: 35, line: 27 })
    expect(blockHandleOffset(paragraph)).toBe(6)
  })

  it('centers on a block with nothing to read, like a divider', () => {
    const divider = block({ height: 29, content: 29 })
    expect(blockHandleOffset(divider)).toBe(3)
  })

  it('stays on the first line when the text runs long', () => {
    const wrapped = block({ height: 116, content: 116, line: 27 })
    expect(blockHandleOffset(wrapped)).toBe(6)
  })

  it('sits near the top of a tall block rather than in the middle of it', () => {
    const image = block({ height: 308, content: 308 })
    expect(blockHandleOffset(image)).toBe(10)
  })

  it('follows the content down when the block opens with padding', () => {
    const heading = block({ height: 68, content: 68, line: 34 })
    boxes.set(heading.firstElementChild!, rect(100, 68))
    lines.set(heading.querySelector('.bn-inline-content')!, [rect(130, 34)])
    expect(blockHandleOffset(heading)).toBe(35)
  })

  it('never rides above the top of the block', () => {
    const empty = block({ height: 0, content: 0 })
    expect(blockHandleOffset(empty)).toBe(0)
  })
})
