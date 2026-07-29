import { useEffect, useRef, useState } from 'react'
import type { CrewTool } from '../../../shared/toolbox'
import {
  CheckGlyph,
  FolderGlyph,
  GameGlyph,
  MicGlyph,
  MusicGlyph,
  PencilGlyph,
  PlusGlyph,
  SignalGlyph,
  TerminalGlyph,
  type Glyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useHuddle } from '../state/huddle'
import { useMusic } from '../state/music'
import { useCrew } from '../state/store'
import { useVoice } from '../state/voice'
import { Popover } from './Popover'
import { opensPanel, runTool, saidAfter, toolSlots } from './runTool'
import ToolBuilder from './ToolBuilder'
import ToolFill from './ToolFill'
import ToolMarkView from './toolMark'
import { Rule, SheetHeader, Tile } from './toolboxParts'

// A built-in is the same button as one a crew builds, with the app's own hand
// behind it rather than an action someone wrote down. It lights the same way a
// built tool does, while the thing it opens is live.
interface Builtin {
  id: string
  name: string
  mark: Glyph
  on?: boolean
  panel?: boolean
  run: () => void
}

const SAID = 1200

// Both halves of the toolbox stand on the same three columns, so the app's own
// hand and the crew's own tools are the same button in the same grid. The panel
// is as wide as three of them and nothing more: a tile is the size it always
// was, and the width of the toolbox is worked out from that rather than the
// other way round.
const GRID = 'p-2.5 grid grid-cols-3 gap-1.5'

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
  const playing = useMusic(s => s.room.playing)
  const talking = useVoice(s => s.open)
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
      id: 'voice',
      name: 'Voice',
      mark: MicGlyph,
      on: talking,
      run: () => {
        const voice = useVoice.getState()
        if (voice.open) voice.end()
        else void voice.start()
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
    {
      id: 'music',
      name: 'Music',
      mark: MusicGlyph,
      on: playing,
      panel: true,
      run: () => useBrowser.getState().openMusic()
    },
    {
      id: 'game',
      name: 'Games',
      mark: GameGlyph,
      panel: true,
      run: () => useBrowser.getState().openGame()
    }
  ]

  const press = (run: (() => void) | undefined, panel: boolean) => {
    run?.()
    if (panel) onChat()
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
    if (!word) return press(undefined, opensPanel(tool.action))
    setSaid({ toolId: tool.id, word })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaid(null), SAID)
  }

  return (
    <Popover open={open} onClose={onClose} align="center" flush className="w-[262px]">
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
                onClick={() => press(tool.run, tool.panel ?? false)}
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
