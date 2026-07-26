import { useEffect, useRef, useState } from 'react'
import type { CrewTool } from '../../../shared/toolbox'
import {
  CheckGlyph,
  FolderGlyph,
  MusicGlyph,
  PencilGlyph,
  PlusGlyph,
  SignalGlyph,
  TerminalGlyph,
  type Glyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useHuddle } from '../state/huddle'
import { useCrew } from '../state/store'
import { Popover } from './Popover'
import { opensPanel, runTool, staysOpen } from './runTool'
import ToolBuilder from './ToolBuilder'
import ToolMarkView from './toolMark'
import { HeaderButton, Rule, SheetHeader, Tile } from './toolboxParts'

// A built-in is the same button as one a crew builds, with the app's own hand
// behind it rather than an action someone wrote down.
interface Builtin {
  id: string
  name: string
  mark: Glyph
  soon?: boolean
  panel?: boolean
  run?: () => void
}

const SAID = 1200

export default function Toolbox({
  open,
  onClose,
  onChat
}: {
  open: boolean
  onClose: () => void
  onChat: () => void
}) {
  const tools = useCrew(s => s.tools)
  const joined = useHuddle(s => s.joined)
  const [building, setBuilding] = useState<{ tool: CrewTool | null } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!open) setBuilding(null)
  }, [open])

  useEffect(() => () => clearTimeout(timer.current), [])

  const builtins: Builtin[] = [
    {
      id: 'huddle',
      name: 'Huddle',
      mark: SignalGlyph,
      run: () => {
        const huddle = useHuddle.getState()
        if (huddle.joined) huddle.leave()
        else void huddle.join()
      }
    },
    {
      id: 'terminal',
      name: 'Terminal',
      mark: TerminalGlyph,
      panel: true,
      run: () => useBrowser.getState().addTerminal()
    },
    {
      id: 'files',
      name: 'Files',
      mark: FolderGlyph,
      panel: true,
      run: () => useBrowser.getState().openFiles()
    },
    { id: 'music', name: 'Music', mark: MusicGlyph, soon: true }
  ]

  const press = (run: (() => void) | undefined, panel: boolean) => {
    run?.()
    if (panel) onChat()
    onClose()
  }

  const pressTool = (tool: CrewTool) => {
    runTool(tool.action)
    if (!staysOpen(tool.action)) return press(undefined, opensPanel(tool.action))
    setCopied(tool.id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), SAID)
  }

  return (
    <Popover open={open} onClose={onClose} align="center" flush className="w-[304px]">
      {building ? (
        <ToolBuilder tool={building.tool} onDone={() => setBuilding(null)} />
      ) : (
        <>
          <SheetHeader title="Toolbox">
            <HeaderButton label="New tool" onClick={() => setBuilding({ tool: null })}>
              <PlusGlyph className="w-4 h-4" />
            </HeaderButton>
          </SheetHeader>
          <div className="p-2.5 grid grid-cols-3 gap-1.5">
            {builtins.map(tool => (
              <Tile
                key={tool.id}
                mark={<tool.mark className="w-[22px] h-[22px]" />}
                name={tool.name}
                soon={tool.soon}
                active={tool.id === 'huddle' && joined}
                onClick={() => press(tool.run, tool.panel ?? false)}
              />
            ))}
          </div>
          {tools.length > 0 && (
            <>
              <Rule />
              <div className="p-2.5 grid grid-cols-3 gap-1.5">
                {tools.map(tool => (
                  <Tile
                    key={tool.id}
                    mark={
                      copied === tool.id ? (
                        <CheckGlyph className="w-[22px] h-[22px]" />
                      ) : (
                        <ToolMarkView mark={tool.mark} className="w-[22px] h-[22px]" />
                      )
                    }
                    name={copied === tool.id ? 'Copied' : tool.name}
                    active={copied === tool.id}
                    onClick={() => pressTool(tool)}
                  >
                    <button
                      onClick={() => setBuilding({ tool })}
                      aria-label={`Edit ${tool.name}`}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-fg/10 text-fg/70 opacity-0 transition-all duration-150 hover:bg-fg/20 hover:text-fg active:scale-90 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <PencilGlyph className="w-3 h-3" />
                    </button>
                  </Tile>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Popover>
  )
}
