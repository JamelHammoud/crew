import { useEffect, useRef, useState } from 'react'
import type { CrewTool } from '../../../shared/toolbox'
import { CheckGlyph, PencilGlyph, PlusGlyph } from '../icons'
import { useCrew } from '../state/store'
import { Popover } from './Popover'
import { runTool, saidAfter, toolSlots } from './runTool'
import ToolBuilder from './ToolBuilder'
import ToolFill from './ToolFill'
import ToolMarkView from './toolMark'
import { SheetHeader, Tile } from './toolboxParts'

const SAID = 1200

// Three columns, and the panel is as wide as three of them and the padding: a
// tile is the size it always was, and the width of the toolbox is worked out
// from that rather than the other way round.
const GRID = 'p-2.5 grid grid-cols-3 gap-1.5'

export default function Toolbox({
  open,
  onClose,
  at,
  anchor
}: {
  open: boolean
  onClose: () => void
  at?: { x: number; y: number }
  anchor?: { current: HTMLElement | null }
}) {
  const tools = useCrew(s => s.tools)
  const [building, setBuilding] = useState<{ tool: CrewTool | null } | null>(null)
  const [filling, setFilling] = useState<{ tool: CrewTool; slots: string[] } | null>(null)
  const [said, setSaid] = useState<{ toolId: string; word: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (open) return
    setBuilding(null)
    setFilling(null)
  }, [open])

  useEffect(() => () => clearTimeout(timer.current), [])

  const builtins: Builtin[] = [
    {
      id: 'huddle',
      name: 'Huddle',
      mark: SignalGlyph,
      on: joined,
      run: () => {
        const huddle = useHuddle.getState()
        if (huddle.joined) huddle.leave()
        else void huddle.join()
      }
    },
    {
      id: 'review',
      name: 'Review',
      mark: BranchGlyph,
      run: () => useBrowser.getState().openReview()
    },
    {
      id: 'terminal',
      name: 'Terminal',
      mark: TerminalGlyph,
      run: () => useBrowser.getState().addTerminal(undefined, useCrew.getState().folder)
    },
    {
      id: 'files',
      name: 'Files',
      mark: FolderGlyph,
      run: () => useBrowser.getState().openFiles()
    },
    {
      id: 'music',
      name: 'Music',
      mark: MusicGlyph,
      on: playing,
      run: () => useBrowser.getState().openMusic()
    },
    {
      id: 'game',
      name: 'Games',
      mark: GameGlyph,
      run: () => useBrowser.getState().openGame()
    }
  ]

  const press = (run?: () => void) => {
    run?.()
    onClose()
  }

  const pressTool = (tool: CrewTool) => {
    const slots = toolSlots(tool.action)
    if (slots.length > 0) return setFilling({ tool, slots })
    fireTool(tool)
  }

  const fireTool = (tool: CrewTool, answers: Record<string, string> = {}) => {
    runTool(tool.action, answers)
    setFilling(null)
    const word = saidAfter(tool.action)
    if (!word) return press()
    setSaid({ toolId: tool.id, word })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaid(null), SAID)
  }

  return (
    <Popover open={open} onClose={onClose} align="center" at={at} anchor={anchor} flush className="w-[262px]">
      {building ? (
        <ToolBuilder tool={building.tool} onDone={() => setBuilding(null)} />
      ) : filling ? (
        <ToolFill
          tool={filling.tool}
          slots={filling.slots}
          onBack={() => setFilling(null)}
          onRun={answers => fireTool(filling.tool, answers)}
        />
      ) : (
        <>
          <SheetHeader title="Toolbox" />
          <div className={GRID}>
            {builtins.map(tool => (
              <Tile
                key={tool.id}
                mark={<tool.mark className="w-[22px] h-[22px]" />}
                name={tool.name}
                active={tool.on}
                onClick={() => press(tool.run)}
              />
            ))}
          </div>
          <Rule />
          <div className={GRID}>
            {tools.map(tool => (
              <Tile
                key={tool.id}
                mark={
                  said?.toolId === tool.id ? (
                    <CheckGlyph className="w-[22px] h-[22px]" />
                  ) : (
                    <ToolMarkView mark={tool.mark} className="w-[22px] h-[22px]" />
                  )
                }
                name={said?.toolId === tool.id ? said.word : tool.name}
                active={said?.toolId === tool.id}
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
            <Tile
              ghost
              mark={<PlusGlyph className="w-[22px] h-[22px]" />}
              name="New tool"
              onClick={() => setBuilding({ tool: null })}
            />
          </div>
        </>
      )}
    </Popover>
  )
}
