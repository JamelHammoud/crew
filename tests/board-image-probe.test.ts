// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import type { DesignDocument } from '../src/shared/design'

const { default: BoardImage } = await import('../src/renderer/src/components/BoardImage')

const schema = { schemaVersion: 2, sequences: {} }

const page = {
  'document:document': { id: 'document:document', typeName: 'document', gridSize: 10, name: '' },
  'page:page': { id: 'page:page', typeName: 'page', name: 'Page', index: 'a1', meta: {} }
}

function boardWith(records: Record<string, unknown>): DesignDocument {
  return { store: { ...page, ...records }, schema } as unknown as DesignDocument
}

const card = {
  'shape:card': {
    id: 'shape:card',
    typeName: 'shape',
    type: 'geo',
    parentId: 'page:page',
    index: 'a1',
    x: 0,
    y: 0,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      w: 100,
      h: 100,
      geo: 'rectangle',
      color: 'black',
      labelColor: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      font: 'draw',
      align: 'middle',
      verticalAlign: 'middle',
      growY: 0,
      url: '',
      scale: 1,
      richText: { type: 'doc', content: [] }
    }
  }
}

describe('board preview', () => {
  it('holds a skeleton over a board that has something to draw', () => {
    const { container } = render(createElement(BoardImage, { document: boardWith(card) }))
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('.skeleton')).not.toBeNull()
  })

  it('stands the skeleton down once the picture has painted', () => {
    const { container } = render(createElement(BoardImage, { document: boardWith(card) }))
    const image = container.querySelector('img')!
    image.dispatchEvent(new Event('load'))
    expect(container.querySelector('.skeleton')).toBeNull()
  })

  it('shimmers at nothing on a board with nothing on it', () => {
    const { container } = render(createElement(BoardImage, { document: boardWith({}) }))
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.skeleton')).toBeNull()
  })
})
