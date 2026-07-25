import { ChevronUpIcon } from '@heroicons/react/16/solid'
import { useCallback, useEffect, useState } from 'react'
import { useEditor, useValue, type Editor } from 'tldraw'
import { activateTool, ALL_TOOLS, currentToolId, TOOL_GROUPS, type DesignToolGroup } from '../design/tools'
import DesignToolMenu from './DesignToolMenus'
import Tooltip from './Tooltip'

const FIRST: Record<string, string> = Object.fromEntries(TOOL_GROUPS.map(group => [group.id, group.tools[0].id]))

function combo(shortcut: string): { key: string; shift: boolean } | null {
  if (!shortcut) return null
  const parts = shortcut.split(' ')
  return { key: parts[parts.length - 1].toLowerCase(), shift: parts.includes('Shift') }
}

export default function DesignToolbar() {
  const editor = useEditor()
  const [defaults, setDefaults] = useState<Record<string, string>>(FIRST)
  const [menu, setMenu] = useState<string | null>(null)
  const current = useValue('design tool', () => currentToolId(editor), [editor])

  const remember = useCallback((groupId: string, toolId: string) => {
    setDefaults(prev => (prev[groupId] === toolId ? prev : { ...prev, [groupId]: toolId }))
  }, [])

  useEffect(() => {
    if (!editor) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      for (const tool of ALL_TOOLS) {
        const keys = combo(tool.shortcut)
        if (!keys || keys.key !== event.key.toLowerCase() || keys.shift !== event.shiftKey) continue
        event.preventDefault()
        activateTool(editor, tool.id)
        const group = TOOL_GROUPS.find(g => g.tools.some(t => t.id === tool.id))
        if (group) remember(group.id, tool.id)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, remember])

  if (!editor) return null

  const activeGroup = TOOL_GROUPS.find(group => group.tools.some(tool => tool.id === current))

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div
        role="toolbar"
        aria-label="Design tools"
        className="glass rounded-full h-11 flex items-center gap-0.5 px-1.5 pointer-events-auto"
      >
        {TOOL_GROUPS.map(group => (
          <Group
            key={group.id}
            group={group}
            editor={editor}
            active={activeGroup?.id === group.id}
            current={current}
            fallback={defaults[group.id]}
            menuOpen={menu === group.id}
            onMenu={open => setMenu(open ? group.id : null)}
            onPick={toolId => remember(group.id, toolId)}
          />
        ))}
      </div>
    </div>
  )
}

function Group({
  group,
  editor,
  active,
  current,
  fallback,
  menuOpen,
  onMenu,
  onPick
}: {
  group: DesignToolGroup
  editor: Editor
  active: boolean
  current: string
  fallback: string
  menuOpen: boolean
  onMenu: (open: boolean) => void
  onPick: (toolId: string) => void
}) {
  const shown = group.tools.find(tool => tool.id === (active ? current : fallback)) ?? group.tools[0]
  const hasMenu = group.tools.length > 1 || group.id === 'frame'
  const tone = active ? 'bg-fg text-ink-900' : 'text-fg-secondary'

  return (
    <span className={`relative flex items-center h-8 rounded-full ${tone}`}>
      <Tooltip label={shown.shortcut ? `${shown.label}  ${shown.shortcut}` : shown.label} disabled={menuOpen}>
        <button
          onClick={() => activateTool(editor, shown.id)}
          aria-label={shown.label}
          aria-pressed={active}
          className={`h-8 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            hasMenu ? 'w-8 pl-1' : 'w-9'
          } ${active ? '' : 'hover:text-fg hover:bg-fg/[0.06]'}`}
        >
          <shown.Icon className="w-4 h-4" />
        </button>
      </Tooltip>
      {hasMenu && (
        <button
          onClick={() => onMenu(!menuOpen)}
          aria-label={`${group.label} options`}
          aria-expanded={menuOpen}
          className={`h-8 w-4 pr-1 rounded-full grid place-items-center transition-colors ${
            active ? 'text-ink-900/50 hover:text-ink-900' : 'text-fg-faint hover:text-fg'
          }`}
        >
          <ChevronUpIcon className="w-3 h-3" />
        </button>
      )}
      <DesignToolMenu
        group={group}
        editor={editor}
        open={menuOpen}
        current={current}
        onClose={() => onMenu(false)}
        onPick={onPick}
      />
    </span>
  )
}
