import type { Editor } from 'tldraw'
import {
  activateTool,
  addFrame,
  FRAME_PRESETS,
  type DesignTool,
  type DesignToolGroup
} from '../design/tools'
import { MenuDivider, MenuItem, Popover } from './Popover'

function Row({
  tool,
  active,
  onPick
}: {
  tool: DesignTool
  active: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors ${
        active ? 'text-fg bg-fg/[0.08]' : 'text-fg-secondary hover:text-fg hover:bg-fg/5'
      }`}
    >
      <tool.Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{tool.label}</span>
      {tool.shortcut && <span className="text-xs text-fg-muted">{tool.shortcut}</span>}
    </button>
  )
}

export default function DesignToolMenu({
  group,
  editor,
  open,
  current,
  onClose,
  onPick
}: {
  group: DesignToolGroup
  editor: Editor
  open: boolean
  current: string
  onClose: () => void
  onPick: (toolId: string) => void
}) {
  const pick = (tool: DesignTool) => {
    activateTool(editor, tool.id)
    onPick(tool.id)
    onClose()
  }

  return (
    <Popover open={open} onClose={onClose} side="top" align="start" className="min-w-48">
      <div role="menu" aria-label={group.label}>
        {group.tools.map(tool => (
          <Row key={tool.id} tool={tool} active={tool.id === current} onPick={() => pick(tool)} />
        ))}
        {group.id === 'frame' && (
          <>
            <MenuDivider />
            {FRAME_PRESETS.map(preset => (
              <MenuItem
                key={preset.label}
                label={preset.label}
                hint={`${preset.w} × ${preset.h}`}
                onClick={() => {
                  addFrame(editor, preset)
                  onClose()
                }}
              />
            ))}
          </>
        )}
      </div>
    </Popover>
  )
}
