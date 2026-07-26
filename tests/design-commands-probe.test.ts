// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { corner, nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'

const { availableCommands, commandForKey, DESIGN_COMMANDS, runCommand } = await import(
  '../src/renderer/src/design/commands'
)
const { chordHint } = await import('../src/renderer/src/design/designKeys')
type Chord = Parameters<typeof chordHint>[0]

const chord = (keys: Chord) => ({
  key: keys.shift ? keys.key.toUpperCase() : keys.key,
  metaKey: !!keys.meta,
  shiftKey: !!keys.shift,
  ctrlKey: !!keys.ctrl
})
const { maskCandidate, maskOf, removeMask, useAsMask } = await import('../src/renderer/src/design/mask')
const { nodeOutline } = await import('../src/renderer/src/design/nodeShape')

const node = (id: string, props: Record<string, unknown> = {}): FakeShape => ({
  id,
  type: 'design-node',
  parentId: 'page:main',
  props: { ...nodeDefaults(), ...props }
})

function board(list: FakeShape[], ...selected: string[]) {
  const made = fakeBoard(list)
  made.select(...selected)
  const ctx = { editor: made.editor, point: { x: 40, y: 60 }, ask: () => {}, rename: () => {} }
  return { ...made, ctx }
}

const labels = (list: { label: string }[]) => list.map(command => command.label)

describe('design commands', () => {
  it('offers nothing that needs a selection when nothing is picked', () => {
    const { ctx } = board([node('shape:a')])
    const shown = labels(availableCommands(ctx))
    expect(shown).toContain('Select all')
    expect(shown).toContain('Zoom to fit')
    expect(shown).not.toContain('Ask an agent')
    expect(shown).not.toContain('Delete')
    expect(shown).not.toContain('Group selection')
  })

  it('offers grouping only once more than one thing is picked', () => {
    const one = board([node('shape:a'), node('shape:b')], 'shape:a')
    expect(labels(availableCommands(one.ctx))).not.toContain('Group selection')
    const two = board([node('shape:a'), node('shape:b')], 'shape:a', 'shape:b')
    expect(labels(availableCommands(two.ctx))).toContain('Group selection')
  })

  it('leaves out what the selection cannot do rather than greying it', () => {
    const { ctx } = board([node('shape:a')], 'shape:a')
    const shown = labels(availableCommands(ctx))
    expect(shown).toContain('Lock')
    expect(shown).not.toContain('Unlock')
    expect(shown).toContain('Hide')
    expect(shown).not.toContain('Show')
    expect(shown).toContain('Add auto layout')
    expect(shown).not.toContain('Remove auto layout')
  })

  it('turns Lock into Unlock once the shape is locked', () => {
    const { ctx, shapes } = board([node('shape:a')], 'shape:a')
    runCommand('lock', ctx)
    expect(shapes.get('shape:a')!.isLocked).toBe(true)
    const shown = labels(availableCommands(ctx))
    expect(shown).toContain('Unlock')
    expect(shown).not.toContain('Lock')
  })

  it('turns Hide into Show and back', () => {
    const { ctx, shapes } = board([node('shape:a')], 'shape:a')
    runCommand('hide', ctx)
    expect(shapes.get('shape:a')!.meta.hidden).toBe(true)
    expect(labels(availableCommands(ctx))).toContain('Show')
    runCommand('show', ctx)
    expect(shapes.get('shape:a')!.meta.hidden).toBe(false)
    expect(labels(availableCommands(ctx))).toContain('Hide')
  })

  it('pastes where the menu was opened', () => {
    const { ctx, calls } = board([node('shape:a')], 'shape:a')
    expect(labels(availableCommands(ctx))).not.toContain('Paste here')
    runCommand('copy', ctx)
    expect(labels(availableCommands(ctx))).toContain('Paste here')
    runCommand('paste', ctx)
    expect(calls).toContain('paste(40,60)')
  })

  it('wraps the selection in a frame and takes it in', () => {
    const { ctx, calls, shapes } = board([node('shape:a'), node('shape:b')], 'shape:a', 'shape:b')
    runCommand('frame', ctx)
    expect(calls).toContain('create(frame)')
    const frame = [...shapes.values()].find(shape => shape.type === 'frame')!
    expect(shapes.get('shape:a')!.parentId).toBe(frame.id)
    expect(shapes.get('shape:b')!.parentId).toBe(frame.id)
    expect(frame.props).toMatchObject({ w: 148, h: 248 })
  })

  it('adds and removes auto layout on the one node it applies to', () => {
    const { ctx, shapes } = board([node('shape:a')], 'shape:a')
    runCommand('auto-layout', ctx)
    expect((shapes.get('shape:a')!.props as { layout: { direction: string } }).layout.direction).toBe('column')
    expect(labels(availableCommands(ctx))).toContain('Remove auto layout')
    runCommand('remove-auto-layout', ctx)
    expect((shapes.get('shape:a')!.props as { layout: { direction: string } }).layout.direction).toBe('none')
  })

  it('carries a style from one node to the others', () => {
    const from = board(
      [node('shape:a', { fills: [{ type: 'solid', color: '#ff0000', opacity: 1, visible: true }] }), node('shape:b')],
      'shape:a'
    )
    expect(labels(availableCommands(from.ctx))).not.toContain('Paste properties')
    runCommand('copy-style', from.ctx)
    from.select('shape:b')
    expect(labels(availableCommands(from.ctx))).toContain('Paste properties')
    runCommand('paste-style', from.ctx)
    expect((from.shapes.get('shape:b')!.props as { fills: { color: string }[] }).fills[0].color).toBe('#ff0000')
  })

  it('leaves the style commands out for a shape that has no style of ours', () => {
    const { ctx } = board([{ id: 'shape:draw', type: 'draw', parentId: 'page:main' }], 'shape:draw')
    expect(labels(availableCommands(ctx))).not.toContain('Copy properties')
  })

  it('names every command once and gives each one a mark', () => {
    const ids = DESIGN_COMMANDS.map(command => command.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const command of DESIGN_COMMANDS) {
      expect(typeof command.Icon, command.id).toBe('function')
      expect(command.label.length, command.id).toBeGreaterThan(0)
    }
  })
})

const press = (init: Partial<KeyboardEventInit> & { key: string }) =>
  new KeyboardEvent('keydown', { ...init, cancelable: true })

describe('the shortcuts the menu names', () => {
  it('says the same thing the key does', () => {
    for (const command of DESIGN_COMMANDS) {
      if (!command.keys) continue
      expect(command.hint, command.id).toBe(chordHint(command.keys))
      expect(commandForKey(press(chord(command.keys)), board([node('shape:a')], 'shape:a').ctx), command.id).toBeTruthy()
    }
  })

  it('reaches the command the selection can actually do', () => {
    const { ctx, shapes } = board([node('shape:a')], 'shape:a')
    expect(commandForKey(press(chord({ key: 'l', meta: true, shift: true })), ctx)?.id).toBe('lock')
    runCommand('lock', ctx)
    expect(shapes.get('shape:a')!.isLocked).toBe(true)
    expect(commandForKey(press(chord({ key: 'l', meta: true, shift: true })), ctx)?.id).toBe('unlock')
  })

  it('takes no keystroke that is not its own', () => {
    const { ctx } = board([node('shape:a')], 'shape:a')
    expect(commandForKey(press({ key: 'a', metaKey: true }), ctx)).toBe(null)
    expect(commandForKey(press({ key: 'A', metaKey: true, shiftKey: true, altKey: true }), ctx)).toBe(null)
    expect(commandForKey(press({ key: 'A', shiftKey: true }), ctx)).toBe(null)
  })

  it('asks for nothing while a shape is being written in', () => {
    const made = board([node('shape:a')], 'shape:a')
    const ctx = { ...made.ctx, editor: { ...made.editor, getEditingShapeId: () => 'shape:a' } as never }
    expect(commandForKey(press(chord({ key: 'a', meta: true, shift: true })), ctx)).toBe(null)
  })
})

describe('design masks', () => {
  it('masks with the bottom of the selection and takes the rest in', () => {
    const { editor, shapes } = board([node('shape:under'), node('shape:over')], 'shape:over', 'shape:under')
    expect(maskCandidate(editor)!.id).toBe('shape:under')
    useAsMask(editor)
    expect(shapes.get('shape:under')!.props).toMatchObject({ mask: true, clip: true })
    expect(shapes.get('shape:over')!.parentId).toBe('shape:under')
  })

  it('will not mask a single shape or a mask that is already one', () => {
    const one = board([node('shape:a')], 'shape:a')
    expect(maskCandidate(one.editor)).toBe(null)
    const already = board([node('shape:m', { mask: true }), node('shape:b')], 'shape:m', 'shape:b')
    expect(maskCandidate(already.editor)).toBe(null)
  })

  it('finds the mask from anything inside it, and gives the children back', () => {
    const made = board([node('shape:under'), node('shape:over')], 'shape:over', 'shape:under')
    useAsMask(made.editor)
    made.select('shape:over')
    expect(maskOf(made.editor)!.id).toBe('shape:under')
    removeMask(made.editor)
    expect(made.shapes.get('shape:under')!.props).toMatchObject({ mask: false, clip: false })
    expect(made.shapes.get('shape:over')!.parentId).toBe('page:main')
  })

  it('only masks with a node, not with any old shape', () => {
    const { editor } = board(
      [{ id: 'shape:draw', type: 'draw', parentId: 'page:main' }, node('shape:over')],
      'shape:over',
      'shape:draw'
    )
    expect(maskCandidate(editor)).toBe(null)
  })
})

describe('node outlines', () => {
  it('squares off a rectangle with no radius', () => {
    expect(nodeOutline('rect', 100, 60, corner(0))).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 }
    ])
  })

  it('rounds the corners it is given and stays inside the box', () => {
    const points = nodeOutline('rect', 100, 60, [10, 10, 10, 10])
    expect(points.length).toBeGreaterThan(8)
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(-0.001)
      expect(point.x).toBeLessThanOrEqual(100.001)
      expect(point.y).toBeGreaterThanOrEqual(-0.001)
      expect(point.y).toBeLessThanOrEqual(60.001)
    }
    expect(points.some(point => point.x === 0 && point.y === 0)).toBe(false)
  })

  it('never lets a radius eat more than half the box', () => {
    const points = nodeOutline('rect', 40, 40, corner(999))
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(-0.001)
      expect(point.x).toBeLessThanOrEqual(40.001)
    }
  })

  it('rings an ellipse and traces a polygon', () => {
    const ring = nodeOutline('ellipse', 100, 50, corner(0))
    expect(ring.length).toBe(48)
    for (const point of ring) {
      const dx = (point.x - 50) / 50
      const dy = (point.y - 25) / 25
      expect(dx * dx + dy * dy).toBeCloseTo(1)
    }
    expect(nodeOutline('triangle', 100, 100, corner(0))).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ])
  })
})
