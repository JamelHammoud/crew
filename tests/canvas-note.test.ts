import { describe, expect, it } from 'vitest'
import { Group2d } from '../src/renderer/src/canvas/geometry'
import type { TLShape, TLShapeId } from '../src/renderer/src/canvas/schema'
import { NoteShapeUtil, type ShapeEditor } from '../src/renderer/src/canvas/shapes'
import { NOTE_SIZE, measureNoteLabel } from '../src/renderer/src/canvas/shapes/noteLabel'

const base = {
  typeName: 'shape' as const,
  x: 0,
  y: 0,
  rotation: 0,
  index: 'a1' as TLShape['index'],
  parentId: 'page:page' as TLShape['parentId'],
  isLocked: false,
  opacity: 1,
  meta: {}
}

function richText(text: string) {
  return {
    type: 'doc',
    content: text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [{ type: 'paragraph' }]
  }
}

function measuringEditor(lines: number, width = 120): ShapeEditor {
  return {
    textMeasure: {
      measureHtml: (html: string, options?: Record<string, unknown>) => {
        const fontSize = Number(options?.fontSize ?? 22)
        return html.includes('shrink')
          ? { w: width, h: Math.round(fontSize * 1.35) * lines, scrollWidth: width * 4 }
          : { w: width, h: Math.round(fontSize * 1.35) * lines }
      }
    }
  } as ShapeEditor
}

function note(props: Record<string, unknown> = {}, id = 'shape:note'): TLShape<'note'> {
  return {
    ...base,
    id: id as TLShapeId,
    type: 'note',
    props: {
      color: 'black',
      richText: richText(''),
      size: 'm',
      font: 'draw',
      align: 'middle',
      verticalAlign: 'middle',
      labelColor: 'black',
      growY: 0,
      fontSizeAdjustment: 1,
      url: '',
      scale: 1,
      textLastEditedBy: null,
      ...props
    }
  } as unknown as TLShape<'note'>
}

describe('a note grows to hold what is written on it', () => {
  it('leaves a note that fits at its own size', () => {
    const util = new NoteShapeUtil(measuringEditor(2))
    expect(util.onBeforeCreate(note({ richText: richText('two lines') }))).toBeUndefined()
  })

  it('grows by exactly what the label overflows by', () => {
    const util = new NoteShapeUtil(measuringEditor(6))
    const grown = util.onBeforeCreate(note({ richText: richText('a long note') }))
    expect(grown?.props.growY).toBe(6 * 30 + 32 - NOTE_SIZE)
  })

  it('shrinks back to nothing when the writing is taken off again', () => {
    const util = new NoteShapeUtil(measuringEditor(1))
    const emptied = util.onBeforeUpdate(
      note({ richText: richText('a long note'), growY: 120 }),
      note({ richText: richText(''), growY: 120 })
    )
    expect(emptied?.props.growY).toBe(0)
  })

  it('says nothing about a change that cannot move the label', () => {
    const util = new NoteShapeUtil(measuringEditor(2))
    const same = richText('two lines')
    expect(util.onBeforeUpdate(note({ richText: same }), note({ richText: same, color: 'red' }))).toBeUndefined()
  })

  it('measures again when the font or the size changes', () => {
    const util = new NoteShapeUtil(measuringEditor(6))
    const same = richText('a long note')
    const resized = util.onBeforeUpdate(note({ richText: same }), note({ richText: same, size: 'xl' }))
    expect(resized?.props.growY).toBeGreaterThan(0)
  })

  it('takes the writing height into the geometry the label box uses', () => {
    const util = new NoteShapeUtil(measuringEditor(6))
    const geometry = util.getGeometry(note({ richText: richText('a long note'), growY: 32 }))
    expect(geometry).toBeInstanceOf(Group2d)
    const label = (geometry as Group2d).children.find(child => child.isLabel)
    expect(label?.bounds.h).toBe(6 * 30 + 32)
    expect(label?.bounds.w).toBe(120 + 32)
  })

  it('puts the label box where the writing is aligned', () => {
    const util = new NoteShapeUtil(measuringEditor(1))
    const labelOf = (props: Record<string, unknown>) =>
      (util.getGeometry(note({ richText: richText('hello'), ...props })) as Group2d).children.find(
        child => child.isLabel
      )!.bounds
    expect(labelOf({ align: 'start', verticalAlign: 'start' })).toMatchObject({ x: 0, y: 0 })
    expect(labelOf({ align: 'end', verticalAlign: 'end' }).x).toBe(NOTE_SIZE - (120 + 32))
    expect(labelOf({ align: 'middle', verticalAlign: 'middle' }).x).toBe((NOTE_SIZE - (120 + 32)) / 2)
  })

  it('gives an empty note a label one line tall', () => {
    const size = measureNoteLabel(measuringEditor(1), {
      html: '',
      isEmpty: true,
      fontFamily: 'sans',
      fontSize: 22
    })
    expect(size).toEqual({ labelHeight: 30 + 32, labelWidth: 100, fontSizeAdjustment: 1 })
  })

  it('shrinks the writing rather than the note when a word will not fit', () => {
    const size = measureNoteLabel(measuringEditor(1), {
      html: 'shrink',
      isEmpty: false,
      fontFamily: 'sans',
      fontSize: 22
    })
    expect(size.fontSizeAdjustment).toBeLessThan(1)
    expect(size.fontSizeAdjustment).toBeCloseTo(14 / 22, 6)
  })
})

describe('the handles that add a note beside one', () => {
  it('stands one on each side at ordinary zoom', () => {
    const util = new NoteShapeUtil({ getZoomLevel: () => 1 } as ShapeEditor)
    const handles = util.getHandles(note())
    expect(handles.map(handle => handle.id)).toEqual(['top', 'right', 'bottom', 'left'])
    expect(handles.every(handle => handle.type === 'clone')).toBe(true)
    expect(handles[0]).toMatchObject({ x: 100, y: 0 })
    expect(handles[2]).toMatchObject({ x: 100, y: 200 })
  })

  it('keeps only the one below when the board is zoomed out', () => {
    const util = new NoteShapeUtil({ getZoomLevel: () => 0.3 } as ShapeEditor)
    expect(util.getHandles(note()).map(handle => handle.id)).toEqual(['bottom'])
  })

  it('draws none at all once they would be smaller than a target', () => {
    const util = new NoteShapeUtil({ getZoomLevel: () => 0.1 } as ShapeEditor)
    expect(util.getHandles(note())).toEqual([])
  })

  it('draws none for a finger', () => {
    const util = new NoteShapeUtil({
      getZoomLevel: () => 1,
      getInstanceState: () => ({ isCoarsePointer: true })
    } as ShapeEditor)
    expect(util.getHandles(note())).toEqual([])
  })

  it('follows a note that has grown', () => {
    const util = new NoteShapeUtil({ getZoomLevel: () => 1 } as ShapeEditor)
    const handles = util.getHandles(note({ growY: 60 }))
    expect(handles[2]).toMatchObject({ y: 260 })
    expect(handles[1]).toMatchObject({ x: 200, y: 130 })
  })
})

describe('what a note lets you do to it', () => {
  it('takes no drag on its corners and is not locked to a square', () => {
    const util = new NoteShapeUtil({} as ShapeEditor)
    expect(util.hideResizeHandles()).toBe(true)
    expect(util.isAspectRatioLocked()).toBe(false)
    expect(util.hideSelectionBoundsFg()).toBe(false)
    expect(util.canEdit()).toBe(true)
  })

  it('leaves itself alone when something tries to resize it', () => {
    const util = new NoteShapeUtil({} as ShapeEditor)
    const shape = note()
    expect(util.onResize(shape, { scaleX: 2, scaleY: 2 } as never)).toBe(shape)
  })

  it('scales instead of resizing once it is set up that way', () => {
    const Scaled = NoteShapeUtil.configure({ resizeMode: 'scale' })
    const util = new Scaled({} as ShapeEditor) as NoteShapeUtil
    expect(util.hideResizeHandles()).toBe(false)
    expect(util.isAspectRatioLocked()).toBe(true)
  })

  it('names whoever wrote on it last', () => {
    const util = new NoteShapeUtil({} as ShapeEditor)
    expect(util.getReferencedUserIds(note({ textLastEditedBy: 'user:1' }))).toEqual(['user:1'])
    expect(util.getReferencedUserIds(note())).toEqual([])
  })
})
