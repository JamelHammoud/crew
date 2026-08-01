// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, fromPlainText, type TLTextShape } from '../src/renderer/src/canvas/schema'
import { DesignTextUtil } from '../src/renderer/src/design/TextUtil'
import { setTextShapeType } from '../src/renderer/src/design/textType'

function board(): Editor {
  return new Editor({
    store: createTLStore({ id: 'design-text-spacing' }),
    shapeUtils: [DesignTextUtil],
    getContainer: () => document.body
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('letter spacing on a Design text shape', () => {
  it('remeasures the automatic width with the same spacing that is painted', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const characters = this.textContent?.length ?? 0
      const spacing = Number.parseFloat(this.style.letterSpacing) || 0
      const width = characters * 10 + Math.max(0, characters - 1) * spacing
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: 24,
        width,
        height: 24,
        toJSON: () => ({})
      }
    })

    const editor = board()
    const id = createShapeId('spaced-text')
    editor.createShape({
      id,
      type: 'text',
      props: { richText: fromPlainText('Crew'), autoSize: true, w: 8 },
      meta: { type: { spacing: 0 } }
    })
    const before = editor.getShapePageBounds(id)!.width
    const shape = editor.getShape<TLTextShape>(id)!

    setTextShapeType(editor, shape, { spacing: 4 })

    const updated = editor.getShape<TLTextShape>(id)!
    expect(updated.props.w).toBe(before + 12)
    expect(editor.getShapePageBounds(id)!.width).toBe(before + 12)
  })
})
