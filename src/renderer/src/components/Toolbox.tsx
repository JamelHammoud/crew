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
import { Popover } from './Popover'

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

// What a built-in tool is: the same button as one a crew builds, with the app's
// own hand behind it rather than an action someone wrote down.
interface Builtin {
  id: string
  name: string
  mark: Glyph
  soon?: boolean
  run?: () => void
}

export function runTool(action: ToolAction): void {
  if (action.kind === 'web') useBrowser.getState().openUrl(action.url)
  if (action.kind === 'terminal') useBrowser.getState().addTerminal(action.command)
}

function Tile({
  mark: Mark,
  name,
  note,
  active,
  quiet,
  onClick,
  children
}: {
  mark: Glyph
  name: string
  note?: string
  active?: boolean
  quiet?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  const look = quiet
    ? 'text-fg/30'
    : active
      ? 'bg-fg/[0.12] text-fg'
      : 'text-fg/70 hover:text-fg hover:bg-fg/[0.06]'
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={quiet}
        className={`w-full h-[78px] px-1 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-150 enabled:active:scale-95 disabled:cursor-default ${look}`}
      >
        <Mark className="w-[22px] h-[22px]" />
        <span className="w-full truncate text-center text-xs font-medium leading-none">{name}</span>
        {note && <span className="text-xs leading-none text-fg/25">{note}</span>}
      </button>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 px-1 text-xs text-fg/45">{label}</span>
      {children}
    </label>
  )
}

const input =
  'w-full h-9 px-3 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg/30 outline-none transition-colors focus:bg-fg/[0.12]'

function Builder({
  tool,
  onDone
}: {
  tool: CrewTool | null
  onDone: () => void
}) {
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
    <div className="p-1.5 space-y-3">
      <div className="flex items-center gap-1">
        <button
          onClick={onDone}
          aria-label="Back"
          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-fg hover:bg-fg/[0.06]"
        >
          <ChevronLeftGlyph className="w-4 h-4" />
        </button>
        <h3 className="flex-1 text-sm font-semibold text-fg">{tool ? 'Edit tool' : 'New tool'}</h3>
        {tool && (
          <button
            onClick={() => {
              removeTool(tool.id)
              onDone()
            }}
            aria-label="Remove tool"
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-danger hover:bg-danger/10"
          >
            <TrashGlyph className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Field label="Name">
        <input
          autoFocus
          value={name}
          maxLength={NAME_LIMIT}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="What to call it"
          className={input}
        />
      </Field>

      <Field label="Mark">
        <div className="grid grid-cols-7 gap-0.5">
          {TOOL_MARKS.map(name => {
            const Mark = MARKS[name]
            return (
              <button
                key={name}
                onClick={() => setMark(name)}
                aria-label={name}
                aria-pressed={mark === name}
                className={`h-8 rounded-xl flex items-center justify-center transition-colors ${
                  mark === name ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg hover:bg-fg/[0.06]'
                }`}
              >
                <Mark className="w-4 h-4" />
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="What it does">
        <span className="w-full flex rounded-full bg-fg/[0.06] p-0.5">
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
        </span>
      </Field>

      {kind === 'web' ? (
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="figma.com"
          className={input}
        />
      ) : (
        <input
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="yarn dev"
          className={`${input} font-mono`}
        />
      )}

      <button
        onClick={save}
        disabled={!ready}
        className="w-full h-9 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-30"
      >
        {tool ? 'Save' : 'Add to toolbox'}
      </button>
    </div>
  )
}

export default function Toolbox({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    { id: 'terminal', name: 'Terminal', mark: TerminalGlyph, run: () => useBrowser.getState().addTerminal() },
    { id: 'music', name: 'Music', mark: MusicGlyph, soon: true },
    { id: 'files', name: 'Files', mark: FolderGlyph, soon: true }
  ]

  return (
    <Popover open={open} onClose={onClose} flush className="w-[288px]">
      {building ? (
        <Builder tool={building.tool} onDone={() => setBuilding(null)} />
      ) : (
        <div className="p-1.5 grid grid-cols-3 gap-0.5">
          {builtins.map(tool => (
            <Tile
              key={tool.id}
              mark={tool.mark}
              name={tool.name}
              note={tool.soon ? 'Soon' : undefined}
              quiet={tool.soon}
              active={tool.id === 'huddle' && joined}
              onClick={() => {
                tool.run?.()
                onClose()
              }}
            />
          ))}
          {tools.map(tool => (
            <Tile
              key={tool.id}
              mark={MARKS[tool.mark] ?? StarGlyph}
              name={tool.name}
              onClick={() => {
                runTool(tool.action)
                onClose()
              }}
            >
              <button
                onClick={() => setBuilding({ tool })}
                aria-label={`Edit ${tool.name}`}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center bg-fg/10 text-fg/70 opacity-0 transition-all duration-150 hover:bg-fg/20 hover:text-fg active:scale-95 focus-visible:opacity-100 [div:hover>&]:opacity-100"
              >
                <PencilGlyph className="w-3 h-3" />
              </button>
            </Tile>
          ))}
          <button
            onClick={() => setBuilding({ tool: null })}
            className="h-[78px] px-1 rounded-2xl border border-dashed border-fg/15 flex flex-col items-center justify-center gap-1.5 text-fg/45 transition-all duration-150 hover:border-fg/25 hover:text-fg hover:bg-fg/[0.04] active:scale-95"
          >
            <PlusGlyph className="w-[22px] h-[22px]" />
            <span className="w-full truncate text-center text-xs font-medium leading-none">New tool</span>
          </button>
        </div>
      )}
    </Popover>
  )
}
