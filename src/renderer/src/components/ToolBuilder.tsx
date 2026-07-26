import { useState, type ReactNode } from 'react'
import { DEFAULT_MARK, NAME_LIMIT, type CrewTool, type ToolAction } from '../../../shared/toolbox'
import { agentsHere } from '../design/askAgent'
import {
  ChatGlyph,
  FileGlyph,
  GlobeGlyph,
  PeopleGlyph,
  PencilGlyph,
  TerminalGlyph,
  TrashGlyph,
  type Glyph
} from '../icons'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import ToolMarkPicker from './ToolMarkPicker'
import ToolMarkView from './toolMark'
import { AREA, Field, FIELD, HeaderButton, Label, Segmented, SheetHeader, Tile } from './toolboxParts'
import Tooltip from './Tooltip'
import { useAutoResize } from './useAutoResize'

type Kind = ToolAction['kind']

const KINDS: Array<{ kind: Kind; title: string; mark: Glyph }> = [
  { kind: 'web', title: 'Open a page', mark: GlobeGlyph },
  { kind: 'terminal', title: 'Run a command', mark: TerminalGlyph },
  { kind: 'file', title: 'Open a file', mark: FileGlyph },
  { kind: 'prompt', title: 'Ask an agent', mark: ChatGlyph }
]

const GROWN = 108

// A pill for who a tool asks. Anyone is a choice of its own rather than an empty
// one: a tool built here is pressed on everyone's machine, and the agent it
// names may not be up on theirs.
function Who({
  name,
  mark,
  picked,
  onClick
}: {
  name: string
  mark: ReactNode
  picked: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={picked}
      className={`h-8 pl-1 pr-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
        picked ? 'bg-fg text-ink-900' : 'bg-fg/[0.05] text-fg/70 hover:bg-fg/[0.09] hover:text-fg'
      }`}
    >
      {mark}
      <span className="max-w-24 truncate">{name}</span>
    </button>
  )
}

export default function ToolBuilder({ tool, onDone }: { tool: CrewTool | null; onDone: () => void }) {
  const agents = useCrew(s => s.agents)
  const addTool = useCrew(s => s.addTool)
  const editTool = useCrew(s => s.editTool)
  const removeTool = useCrew(s => s.removeTool)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState(tool?.name ?? '')
  const [mark, setMark] = useState<string>(tool?.mark ?? DEFAULT_MARK)
  const [kind, setKind] = useState<Kind>(tool?.action.kind ?? 'web')
  const [url, setUrl] = useState(tool?.action.kind === 'web' ? tool.action.url : '')
  const [external, setExternal] = useState(tool?.action.kind === 'web' && Boolean(tool.action.external))
  const [command, setCommand] = useState(tool?.action.kind === 'terminal' ? (tool.action.command ?? '') : '')
  const [path, setPath] = useState(tool?.action.kind === 'file' ? tool.action.path : '')
  const [ask, setAsk] = useState(tool?.action.kind === 'prompt' ? tool.action.text : '')
  const [agentId, setAgentId] = useState(tool?.action.kind === 'prompt' ? (tool.action.agentId ?? null) : null)
  const commandRef = useAutoResize(command, GROWN)
  const askRef = useAutoResize(ask, GROWN)

  const here = agentsHere(agents)

  const action = (): ToolAction => {
    if (kind === 'terminal') return { kind: 'terminal', command }
    if (kind === 'file') return { kind: 'file', path }
    if (kind === 'prompt') return agentId ? { kind: 'prompt', text: ask, agentId } : { kind: 'prompt', text: ask }
    return external ? { kind: 'web', url, external: true } : { kind: 'web', url }
  }

  const written =
    kind === 'web' ? url.trim() : kind === 'file' ? path.trim() : kind === 'prompt' ? ask.trim() : 'runs'
  const ready = name.trim() !== '' && written !== ''

  const save = () => {
    if (!ready) return
    if (tool) editTool(tool.id, name, mark, action())
    else addTool(name, mark, action())
    onDone()
  }

  const onEnter = (event: { key: string; preventDefault: () => void }) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    save()
  }

  if (picking) {
    return (
      <ToolMarkPicker
        mark={mark}
        onBack={() => setPicking(false)}
        onPick={chosen => {
          setMark(chosen)
          setPicking(false)
        }}
      />
    )
  }

  return (
    <>
      <SheetHeader title={tool ? 'Edit tool' : 'New tool'} onBack={onDone}>
        {tool && (
          <HeaderButton
            label="Remove tool"
            danger
            onClick={() => {
              removeTool(tool.id)
              onDone()
            }}
          >
            <TrashGlyph className="w-3.5 h-3.5" />
          </HeaderButton>
        )}
      </SheetHeader>

      <div className="p-2.5 space-y-3">
        <div className="flex items-end gap-2">
          <span className="group relative flex shrink-0">
            <Tooltip label="Choose a mark">
              <button
                onClick={() => setPicking(true)}
                aria-label="Choose a mark"
                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-fg/[0.05] text-fg/70 transition-all duration-150 hover:bg-fg/[0.09] hover:text-fg active:scale-95"
              >
                <ToolMarkView mark={mark} className="w-[26px] h-[26px]" />
              </button>
            </Tooltip>
            <span className="pointer-events-none absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-fg text-ink-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <PencilGlyph className="w-3 h-3" />
            </span>
          </span>
          <div className="flex-1 min-w-0">
            <Field label="Name">
              <input
                autoFocus
                value={name}
                maxLength={NAME_LIMIT}
                onChange={e => setName(e.target.value)}
                onKeyDown={onEnter}
                placeholder="What to call it"
                className={FIELD}
              />
            </Field>
          </div>
        </div>

        <div>
          <Label>What it does</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map(choice => (
              <Tile
                key={choice.kind}
                mark={<choice.mark className="w-[22px] h-[22px]" />}
                name={choice.title}
                active={kind === choice.kind}
                onClick={() => setKind(choice.kind)}
              />
            ))}
          </div>
        </div>

        {kind === 'web' && (
          <>
            <Field label="Address">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={onEnter}
                placeholder="figma.com"
                className={FIELD}
              />
            </Field>
            <div>
              <Label>Open it in</Label>
              <Segmented
                value={external ? 'browser' : 'panel'}
                onChange={value => setExternal(value === 'browser')}
                options={[
                  { value: 'panel', label: 'Side panel' },
                  { value: 'browser', label: 'Your browser' }
                ]}
              />
            </div>
          </>
        )}

        {kind === 'terminal' && (
          <Field label="Command">
            <textarea
              ref={commandRef}
              rows={1}
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="yarn dev"
              className={`${AREA} font-mono`}
            />
          </Field>
        )}

        {kind === 'file' && (
          <Field label="File">
            <input
              value={path}
              onChange={e => setPath(e.target.value)}
              onKeyDown={onEnter}
              placeholder="src/renderer/src/App.tsx"
              className={`${FIELD} font-mono`}
            />
          </Field>
        )}

        {kind === 'prompt' && (
          <>
            <div>
              <Label>Who it asks</Label>
              <div className="flex flex-wrap gap-1">
                <Who
                  name="Anyone"
                  mark={<PeopleGlyph className="w-5 h-5 p-0.5" />}
                  picked={agentId === null}
                  onClick={() => setAgentId(null)}
                />
                {here.map(agent => (
                  <Who
                    key={agent.id}
                    name={agent.label}
                    mark={<AgentIcon seed={agent.id} size="xs" />}
                    picked={agentId === agent.id}
                    onClick={() => setAgentId(agent.id)}
                  />
                ))}
              </div>
            </div>
            <Field label="What to ask">
              <textarea
                ref={askRef}
                rows={2}
                value={ask}
                onChange={e => setAsk(e.target.value)}
                placeholder="Run the tests and fix what fails"
                className={AREA}
              />
            </Field>
          </>
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
