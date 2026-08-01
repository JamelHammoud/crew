import { copyAs, createShapeId, type Editor, type TLShape, type TLShapeId } from '../canvas'
import { holdsChildren, NO_LAYOUT, nodeShapeOf } from '../../../shared/designNode'
import type { Glyph } from '../components/glyph'
import { chordHint, keyIsTheBoards, matchesChord, type Chord } from './designKeys'
import {
  AutoLayoutGlyph,
  BackwardGlyph,
  DeselectGlyph,
  DuplicateGlyph,
  EyeGlyph,
  EyeOffGlyph,
  ForwardGlyph,
  FlipHorizontalGlyph,
  FlipVerticalGlyph,
  FrameGlyph,
  GroupGlyph,
  ImageGlyph,
  LockGlyph,
  MaskGlyph,
  PasteGlyph,
  RedoGlyph,
  RenameGlyph,
  RotateGlyph,
  SelectAllGlyph,
  SparkGlyph,
  StyleGlyph,
  ToBackGlyph,
  ToFrontGlyph,
  TrashGlyph,
  UndoGlyph,
  UngroupGlyph,
  UnlockGlyph,
  ZoomFitGlyph,
  ZoomOneGlyph,
  ZoomSelectionGlyph
} from './glyphs'
import { maskCandidate, maskOf, removeMask, useAsMask } from './mask'
import { canRename } from './tools'

export interface CommandContext {
  editor: Editor
  point: { x: number; y: number } | null
  ask: () => void
  rename: (shape: TLShape) => void
}

export type CommandGroup =
  | 'history'
  | 'agent'
  | 'clipboard'
  | 'order'
  | 'group'
  | 'transform'
  | 'state'
  | 'remove'
  | 'canvas'

export interface DesignCommand {
  id: string
  label: string
  hint?: string
  group: CommandGroup
  Icon: Glyph
  terms?: string
  keys?: Chord
  when: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext) => void
}

const ASK: Chord = { key: 'a', meta: true, shift: true }
const HIDE: Chord = { key: 'h', meta: true, shift: true }
const LOCK: Chord = { key: 'l', meta: true, shift: true }
const MASK: Chord = { key: 'm', meta: true, ctrl: true }
const UNDO: Chord = { key: 'z', meta: true }
const REDO: Chord = { key: 'z', meta: true, shift: true }
const COPY: Chord = { key: 'c', meta: true }
const PASTE: Chord = { key: 'v', meta: true }
const COPY_PNG: Chord = { key: 'c', meta: true, shift: true }
const COPY_STYLE: Chord = { key: 'c', meta: true, alt: true }
const PASTE_STYLE: Chord = { key: 'v', meta: true, alt: true }
const DUPLICATE: Chord = { key: 'd', meta: true }
const TO_FRONT: Chord = { key: ']' }
const FORWARD: Chord = { key: ']', meta: true }
const BACKWARD: Chord = { key: '[', meta: true }
const TO_BACK: Chord = { key: '[' }
const GROUP: Chord = { key: 'g', meta: true }
const UNGROUP: Chord = { key: 'g', meta: true, shift: true }
const FRAME: Chord = { key: 'g', meta: true, alt: true }
const LAYOUT: Chord = { key: 'a', shift: true }
const NO_LAYOUT_KEY: Chord = { key: 'a', shift: true, alt: true }
const DELETE: Chord = { key: 'backspace' }
const SELECT_ALL: Chord = { key: 'a', meta: true }
const ZOOM_FIT: Chord = { key: '1', shift: true }
const ZOOM_SELECTION: Chord = { key: '2', shift: true }
const ZOOM_ONE: Chord = { key: '0', shift: true }

let held: ReturnType<Editor['getContentFromCurrentPage']> | undefined

const STYLE_KEYS = ['fills', 'strokes', 'effects', 'radius', 'type', 'blend'] as const

let heldStyle: Record<string, unknown> | null = null

const selection = (editor: Editor): TLShape[] => editor.getSelectedShapes()

const some = (ctx: CommandContext): boolean => selection(ctx.editor).length > 0

const many = (ctx: CommandContext): boolean => selection(ctx.editor).length > 1

const only = (ctx: CommandContext): TLShape | null => {
  const shapes = selection(ctx.editor)
  return shapes.length === 1 ? shapes[0] : null
}

const ids = (editor: Editor): TLShapeId[] => editor.getSelectedShapeIds()

function hidden(shape: TLShape): boolean {
  return shape.meta.hidden === true
}

function setHidden(editor: Editor, shapes: TLShape[], value: boolean): void {
  editor.run(() => {
    editor.markHistoryStoppingPoint(value ? 'hide' : 'show')
    for (const shape of shapes) editor.updateShape({ id: shape.id, type: shape.type, meta: { hidden: value } })
  })
}

function layoutNode(ctx: CommandContext): TLShape | null {
  const shape = only(ctx)
  if (!shape || shape.type !== 'design-node') return null
  return holdsChildren(nodeShapeOf((shape.props as { shape: unknown }).shape)) ? shape : null
}

function hasLayout(shape: TLShape): boolean {
  return (shape.props as { layout?: { direction?: string } }).layout?.direction !== 'none'
}

function groups(ctx: CommandContext): TLShape[] {
  return selection(ctx.editor).filter(shape => shape.type === 'group')
}

function locked(ctx: CommandContext): TLShape[] {
  return selection(ctx.editor).filter(shape => shape.isLocked)
}

function lockedOnPage(editor: Editor): TLShapeId[] {
  return editor
    .getCurrentPageShapes()
    .filter(shape => shape.isLocked)
    .map(shape => shape.id)
}

function rotate(editor: Editor): void {
  editor.run(() => {
    editor.markHistoryStoppingPoint('rotate')
    editor.rotateShapesBy(ids(editor), Math.PI / 2)
  })
}

export const DESIGN_COMMANDS: DesignCommand[] = [
  {
    id: 'undo',
    label: 'Undo',
    hint: chordHint(UNDO),
    group: 'history',
    Icon: UndoGlyph,
    terms: 'back step',
    keys: UNDO,
    when: ctx => ctx.editor.getCanUndo(),
    run: ctx => ctx.editor.undo()
  },
  {
    id: 'redo',
    label: 'Redo',
    hint: chordHint(REDO),
    group: 'history',
    Icon: RedoGlyph,
    terms: 'forward again',
    keys: REDO,
    when: ctx => ctx.editor.getCanRedo(),
    run: ctx => ctx.editor.redo()
  },
  {
    id: 'ask',
    label: 'Ask an agent',
    hint: chordHint(ASK),
    group: 'agent',
    Icon: SparkGlyph,
    terms: 'ai change edit prompt chat',
    keys: ASK,
    when: some,
    run: ctx => ctx.ask()
  },
  {
    id: 'copy',
    label: 'Copy',
    hint: chordHint(COPY),
    group: 'clipboard',
    Icon: DuplicateGlyph,
    keys: COPY,
    when: some,
    run: ctx => {
      held = ctx.editor.getContentFromCurrentPage(ids(ctx.editor))
    }
  },
  {
    id: 'paste',
    label: 'Paste here',
    hint: chordHint(PASTE),
    group: 'clipboard',
    Icon: PasteGlyph,
    keys: PASTE,
    when: () => held !== undefined,
    run: ctx => {
      if (!held) return
      ctx.editor.markHistoryStoppingPoint('paste')
      ctx.editor.putContentOntoCurrentPage(held, { point: ctx.point ?? undefined, select: true })
    }
  },
  {
    id: 'copy-png',
    label: 'Copy as PNG',
    hint: chordHint(COPY_PNG),
    group: 'clipboard',
    Icon: ImageGlyph,
    terms: 'image export',
    keys: COPY_PNG,
    when: some,
    run: ctx => void copyAs(ctx.editor, ids(ctx.editor), { format: 'png' }).catch(() => {})
  },
  {
    id: 'copy-svg',
    label: 'Copy as SVG',
    group: 'clipboard',
    Icon: ImageGlyph,
    terms: 'vector export',
    when: some,
    run: ctx => void copyAs(ctx.editor, ids(ctx.editor), { format: 'svg' }).catch(() => {})
  },
  {
    id: 'copy-style',
    label: 'Copy properties',
    hint: chordHint(COPY_STYLE),
    group: 'clipboard',
    Icon: StyleGlyph,
    terms: 'style fill stroke',
    keys: COPY_STYLE,
    when: ctx => only(ctx)?.type === 'design-node',
    run: ctx => {
      const shape = only(ctx)
      if (!shape) return
      const props = shape.props as Record<string, unknown>
      heldStyle = Object.fromEntries(STYLE_KEYS.filter(key => key in props).map(key => [key, props[key]]))
    }
  },
  {
    id: 'paste-style',
    label: 'Paste properties',
    hint: chordHint(PASTE_STYLE),
    group: 'clipboard',
    Icon: StyleGlyph,
    terms: 'style fill stroke',
    keys: PASTE_STYLE,
    when: ctx => heldStyle !== null && selection(ctx.editor).some(shape => shape.type === 'design-node'),
    run: ctx => {
      if (!heldStyle) return
      ctx.editor.run(() => {
        ctx.editor.markHistoryStoppingPoint('paste properties')
        for (const shape of selection(ctx.editor)) {
          if (shape.type !== 'design-node') continue
          ctx.editor.updateShape({ id: shape.id, type: 'design-node', props: { ...heldStyle } })
        }
      })
    }
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    hint: chordHint(DUPLICATE),
    group: 'clipboard',
    Icon: DuplicateGlyph,
    keys: DUPLICATE,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('duplicate')
      ctx.editor.duplicateShapes(ids(ctx.editor), { x: 20, y: 20 })
    }
  },
  {
    id: 'to-front',
    label: 'Bring to front',
    hint: chordHint(TO_FRONT),
    group: 'order',
    Icon: ToFrontGlyph,
    keys: TO_FRONT,
    when: some,
    run: ctx => ctx.editor.bringToFront(ids(ctx.editor))
  },
  {
    id: 'forward',
    label: 'Bring forward',
    hint: chordHint(FORWARD),
    group: 'order',
    Icon: ForwardGlyph,
    keys: FORWARD,
    when: some,
    run: ctx => ctx.editor.bringForward(ids(ctx.editor))
  },
  {
    id: 'backward',
    label: 'Send backward',
    hint: chordHint(BACKWARD),
    group: 'order',
    Icon: BackwardGlyph,
    keys: BACKWARD,
    when: some,
    run: ctx => ctx.editor.sendBackward(ids(ctx.editor))
  },
  {
    id: 'to-back',
    label: 'Send to back',
    hint: chordHint(TO_BACK),
    group: 'order',
    Icon: ToBackGlyph,
    keys: TO_BACK,
    when: some,
    run: ctx => ctx.editor.sendToBack(ids(ctx.editor))
  },
  {
    id: 'group',
    label: 'Group selection',
    hint: chordHint(GROUP),
    group: 'group',
    Icon: GroupGlyph,
    keys: GROUP,
    when: many,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('group')
      ctx.editor.groupShapes(ids(ctx.editor))
    }
  },
  {
    id: 'ungroup',
    label: 'Ungroup',
    hint: chordHint(UNGROUP),
    group: 'group',
    Icon: UngroupGlyph,
    keys: UNGROUP,
    when: ctx => groups(ctx).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('ungroup')
      ctx.editor.ungroupShapes(groups(ctx).map(shape => shape.id))
    }
  },
  {
    id: 'frame',
    label: 'Frame selection',
    hint: chordHint(FRAME),
    group: 'group',
    Icon: FrameGlyph,
    terms: 'wrap container',
    keys: FRAME,
    when: some,
    run: ctx => frameSelection(ctx.editor)
  },
  {
    id: 'auto-layout',
    label: 'Add auto layout',
    hint: chordHint(LAYOUT),
    group: 'group',
    Icon: AutoLayoutGlyph,
    terms: 'stack flex',
    keys: LAYOUT,
    when: ctx => {
      const node = layoutNode(ctx)
      return node !== null && !hasLayout(node)
    },
    run: ctx => {
      const node = layoutNode(ctx)
      if (!node) return
      ctx.editor.markHistoryStoppingPoint('auto layout')
      ctx.editor.updateShape({
        id: node.id,
        type: 'design-node',
        props: { layout: { ...NO_LAYOUT, direction: 'column', gap: 8, padding: [8, 8, 8, 8] } }
      })
    }
  },
  {
    id: 'remove-auto-layout',
    label: 'Remove auto layout',
    hint: chordHint(NO_LAYOUT_KEY),
    group: 'group',
    Icon: AutoLayoutGlyph,
    keys: NO_LAYOUT_KEY,
    when: ctx => {
      const node = layoutNode(ctx)
      return node !== null && hasLayout(node)
    },
    run: ctx => {
      const node = layoutNode(ctx)
      if (!node) return
      ctx.editor.markHistoryStoppingPoint('remove auto layout')
      ctx.editor.updateShape({ id: node.id, type: 'design-node', props: { layout: { ...NO_LAYOUT } } })
    }
  },
  {
    id: 'mask',
    label: 'Use as mask',
    hint: chordHint(MASK),
    group: 'group',
    Icon: MaskGlyph,
    terms: 'clip crop',
    keys: MASK,
    when: ctx => maskCandidate(ctx.editor) !== null,
    run: ctx => useAsMask(ctx.editor)
  },
  {
    id: 'unmask',
    label: 'Remove mask',
    hint: chordHint(MASK),
    group: 'group',
    Icon: MaskGlyph,
    terms: 'clip crop',
    keys: MASK,
    when: ctx => maskOf(ctx.editor) !== null,
    run: ctx => removeMask(ctx.editor)
  },
  {
    id: 'flip-h',
    label: 'Flip horizontal',
    group: 'transform',
    Icon: FlipHorizontalGlyph,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('flip')
      ctx.editor.flipShapes(ids(ctx.editor), 'horizontal')
    }
  },
  {
    id: 'flip-v',
    label: 'Flip vertical',
    group: 'transform',
    Icon: FlipVerticalGlyph,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('flip')
      ctx.editor.flipShapes(ids(ctx.editor), 'vertical')
    }
  },
  {
    id: 'rotate',
    label: 'Rotate 90°',
    group: 'transform',
    Icon: RotateGlyph,
    terms: 'turn',
    when: some,
    run: ctx => rotate(ctx.editor)
  },
  {
    id: 'hide',
    label: 'Hide',
    hint: chordHint(HIDE),
    group: 'state',
    Icon: EyeOffGlyph,
    keys: HIDE,
    when: ctx => selection(ctx.editor).some(shape => !hidden(shape)),
    run: ctx => setHidden(ctx.editor, selection(ctx.editor), true)
  },
  {
    id: 'show',
    label: 'Show',
    hint: chordHint(HIDE),
    group: 'state',
    Icon: EyeGlyph,
    keys: HIDE,
    when: ctx => some(ctx) && selection(ctx.editor).every(shape => hidden(shape)),
    run: ctx => setHidden(ctx.editor, selection(ctx.editor), false)
  },
  {
    id: 'lock',
    label: 'Lock',
    hint: chordHint(LOCK),
    group: 'state',
    Icon: LockGlyph,
    keys: LOCK,
    when: ctx => selection(ctx.editor).some(shape => !shape.isLocked),
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('lock')
      ctx.editor.toggleLock(selection(ctx.editor).filter(shape => !shape.isLocked))
    }
  },
  {
    id: 'unlock',
    label: 'Unlock',
    hint: chordHint(LOCK),
    group: 'state',
    Icon: UnlockGlyph,
    keys: LOCK,
    when: ctx => locked(ctx).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('unlock')
      ctx.editor.toggleLock(locked(ctx))
    }
  },
  {
    id: 'rename',
    label: 'Rename',
    group: 'state',
    Icon: RenameGlyph,
    when: ctx => {
      const shape = only(ctx)
      return shape !== null && canRename(shape)
    },
    run: ctx => {
      const shape = only(ctx)
      if (shape) ctx.rename(shape)
    }
  },
  {
    id: 'delete',
    label: 'Delete',
    hint: chordHint(DELETE),
    group: 'remove',
    Icon: TrashGlyph,
    keys: DELETE,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('delete')
      ctx.editor.deleteShapes(ids(ctx.editor))
    }
  },
  {
    id: 'select-all',
    label: 'Select all',
    hint: chordHint(SELECT_ALL),
    group: 'canvas',
    Icon: SelectAllGlyph,
    keys: SELECT_ALL,
    when: () => true,
    run: ctx => ctx.editor.selectAll()
  },
  {
    id: 'select-none',
    label: 'Deselect',
    hint: 'Esc',
    group: 'canvas',
    Icon: DeselectGlyph,
    when: some,
    run: ctx => ctx.editor.selectNone()
  },
  {
    id: 'select-inverse',
    label: 'Select inverse',
    group: 'canvas',
    Icon: SelectAllGlyph,
    when: some,
    run: ctx => {
      const chosen = new Set(ids(ctx.editor))
      ctx.editor.setSelectedShapes(
        ctx.editor
          .getCurrentPageShapes()
          .filter(shape => !chosen.has(shape.id) && !shape.isLocked)
          .map(shape => shape.id)
      )
    }
  },
  {
    id: 'unlock-all',
    label: 'Unlock all',
    hint: chordHint(LOCK),
    group: 'canvas',
    Icon: UnlockGlyph,
    keys: LOCK,
    when: ctx => lockedOnPage(ctx.editor).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('unlock all')
      ctx.editor.toggleLock(lockedOnPage(ctx.editor))
    }
  },
  {
    id: 'zoom-fit',
    label: 'Zoom to fit',
    hint: chordHint(ZOOM_FIT),
    group: 'canvas',
    Icon: ZoomFitGlyph,
    keys: ZOOM_FIT,
    when: () => true,
    run: ctx => ctx.editor.zoomToFit({ animation: { duration: 180 } })
  },
  {
    id: 'zoom-selection',
    label: 'Zoom to selection',
    hint: chordHint(ZOOM_SELECTION),
    group: 'canvas',
    Icon: ZoomSelectionGlyph,
    keys: ZOOM_SELECTION,
    when: some,
    run: ctx => ctx.editor.zoomToSelection({ animation: { duration: 180 } })
  },
  {
    id: 'zoom-100',
    label: 'Zoom to 100%',
    hint: chordHint(ZOOM_ONE),
    group: 'canvas',
    Icon: ZoomOneGlyph,
    keys: ZOOM_ONE,
    when: () => true,
    run: ctx => ctx.editor.resetZoom()
  }
]

const BY_ID = new Map(DESIGN_COMMANDS.map(command => [command.id, command]))

export function runCommand(id: string, ctx: CommandContext): void {
  BY_ID.get(id)?.run(ctx)
}

export function availableCommands(ctx: CommandContext): DesignCommand[] {
  return DESIGN_COMMANDS.filter(command => command.when(ctx))
}

export function commandForKey(event: KeyboardEvent, ctx: CommandContext): DesignCommand | null {
  if (!keyIsTheBoards(event.target) || ctx.editor.getEditingShapeId()) return null
  return DESIGN_COMMANDS.find(command => command.keys && matchesChord(event, command.keys) && command.when(ctx)) ?? null
}

function frameSelection(editor: Editor): void {
  const shapes = editor.getSelectedShapes()
  if (shapes.length === 0) return
  const bounds = editor.getSelectionPageBounds()
  if (!bounds) return
  const pad = 24
  const id = createShapeId()
  editor.run(() => {
    editor.markHistoryStoppingPoint('frame selection')
    editor.createShape({
      id,
      type: 'frame',
      x: Math.round(bounds.minX - pad),
      y: Math.round(bounds.minY - pad),
      props: { w: Math.round(bounds.width + pad * 2), h: Math.round(bounds.height + pad * 2), name: 'Frame' }
    })
    editor.reparentShapes(
      shapes.map(shape => shape.id),
      id
    )
    editor.setSelectedShapes([id])
  })
}

export function shapesUnder(editor: Editor, point: { x: number; y: number }): TLShape[] {
  return editor
    .getShapesAtPoint(point, { hitInside: true, margin: 0 })
    .filter(shape => !shape.isLocked)
    .reverse()
}
