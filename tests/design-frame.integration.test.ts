import { describe, expect, it } from 'vitest'
import { FRAME_BACKGROUND, frameBackground, frameStroke, isLightFill } from '../src/renderer/src/design/frameFill'
import { applyDesignOps } from '../src/server/designops'
import { DESIGN_STYLE_DEFAULTS, type DesignDocument } from '../src/shared/design'

const PAGE = { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }

function freshDocument(): DesignDocument {
  return { store: { 'page:page': { ...PAGE } }, schema: null }
}

function propsOf(document: DesignDocument, id: string): Record<string, unknown> {
  return (document.store[id] as { props: Record<string, unknown> }).props
}

describe('frame background', () => {
  it('is white until someone picks another color', () => {
    expect(FRAME_BACKGROUND).toBe('#ffffff')
    expect(frameBackground(undefined)).toBe('#ffffff')
    expect(frameBackground({})).toBe('#ffffff')
    expect(frameBackground({ hidden: true })).toBe('#ffffff')
    expect(frameBackground({ background: 'ink-900' })).toBe('#ffffff')
    expect(frameBackground({ background: '' })).toBe('#ffffff')
  })

  it('keeps the color a frame was given', () => {
    expect(frameBackground({ background: '#141414' })).toBe('#141414')
    expect(frameBackground({ background: '#FFEE00' })).toBe('#ffee00')
    expect(frameBackground({ background: ' #0d0d0d ' })).toBe('#0d0d0d')
    expect(frameBackground({ background: '#fff' })).toBe('#fff')
    expect(frameBackground({ background: '#141414cc' })).toBe('#141414cc')
  })

  it('outlines a frame against its own background', () => {
    expect(isLightFill('#ffffff')).toBe(true)
    expect(isLightFill('#fff')).toBe(true)
    expect(isLightFill('#141414')).toBe(false)
    expect(frameStroke('#ffffff')).toBe('rgba(0, 0, 0, 0.14)')
    expect(frameStroke('#141414')).toBe('rgba(255, 255, 255, 0.16)')
  })
})

describe('canvas defaults', () => {
  it('draws straight and sans, never hand drawn', () => {
    expect(DESIGN_STYLE_DEFAULTS).toEqual({ font: 'sans', dash: 'solid', spline: 'line' })
  })

  it('gives agent shapes the same straight defaults', () => {
    const document = freshDocument()
    const applied = applyDesignOps(document, [
      { op: 'create', kind: 'rectangle', x: 0, y: 0, text: 'Card' },
      { op: 'create', kind: 'text', x: 0, y: 200, text: 'Heading' },
      { op: 'create', kind: 'note', x: 0, y: 300, text: 'Sticky' },
      { op: 'create', kind: 'arrow', x: 0, y: 400, endX: 200, endY: 400 },
      { op: 'create', kind: 'line', x: 0, y: 500, endX: 200, endY: 500 }
    ])
    const [rectangle, text, note, arrow, line] = applied.results.map(result => {
      expect(result.error).toBeUndefined()
      return propsOf(document, result.id!)
    })
    for (const props of [rectangle, text, note, arrow]) expect(props.font).toBe('sans')
    for (const props of [rectangle, arrow, line]) expect(props.dash).toBe('solid')
    expect(line.spline).toBe('line')
  })
})
