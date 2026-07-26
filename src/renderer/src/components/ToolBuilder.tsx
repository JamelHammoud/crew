import { useState, type ReactNode } from 'react'
import { DEFAULT_MARK, NAME_LIMIT, type CrewTool, type ToolAction } from '../../../shared/toolbox'
import { agentsHere } from '../design/askAgent'
import { FrameGlyph } from '../design/glyphs'
import { DocGlyph, PeopleGlyph, PencilGlyph, TrashGlyph } from '../icons'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import ToolMarkPicker from './ToolMarkPicker'
import ToolMarkView from './toolMark'
import { AREA, Empty, Field, FIELD, Footer, HeaderButton, Label, Primary, Row, Segmented, SheetHeader } from './toolboxParts'
import ToolKindPicker from './ToolKindPicker'
import { kindOf, type ToolKind } from './toolKinds'
import Tooltip from './Tooltip'
import { useAutoResize } from './useAutoResize'

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
      className={`h-8 pl-1 pr-2.5 rounded-field flex items-center gap-1.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
        picked ? 'bg-fg text-ink-900' : 'bg-fg/[0.06] text-fg/70 hover:bg-fg/[0.1] hover:text-fg'
      }`}
    >
      {mark}
      <span className="max-w-24 truncate">{name}</span>
    </button>
  )
}

// A list the sheet can hold without growing past it: the docs the crew writes,
// the boards it draws on.
function Pick({
  label,
  empty,
  children
}: {
  label: string
  empty: string
  children: ReactNode[]
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="max-h-[168px] overflow-y-auto overscroll-contain [scrollbar-width:none]">{children}</div>
      )}
    </div>
  )
}

export default function ToolBuilder({ tool, onDone }: { tool: CrewTool | null; onDone: () => void }) {
  const agents = useCrew(s => s.agents)
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const addTool = useCrew(s => s.addTool)
  const editTool = useCrew(s => s.editTool)
  const removeTool = useCrew(s => s.removeTool)
  const [screen, setScreen] = useState<'form' | 'mark' | 'kind'>('form')
  const [name, setName] = useState(tool?.name ?? '')
  const [mark, setMark] = useState<string>(tool?.mark ?? DEFAULT_MARK)
  const [kind, setKind] = useState<ToolKind>(tool?.action.kind ?? 'web')
  const [url, setUrl] = useState(tool?.action.kind === 'web' ? tool.action.url : '')
  const [external, setExternal] = useState(tool?.action.kind === 'web' && Boolean(tool.action.external))
  const [command, setCommand] = useState(tool?.action.kind === 'terminal' ? (tool.action.command ?? '') : '')
  const [path, setPath] = useState(tool?.action.kind === 'file' ? tool.action.path : '')
  const [page, setPage] = useState(tool?.action.kind === 'doc' ? tool.action.page : '')
  const [boardId, setBoardId] = useState(tool?.action.kind === 'board' ? tool.action.boardId : '')
  const [copy, setCopy] = useState(tool?.action.kind === 'copy' ? tool.action.text : '')
  const [ask, setAsk] = useState(tool?.action.kind === 'prompt' ? tool.action.text : '')
  const [agentId, setAgentId] = useState(tool?.action.kind === 'prompt' ? (tool.action.agentId ?? null) : null)
  const commandRef = useAutoResize(command, GROWN)
  const askRef = useAutoResize(ask, GROWN)
  const copyRef = useAutoResize(copy, GROWN)

  // An agent that has gone quiet is still worth showing while it is the one the
  // tool names, or opening a tool to change its wording would quietly take the
  // name off it.
  const here = agentsHere(agents)
  const named = agents.find(agent => agent.id === agentId)
  const choices = named && !here.includes(named) ? [...here, named] : here

  const action = (): ToolAction => {
    if (kind === 'terminal') return { kind: 'terminal', command }
    if (kind === 'file') return { kind: 'file', path }
    if (kind === 'doc') return { kind: 'doc', page }
    if (kind === 'board') return { kind: 'board', boardId }
    if (kind === 'copy') return { kind: 'copy', text: copy }
    if (kind === 'prompt') return agentId ? { kind: 'prompt', text: ask, agentId } : { kind: 'prompt', text: ask }
    return external ? { kind: 'web', url, external: true } : { kind: 'web', url }
  }

  // A command is the one thing a tool can be built without: a terminal that
  // opens on a prompt is a tool.
  const written =
    kind === 'web' ? url : kind === 'file' ? path : kind === 'doc' ? page : kind === 'board' ? boardId : kind === 'copy' ? copy : kind === 'prompt' ? ask : ''
  const ready = name.trim() !== '' && (kind === 'terminal' || written.trim() !== '')

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

  if (screen === 'mark') {
    return (
      <ToolMarkPicker
        mark={mark}
        onBack={() => setScreen('form')}
        onPick={chosen => {
          setMark(chosen)
          setScreen('form')
        }}
      />
    )
  }

  if (screen === 'kind') {
    return (
      <ToolKindPicker
        kind={kind}
        onBack={() => setScreen('form')}
        onPick={chosen => {
          setKind(chosen)
          setScreen('form')
        }}
      />
    )
  }

  const picked = kindOf(kind)

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
        <div className="flex items-center gap-2">
          <span className="group relative flex shrink-0">
            <Tooltip label="Choose a mark">
              <button
                onClick={() => setScreen('mark')}
                aria-label="Choose a mark"
                className="w-11 h-11 rounded-field flex items-center justify-center bg-fg/[0.06] text-fg/70 transition-all duration-150 hover:bg-fg/[0.1] hover:text-fg active:scale-95"
              >
                <ToolMarkView mark={mark} className="w-[22px] h-[22px]" />
              </button>
            </Tooltip>
            <span className="pointer-events-none absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-fg text-ink-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <PencilGlyph className="w-2.5 h-2.5" />
            </span>
          </span>
          <input
            autoFocus
            value={name}
            maxLength={NAME_LIMIT}
            onChange={e => setName(e.target.value)}
            onKeyDown={onEnter}
            placeholder="What to call it"
            className={`${FIELD} h-11 text-base font-medium placeholder:font-normal`}
          />
        </div>

        <div>
          <Label>What it does</Label>
          <Row
            mark={<picked.mark className="w-[18px] h-[18px]" />}
            title={picked.title}
            note={picked.note}
            chevron
            onClick={() => setScreen('kind')}
          />
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

        {kind === 'doc' && (
          <Pick label="Which doc" empty="No docs yet">
            {Object.entries(docs).map(([key, doc]) => (
              <Row
                key={key}
                mark={<DocGlyph className="w-[18px] h-[18px]" />}
                title={doc.title || 'Untitled'}
                active={page === key}
                onClick={() => setPage(key)}
              />
            ))}
          </Pick>
        )}

        {kind === 'board' && (
          <Pick label="Which board" empty="No boards yet">
            {boards.map(board => (
              <Row
                key={board.id}
                mark={<FrameGlyph className="w-[18px] h-[18px]" />}
                title={board.name || 'Untitled'}
                active={boardId === board.id}
                onClick={() => setBoardId(board.id)}
              />
            ))}
          </Pick>
        )}

        {kind === 'copy' && (
          <Field label="What to copy">
            <textarea
              ref={copyRef}
              rows={2}
              value={copy}
              onChange={e => setCopy(e.target.value)}
              placeholder="The bit everyone keeps looking up"
              className={AREA}
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
                {choices.map(agent => (
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
      </div>

      <Footer>
        <Primary label={tool ? 'Save' : 'Add to toolbox'} disabled={!ready} onClick={save} />
      </Footer>
    </>
  )
}
