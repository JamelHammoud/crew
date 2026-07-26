// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import type { Editor } from 'tldraw'

const { default: SelectionOverlay } = await import('../src/renderer/src/design/SelectionOverlay')

const shape = {
  id: 'shape:card',
  type: 'design-node',
  rotation: 0,
  props: { w: 200, h: 160, radius: [12, 12, 12, 12] }
}

function editorIn(state: { active: boolean; editing?: string }): Editor {
  return {
    getEditingShapeId: () => state.editing ?? null,
    overlays: { getOverlayUtil: () => ({ isActive: () => state.active }) },
    getSelectedShapes: () => [shape],
    getSelectionPageBounds: () => ({ minX: 0, minY: 0, maxX: 200, maxY: 160, w: 200, h: 160 }),
    pageToViewport: (point: { x: number; y: number }) => point,
    getZoomLevel: () => 1,
    getCurrentTheme: () => ({ colors: { light: { selectionStroke: '#0d99ff' } } }),
    getColorMode: () => 'light'
  } as unknown as Editor
}

describe('design selection overlay', () => {
  it('shows the size and the corner radius handles while the selection is at rest', () => {
    const { container } = render(createElement(SelectionOverlay, { editor: editorIn({ active: true }) }))
    expect(container.textContent).toContain('200 × 160')
    expect(container.querySelectorAll('button')).toHaveLength(4)
  })

  it('hides them while the element is being moved', () => {
    const { container, rerender } = render(
      createElement(SelectionOverlay, { editor: editorIn({ active: true }) })
    )
    rerender(createElement(SelectionOverlay, { editor: editorIn({ active: false }) }))
    expect(container.textContent).not.toContain('200 × 160')
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('hides them while text is being edited', () => {
    const { container } = render(
      createElement(SelectionOverlay, { editor: editorIn({ active: true, editing: 'shape:card' }) })
    )
    expect(container.textContent).not.toContain('200 × 160')
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
