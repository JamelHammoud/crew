// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DefaultColorStyle, type Editor, type TLShape } from 'tldraw'
import { nodeDefaults, type NodeShape } from '../src/shared/designNode'

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
    getCurrentTheme: () => ({ colors: { light: colors } }),
    getColorMode: () => 'light'
  } as unknown as Editor
}

function node(shape: NodeShape, extra: Record<string, unknown> = {}): TLShape {
  return {
    id: 'shape:node',
    type: 'design-node',
    props: { ...nodeDefaults(), shape, ...extra }
  } as unknown as TLShape
}

function panelFor(shape: TLShape, edits: Edit[] = []) {
  const editor = fakeEditor(edits)
  const view = viewOf(editor, shape)
  return { view, ...render(createElement(Inspector, { view })) }
}

function sections(container: HTMLElement): string[] {
  return [...container.querySelectorAll('h3')].map(heading => heading.textContent ?? '')
}

describe('design panel', () => {
  it('gives a rectangle every section', () => {
    const { container } = panelFor(node('rect'))
    expect(sections(container)).toEqual(['Auto layout', 'Fill', 'Stroke', 'Effects'])
  })

  it('gives a triangle the same sections, minus the ones it cannot do', () => {
    const { container } = panelFor(node('triangle'))
    expect(sections(container)).toEqual(['Fill', 'Stroke', 'Effects'])
    expect(container.querySelector('input[aria-label="Hex"]')).not.toBeNull()
  })

  it('paints a triangle from the same hex field a rectangle uses', () => {
    const edits: Edit[] = []
    const { container } = panelFor(node('triangle', { fills: [{ type: 'solid', color: '#222222', opacity: 1, visible: true }] }), edits)
    const hex = container.querySelector('input[aria-label="Hex"]') as HTMLInputElement
    fireEvent.change(hex, { target: { value: '#ff0055' } })
    fireEvent.blur(hex)
    expect((edits[0].props as { fills: Array<{ color: string }> }).fills[0].color).toBe('#ff0055')
  })

  it('shows an older shape the same fill and stroke rows, and keeps its color to the palette', () => {
    const edits: Edit[] = []
    const shape = {
      id: 'shape:geo',
      type: 'geo',
      props: { color: DefaultColorStyle.values[2], fill: 'fill', dash: 'solid', size: 'm', geo: 'triangle' }
    } as unknown as TLShape
    const { container } = panelFor(shape, edits)
    expect(sections(container)).toEqual(['Fill', 'Stroke'])
    const hex = container.querySelector('input[aria-label="Hex"]') as HTMLInputElement
    expect(hex.value).toBe(hexOf(2))
    fireEvent.change(hex, { target: { value: hexOf(5) } })
    fireEvent.blur(hex)
    expect(edits[0].props).toEqual({ color: DefaultColorStyle.values[5] })
  })

  it('turns a stroke weight into the size an older shape understands', () => {
    const edits: Edit[] = []
    const shape = {
      id: 'shape:line',
      type: 'line',
      props: { color: DefaultColorStyle.values[0], dash: 'solid', size: 's' }
    } as unknown as TLShape
    const { view, container } = panelFor(shape, edits)
    expect(sections(container)).toEqual(['Stroke'])
    expect(view.strokes?.items[0].weight).toBe(2)
    view.strokes?.set(0, { weight: 6.5 })
    expect(edits[0].props).toEqual({ size: 'xl' })
  })

  it('shows text with the fields the shape supports', () => {
    const shape = {
      id: 'shape:text',
      type: 'text',
      props: { color: DefaultColorStyle.values[1], size: 'l', font: 'sans', textAlign: 'middle', richText: {} }
    } as unknown as TLShape
    const { view, container } = panelFor(shape)
    expect(sections(container)).toEqual(['Fill', 'Text'])
    expect(view.text?.value.size).toBe(36)
    expect(view.text?.value.align).toBe('center')
    expect(view.text?.fields.weight).toBe(false)
  })

  it('shows a frame its background and nothing it cannot hold', () => {
    const edits: Edit[] = []
    const frame = { id: 'shape:frame', type: 'frame', meta: { background: '#101010' }, props: { name: 'Home' } } as unknown as TLShape
    const { container } = panelFor(frame, edits)
    expect(sections(container)).toEqual(['Fill'])
    const hex = container.querySelector('input[aria-label="Hex"]') as HTMLInputElement
    expect(hex.value).toBe('#101010')
    fireEvent.change(hex, { target: { value: '#f5f5f5' } })
    fireEvent.blur(hex)
    expect(edits[0].meta).toEqual({ background: '#f5f5f5' })
  })

  it('leaves a picture alone rather than inventing fields for it', () => {
    const image = { id: 'shape:image', type: 'image', props: { w: 100, h: 100, url: '' } } as unknown as TLShape
    const { container } = panelFor(image)
    expect(sections(container)).toEqual([])
  })
})
