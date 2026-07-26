import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useEditor, type TLShape, type TLShapeId } from 'tldraw'
import {
  availableCommands,
  shapesUnder,
  type CommandContext,
  type CommandGroup,
  type DesignCommand
} from '../design/commands'
import { glyphForShape, LayersGlyph } from '../design/glyphs'
import { layerName } from '../design/tools'
import { MenuDivider, MenuItem, Popover, SubMenu } from './Popover'

const ORDER: CommandGroup[] = ['agent', 'clipboard', 'order', 'group', 'transform', 'state', 'remove', 'canvas']

export interface MenuSpot {
  screen: { x: number; y: number }
  page: { x: number; y: number }
}

export function useContextMenu(editor: ReturnType<typeof useEditor> | null): {
  spot: MenuSpot | null
  close: () => void
} {
  const [spot, setSpot] = useState<MenuSpot | null>(null)

  useEffect(() => {
    if (!editor) return
    const container = editor.getContainer()
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      const page = editor.screenToPage({ x: event.clientX, y: event.clientY })
      const under = shapesUnder(editor, page)[0]
      if (under && !editor.getSelectedShapeIds().includes(under.id)) editor.setSelectedShapes([under.id])
      if (!under && editor.getSelectedShapeIds().length > 0) editor.selectNone()
      setSpot({ screen: { x: event.clientX, y: event.clientY }, page })
    }
    container.addEventListener('contextmenu', onContextMenu)
    return () => container.removeEventListener('contextmenu', onContextMenu)
  }, [editor])

  return { spot, close: useCallback(() => setSpot(null), []) }
}

export default function DesignContextMenu({
  spot,
  onClose,
  onAsk,
  onRename
}: {
  spot: MenuSpot | null
  onClose: () => void
  onAsk: () => void
  onRename: (shape: TLShape) => void
}) {
  const editor = useEditor()

  const ctx: CommandContext = useMemo(
    () => ({
      editor,
      point: spot?.page ?? null,
      ask: onAsk,
      rename: onRename
    }),
    [editor, spot, onAsk, onRename]
  )

  const commands = useMemo(() => (spot ? availableCommands(ctx) : []), [spot, ctx])
  const layers = useMemo(() => (spot ? shapesUnder(editor, spot.page) : []), [spot, editor])

  if (!spot) return null

  const run = (command: DesignCommand) => {
    command.run(ctx)
    onClose()
  }

  const pick = (id: TLShapeId) => {
    editor.setSelectedShapes([id])
    onClose()
  }

  const shown = ORDER.map(group => commands.filter(command => command.group === group)).filter(
    list => list.length > 0
  )

  return (
    <Popover open onClose={onClose} at={spot.screen}>
      <div className="min-w-56 max-w-72">
        {shown.map((list, at) => (
          <Fragment key={list[0].id}>
            {at > 0 && <MenuDivider />}
            {list.map(command => (
              <MenuItem
                key={command.id}
                icon={<command.Icon />}
                label={command.label}
                hint={command.hint}
                danger={command.group === 'remove'}
                onClick={() => run(command)}
              />
            ))}
          </Fragment>
        ))}
        {layers.length > 1 && (
          <>
            <MenuDivider />
            <SubMenu icon={<LayersGlyph />} label="Select layer">
              <div className="min-w-48 max-w-64">
                {layers.map(shape => {
                  const Icon = glyphForShape(shape)
                  return (
                    <MenuItem
                      key={shape.id}
                      icon={<Icon />}
                      label={layerName(shape)}
                      onClick={() => pick(shape.id)}
                    />
                  )
                })}
              </div>
            </SubMenu>
          </>
        )}
      </div>
    </Popover>
  )
}
