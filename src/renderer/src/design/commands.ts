import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { holdsChildren, NO_LAYOUT, nodeShapeOf } from '../../../shared/designNode'
import type { Glyph } from '../components/glyph'
import {
  ArrowGlyph,
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
  LockGlyph,
  MaskGlyph,
  PasteGlyph,
  RenameGlyph,
  RotateGlyph,
  SelectAllGlyph,
  SparkGlyph,
  ToBackGlyph,
  ToFrontGlyph,
  TrashGlyph,
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
  when: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext) => void
}

let held: ReturnType<Editor['getContentFromCurrentPage']> = undefined

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
    id: 'ask',
    label: 'Ask an agent',
    group: 'agent',
    Icon: SparkGlyph,
    terms: 'ai change edit prompt chat',
    when: some,
    run: ctx => ctx.ask()
  },
  {
    id: 'copy',
    label: 'Copy',
    hint: '⌘C',
    group: 'clipboard',
    Icon: DuplicateGlyph,
    when: some,
    run: ctx => {
      held = ctx.editor.getContentFromCurrentPage(ids(ctx.editor))
    }
  },
  {
    id: 'paste',
    label: 'Paste here',
    hint: '⌘V',
    group: 'clipboard',
    Icon: PasteGlyph,
    when: () => held !== undefined,
    run: ctx => {
      if (!held) return
      ctx.editor.markHistoryStoppingPoint('paste')
      ctx.editor.putContentOntoCurrentPage(held, { point: ctx.point ?? undefined, select: true })
    }
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    hint: '⌘D',
    group: 'clipboard',
    Icon: DuplicateGlyph,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('duplicate')
      ctx.editor.duplicateShapes(ids(ctx.editor), { x: 20, y: 20 })
    }
  },
  {
    id: 'to-front',
    label: 'Bring to front',
    hint: ']',
    group: 'order',
    Icon: ToFrontGlyph,
    when: some,
    run: ctx => ctx.editor.bringToFront(ids(ctx.editor))
  },
  {
    id: 'forward',
    label: 'Bring forward',
    hint: '⌘]',
    group: 'order',
    Icon: ForwardGlyph,
    when: some,
    run: ctx => ctx.editor.bringForward(ids(ctx.editor))
  },
  {
    id: 'backward',
    label: 'Send backward',
    hint: '⌘[',
    group: 'order',
    Icon: BackwardGlyph,
    when: some,
    run: ctx => ctx.editor.sendBackward(ids(ctx.editor))
  },
  {
    id: 'to-back',
    label: 'Send to back',
    hint: '[',
    group: 'order',
    Icon: ToBackGlyph,
    when: some,
    run: ctx => ctx.editor.sendToBack(ids(ctx.editor))
  },
  {
    id: 'group',
    label: 'Group selection',
    hint: '⌘G',
    group: 'group',
    Icon: GroupGlyph,
    when: many,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('group')
      ctx.editor.groupShapes(ids(ctx.editor))
    }
  },
  {
    id: 'ungroup',
    label: 'Ungroup',
    hint: '⌘⌫',
    group: 'group',
    Icon: UngroupGlyph,
    when: ctx => groups(ctx).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('ungroup')
      ctx.editor.ungroupShapes(groups(ctx).map(shape => shape.id))
    }
  },
  {
    id: 'frame',
    label: 'Frame selection',
    hint: '⌘⌥G',
    group: 'group',
    Icon: FrameGlyph,
    terms: 'wrap container',
    when: some,
    run: ctx => frameSelection(ctx.editor)
  },
  {
    id: 'auto-layout',
    label: 'Add auto layout',
    hint: '⇧A',
    group: 'group',
    Icon: AutoLayoutGlyph,
    terms: 'stack flex',
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
    hint: '⇧⌥A',
    group: 'group',
    Icon: AutoLayoutGlyph,
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
    hint: '⌃⌘M',
    group: 'group',
    Icon: MaskGlyph,
    terms: 'clip crop',
    when: ctx => maskCandidate(ctx.editor) !== null,
    run: ctx => useAsMask(ctx.editor)
  },
  {
    id: 'unmask',
    label: 'Remove mask',
    hint: '⌃⌘M',
    group: 'group',
    Icon: MaskGlyph,
    terms: 'clip crop',
    when: ctx => maskOf(ctx.editor) !== null,
    run: ctx => removeMask(ctx.editor)
  },
  {
    id: 'flip-h',
    label: 'Flip horizontal',
    hint: '⇧H',
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
    hint: '⇧V',
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
    hint: '⇧⌘H',
    group: 'state',
    Icon: EyeOffGlyph,
    when: ctx => selection(ctx.editor).some(shape => !hidden(shape)),
    run: ctx => setHidden(ctx.editor, selection(ctx.editor), true)
  },
  {
    id: 'show',
    label: 'Show',
    hint: '⇧⌘H',
    group: 'state',
    Icon: EyeGlyph,
    when: ctx => some(ctx) && selection(ctx.editor).every(shape => hidden(shape)),
    run: ctx => setHidden(ctx.editor, selection(ctx.editor), false)
  },
  {
    id: 'lock',
    label: 'Lock',
    hint: '⇧⌘L',
    group: 'state',
    Icon: LockGlyph,
    when: ctx => selection(ctx.editor).some(shape => !shape.isLocked),
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('lock')
      ctx.editor.toggleLock(selection(ctx.editor).filter(shape => !shape.isLocked))
    }
  },
  {
    id: 'unlock',
    label: 'Unlock',
    hint: '⇧⌘L',
    group: 'state',
    Icon: UnlockGlyph,
    when: ctx => locked(ctx).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('unlock')
      ctx.editor.toggleLock(locked(ctx))
    }
  },
  {
    id: 'rename',
    label: 'Rename',
    hint: '⌘R',
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
    hint: '⌫',
    group: 'remove',
    Icon: TrashGlyph,
    when: some,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('delete')
      ctx.editor.deleteShapes(ids(ctx.editor))
    }
  },
  {
    id: 'select-all',
    label: 'Select all',
    hint: '⌘A',
    group: 'canvas',
    Icon: SelectAllGlyph,
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
    hint: '⇧⌘L',
    group: 'canvas',
    Icon: UnlockGlyph,
    when: ctx => lockedOnPage(ctx.editor).length > 0,
    run: ctx => {
      ctx.editor.markHistoryStoppingPoint('unlock all')
      ctx.editor.toggleLock(lockedOnPage(ctx.editor))
    }
  },
  {
    id: 'zoom-fit',
    label: 'Zoom to fit',
    hint: '⇧1',
    group: 'canvas',
    Icon: ZoomFitGlyph,
    when: () => true,
    run: ctx => ctx.editor.zoomToFit({ animation: { duration: 180 } })
  },
  {
    id: 'zoom-selection',
    label: 'Zoom to selection',
    hint: '⇧2',
    group: 'canvas',
    Icon: ZoomSelectionGlyph,
    when: some,
    run: ctx => ctx.editor.zoomToSelection({ animation: { duration: 180 } })
  },
  {
    id: 'zoom-100',
    label: 'Zoom to 100%',
    hint: '⇧0',
    group: 'canvas',
    Icon: ZoomOneGlyph,
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

// A frame drawn round the selection, the way Figma wraps what you picked.
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

export { ArrowGlyph }
