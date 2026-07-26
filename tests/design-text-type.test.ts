// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { DefaultColorStyle, type Editor, type TLShape, type TLTextShape } from 'tldraw'
import { describe, expect, it } from 'vitest'

const { paintColor, setTextShapeType, textShapeType, typePaint } = await import(
  '../src/renderer/src/design/textType'
)
const { viewOf } = await import('../src/renderer/src/design/useNodeView')
const { default: Inspector } = await import('../src/renderer/src/design/Inspector')

interface Edit {
  id: string
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

function hexOf(at: number): string {
  const part = (value: number) => Math.abs(value).toString(16).padStart(2, '0').slice(0, 2)
  return `#${part(at * 12)}00${part(200 - at * 12)}`
}

function fakeEditor(edits: Edit[]): Editor {
  const colors: Record<string, { solid: string }> = {}
  DefaultColorStyle.values.forEach((name, at) => {
    colors[name] = { solid: hexOf(at) }
  })
  return {
    markHistoryStoppingPoint: () => {},
    updateShape: (edit: Edit) => edits.push(edit),
    getCurrentTheme: () => ({ colors: { light: colors }, lineHeight: 1.35 }),
    getColorMode: () => 'light'
  } as unknown as Editor
}

function text(props: Record<string, unknown> = {}, meta: Record<string, unknown> = {}): TLTextShape {
  return {
    id: 'shape:text',
    type: 'text',
    meta,
    props: { color: DefaultColorStyle.values[3], size: 'm', font: 'sans', textAlign: 'start', ...props }
  } as unknown as TLTextShape
}

describe('type on a text shape', () => {
  it('reads the shape itself when nothing has been styled yet', () => {
    const type = textShapeType(fakeEditor([]), text())
    expect(type.family).toBe('sans')
    expect(type.size).toBe(24)
    expect(type.weight).toBe(400)
    expect(type.lineHeight).toBe(1.35)
    expect(type.align).toBe('left')
    expect(type.color).toBe(hexOf(3))
  })

  it('reads a hand drawn font as sans, because the canvas draws straight', () => {
    expect(textShapeType(fakeEditor([]), text({ font: 'draw' })).family).toBe('sans')
  })

  it('lets a stored style win, and still takes alignment from the shape', () => {
    const stored = { family: 'Inter', size: 48, weight: 700, spacing: 2, italic: true, align: 'left' }
    const type = textShapeType(fakeEditor([]), text({ textAlign: 'middle' }, { type: stored }))
    expect(type.family).toBe('Inter')
    expect(type.size).toBe(48)
    expect(type.weight).toBe(700)
    expect(type.spacing).toBe(2)
    expect(type.italic).toBe(true)
    expect(type.align).toBe('center')
  })

  it('keeps a style written before the newer fields existed', () => {
    const type = textShapeType(fakeEditor([]), text({}, { type: { family: 'Lora', size: 18 } }))
    expect(type.family).toBe('Lora')
    expect(type.decoration).toBe('none')
    expect(type.transform).toBe('none')
  })

  it('writes alignment where tldraw keeps it and the rest alongside', () => {
    const edits: Edit[] = []
    const shape = text({}, { hidden: true })
    setTextShapeType(fakeEditor(edits), shape, { family: 'Sora', size: 32, align: 'right' })
    expect(edits[0].props).toEqual({ textAlign: 'end' })
    const meta = edits[0].meta as { hidden: boolean; type: Record<string, unknown> }
    expect(meta.hidden).toBe(true)
    expect(meta.type.family).toBe('Sora')
    expect(meta.type.size).toBe(32)
    expect(meta.type).not.toHaveProperty('align')
  })

  it('hands the size change back as props so the box is measured again', () => {
    const edits: Edit[] = []
    setTextShapeType(fakeEditor(edits), text(), { size: 64 })
    expect(edits[0].props).toBeDefined()
  })

  it('carries text opacity in the color it stores', () => {
    expect(paintColor({ type: 'solid', color: '#ff0055', opacity: 1, visible: true })).toBe('#ff0055')
    expect(paintColor({ type: 'solid', color: '#ff0055', opacity: 0.5, visible: true })).toBe('#ff005580')
    const paint = typePaint({ ...textShapeType(fakeEditor([]), text()), color: '#ff005580' })
    expect(paint).toMatchObject({ type: 'solid', color: '#ff0055' })
    expect(Math.round(paint.opacity * 100)).toBe(50)
  })
})

describe('the panel a text shape gets', () => {
  function panelFor(shape: TLShape, edits: Edit[] = []) {
    const view = viewOf(fakeEditor(edits), shape)
    return render(createElement(Inspector, { view }))
  }

  it('offers typography and a fill, and nothing it cannot do', () => {
    const { container } = panelFor(text())
    const sections = [...container.querySelectorAll('h3')].map(heading => heading.textContent)
    expect(sections).toEqual(['Typography', 'Fill'])
  })

  it('offers the whole font list, not the three system faces', () => {
    const { container } = panelFor(text())
    expect(container.querySelector('button[aria-label="Font"]')?.textContent).toContain('System Sans')
    expect(container.querySelector('input[aria-label="Size"]')).not.toBeNull()
    expect(container.querySelector('input[aria-label="Line height"]')).not.toBeNull()
    expect(container.querySelector('input[aria-label="Letter spacing"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Type settings"]')).not.toBeNull()
  })

  it('shows the exact color of the text rather than the nearest palette one', () => {
    const { container } = panelFor(text({}, { type: { color: '#ff0055' } }))
    const hex = container.querySelector('input[aria-label="Hex"]') as HTMLInputElement
    expect(hex.value).toBe('#ff0055')
  })
})
