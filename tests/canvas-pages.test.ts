import { describe, expect, it } from 'vitest'
import { sortedPageShapes } from '../src/renderer/src/canvas/editor/pages'
import type { TLPageId, TLParentId, TLShape } from '../src/renderer/src/canvas/schema'

describe('canvas page ordering', () => {
  it('indexes parents once instead of scanning the board for every shape', () => {
    const pageId = 'page:page' as TLPageId
    let parentReads = 0
    const shapes = Array.from({ length: 2_000 }, (_, at) => {
      const shape = {
        id: `shape:${at}`,
        index: `a${String(at).padStart(5, '0')}`
      } as Record<string, unknown>
      Object.defineProperty(shape, 'parentId', {
        enumerable: true,
        get: () => {
          parentReads++
          return pageId as TLParentId
        }
      })
      return shape as unknown as TLShape
    })

    const sorted = sortedPageShapes(shapes, pageId)
    expect(sorted).toHaveLength(shapes.length)
    expect(sorted[0].id).toBe('shape:0')
    expect(sorted.at(-1)?.id).toBe('shape:1999')
    expect(parentReads).toBe(shapes.length)
  })
})
