import { useEffect, useState, type ReactNode } from 'react'
import { NAME_LIMIT, TOOL_MARKS, type CrewTool, type ToolAction, type ToolMark } from '../../../shared/toolbox'
import {
  ChevronLeftGlyph,
  ClockGlyph,
  CloudGlyph,
  DesktopGlyph,
  DocGlyph,
  FolderGlyph,
  GlobeGlyph,
  LinkGlyph,
  MusicGlyph,
  PencilGlyph,
  PeopleGlyph,
  PhotoGlyph,
  PlusGlyph,
  SearchGlyph,
  SignalGlyph,
  StarGlyph,
  TerminalGlyph,
  TrashGlyph,
  type Glyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useHuddle } from '../state/huddle'
import { useCrew } from '../state/store'
import Pill from './Pill'
import { Popover } from './Popover'
import Tooltip from './Tooltip'

const MARKS: Record<ToolMark, Glyph> = {
  globe: GlobeGlyph,
  terminal: TerminalGlyph,
  folder: FolderGlyph,
  doc: DocGlyph,
  photo: PhotoGlyph,
  music: MusicGlyph,
  star: StarGlyph,
  clock: ClockGlyph,
  signal: SignalGlyph,
  cloud: CloudGlyph,
  search: SearchGlyph,
  link: LinkGlyph,
  desktop: DesktopGlyph,
  people: PeopleGlyph
}

const markFor = (mark: ToolMark): Glyph => MARKS[mark] ?? StarGlyph

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

export function runTool(action: ToolAction): void {
  if (action.kind === 'web') useBrowser.getState().openUrl(action.url)
  if (action.kind === 'terminal') useBrowser.getState().addTerminal(action.command)
}

function Rule() {
  return <div className="h-px bg-fg/[0.06]" />
}

function Label({ children }: { children: ReactNode }) {
  return <span className="block mb-1.5 px-1 text-xs text-fg/45">{children}</span>
}

// One tile, whatever is behind it. Lit white while it is the thing happening,
// filled quietly when it is waiting, barely there when it cannot be pressed.
// A tile that is not ready yet says so on hover rather than wearing a label, and
// it warms from the group, since a disabled button never matches its own hover.
function Tile({
  mark: Mark,
  name,
  active,
  soon,
  onClick,
  children
}: {
  mark: Glyph
  name: string
  active?: boolean
  soon?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const look = soon
    ? 'bg-fg/[0.03] text-fg/30 group-hover:bg-fg/[0.06] group-hover:text-fg/50'
    : active
      ? 'bg-fg text-ink-900'
      : 'bg-fg/[0.05] text-fg/70 hover:bg-fg/[0.09] hover:text-fg'
  return (
    <div className="group relative">
      <Tooltip label="Coming soon" disabled={!soon} className="w-full">
        <button
          onClick={onClick}
          disabled={soon}
          className={`w-full h-[82px] px-1.5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 enabled:active:scale-95 disabled:cursor-default ${look}`}
        >
          <Mark className="w-[22px] h-[22px]" />
          <span className="w-full truncate text-center text-xs font-medium leading-none">{name}</span>
        </button>
      </Tooltip>
      {children}
    </div>
  )
}

const field =
  'w-full h-9 px-3.5 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg/25 outline-none transition-colors focus:bg-fg/[0.1]'

function Builder({ tool, onDone }: { tool: CrewTool | null; onDone: () => void }) {
  const addTool = useCrew(s => s.addTool)
  const editTool = useCrew(s => s.editTool)
  const removeTool = useCrew(s => s.removeTool)
  const [name, setName] = useState(tool?.name ?? '')
  const [mark, setMark] = useState<ToolMark>(tool?.mark ?? 'star')
  const [kind, setKind] = useState<ToolAction['kind']>(tool?.action.kind ?? 'web')
  const [url, setUrl] = useState(tool?.action.kind === 'web' ? tool.action.url : '')
  const [command, setCommand] = useState(tool?.action.kind === 'terminal' ? (tool.action.command ?? '') : '')

  const action: ToolAction = kind === 'web' ? { kind: 'web', url } : { kind: 'terminal', command }
  const ready = name.trim() !== '' && (kind === 'terminal' || url.trim() !== '')

  const save = () => {
    if (!ready) return
    if (tool) editTool(tool.id, name, mark, action)
    else addTool(name, mark, action)
    onDone()
  }

  return (
    <>
      <header className="h-12 pl-1.5 pr-2.5 flex items-center gap-1">
        <button
          onClick={onDone}
          aria-label="Back"
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
        >
          <ChevronLeftGlyph className="w-4 h-4" />
        </button>
        <h3 className="flex-1 text-sm font-semibold text-fg">{tool ? 'Edit tool' : 'New tool'}</h3>
        {tool && (
          <Tooltip label="Remove">
            <button
              onClick={() => {
                removeTool(tool.id)
                onDone()
              }}
              aria-label="Remove tool"
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-danger hover:bg-danger/10 active:scale-95"
            >
              <TrashGlyph className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}
      </header>
      <Rule />
      <div className="p-2.5 space-y-3.5">
        <div>
          <Label>Name</Label>
          <input
            autoFocus
            value={name}
            maxLength={NAME_LIMIT}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="What to call it"
            className={field}
          />
        </div>

        <div>
          <Label>Mark</Label>
          <div className="grid grid-cols-7 gap-1">
            {TOOL_MARKS.map(choice => {
              const Mark = markFor(choice)
              return (
                <button
                  key={choice}
                  onClick={() => setMark(choice)}
                  aria-label={choice}
                  aria-pressed={mark === choice}
                  className={`h-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90 ${
                    mark === choice ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg hover:bg-fg/[0.06]'
                  }`}
                >
                  <Mark className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Label>What it does</Label>
          <div className="flex rounded-full bg-fg/[0.06] p-0.5">
            {(
              [
                { value: 'web', label: 'Open a page' },
                { value: 'terminal', label: 'Run a command' }
              ] as const
            ).map(option => (
              <button
                key={option.value}
                onClick={() => setKind(option.value)}
                aria-pressed={kind === option.value}
                className={`flex-1 h-8 rounded-full text-xs font-semibold transition-colors ${
                  kind === option.value ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {kind === 'web' ? (
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="figma.com"
            className={field}
          />
        ) : (
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="yarn dev"
            className={`${field} font-mono`}
          />
        )}

        <button
          onClick={save}
          disabled={!ready}
          className="w-full h-9 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-25"
        >
          {tool ? 'Save' : 'Add to toolbox'}
        </button>
      </div>
    </>
  )
}

export default function Toolbox({
  open,
  onClose,
  onSidePanel
}: {
  open: boolean
  onClose: () => void
  onSidePanel: () => void
}) {
  const tools = useCrew(s => s.tools)
  const joined = useHuddle(s => s.joined)
  const [building, setBuilding] = useState<{ tool: CrewTool | null } | null>(null)

  useEffect(() => {
    if (!open) setBuilding(null)
  }, [open])

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
    { id: 'music', name: 'Music', mark: MusicGlyph, soon: true },
    { id: 'files', name: 'Files', mark: FolderGlyph, soon: true }
  ]

  const press = (run: (() => void) | undefined, panel: boolean) => {
    run?.()
    if (panel) onSidePanel()
    onClose()
  }

  return (
    <Popover open={open} onClose={onClose} align="center" flush className="w-[304px]">
      {building ? (
        <Builder tool={building.tool} onDone={() => setBuilding(null)} />
      ) : (
        <>
          <header className="h-12 pl-4 pr-2.5 flex items-center">
            <h3 className="flex-1 text-sm font-semibold text-fg">Toolbox</h3>
            <Tooltip label="New tool">
              <button
                onClick={() => setBuilding({ tool: null })}
                aria-label="New tool"
                className="w-8 h-8 rounded-full flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
              >
                <PlusGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          </header>
          <Rule />
          <div className="p-2.5 grid grid-cols-3 gap-1.5">
            {builtins.map(tool => (
              <Tile
                key={tool.id}
                mark={tool.mark}
                name={tool.name}
                note={tool.soon ? 'Soon' : undefined}
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
                    mark={markFor(tool.mark)}
                    name={tool.name}
                    onClick={() => press(() => runTool(tool.action), true)}
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
