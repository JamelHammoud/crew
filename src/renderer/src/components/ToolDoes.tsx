import { useEffect, useState } from 'react'
import { MUSIC_SETS, musicItems } from '../../../shared/music'
import { STEP_LIMIT, type ToolAction } from '../../../shared/toolbox'
import { agentsHere } from '../design/askAgent'
import { FrameGlyph } from '../design/glyphs'
import { DocGlyph, PeopleGlyph } from '../icons'
import { useMusic } from '../state/music'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import { Empty, Hint, Label, Line, Picked, Scroller } from './cardParts'
import Select from './Select'
import TextField, { TextArea } from './TextField'
import { TOOL_KINDS, type ToolKind } from './toolKinds'
import { useAutoResize } from './useAutoResize'

// How far a box of words grows before it scrolls inside itself. A tool is a
// sentence and a prompt is a paragraph, so the box follows what is written into
// it rather than standing at whatever height it opened on.
const GROWN = 200

// The kinds that hold words a blank can be written into, so the one line that
// says so is shown where it is worth something and nowhere else. It is written
// in braces itself, which is the whole of the explaining it needs.
const WORDY: ToolKind[] = ['web', 'terminal', 'file', 'prompt', 'post', 'say', 'todo', 'note', 'copy']

const wordsOf = (action: ToolAction | null, kind: ToolKind): string =>
  action?.kind === kind && 'text' in action ? action.text : ''

function Words({
  value,
  label,
  placeholder,
  mono,
  onWrite
}: {
  value: string
  label: string
  placeholder: string
  mono?: boolean
  onWrite: (text: string) => void
}) {
  const ref = useAutoResize(value, GROWN)
  return (
    <TextArea
      glass
      ref={ref}
      rows={2}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={event => onWrite(event.target.value)}
      className={`min-h-[60px] ${mono ? 'font-mono' : ''}`}
    />
  )
}

// What a tool does, and the one field or list the kind it is asks for. The
// toolbox and the schedules are the same question with different answers
// allowed, so `kinds` is what each one hands in rather than each holding a form
// of its own.
export default function ToolDoes({
  kinds,
  kind,
  onKind,
  initial,
  exclude,
  blanks,
  onChange
}: {
  kinds: readonly ToolKind[]
  kind: ToolKind
  onKind: (kind: ToolKind) => void
  initial: ToolAction | null
  // The tool being built, kept out of its own chain, or a press would be a tool
  // waiting on itself.
  exclude?: string
  blanks?: boolean
  onChange: (action: ToolAction | null) => void
}) {
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const tools = useCrew(s => s.tools)
  const agents = useCrew(s => s.agents)
  const uploads = useMusic(s => s.uploads)
  const playlists = useMusic(s => s.playlists)
  const [url, setUrl] = useState(initial?.kind === 'web' ? initial.url : '')
  const [external, setExternal] = useState(initial?.kind === 'web' && Boolean(initial.external))
  const [command, setCommand] = useState(initial?.kind === 'terminal' ? (initial.command ?? '') : '')
  const [path, setPath] = useState(initial?.kind === 'file' ? initial.path : '')
  const [copy, setCopy] = useState(wordsOf(initial, 'copy'))
  const [ask, setAsk] = useState(wordsOf(initial, 'prompt'))
  const [post, setPost] = useState(wordsOf(initial, 'post'))
  const [say, setSay] = useState(wordsOf(initial, 'say'))
  const [task, setTask] = useState(wordsOf(initial, 'todo'))
  const [line, setLine] = useState(wordsOf(initial, 'note'))
  const [page, setPage] = useState(
    initial?.kind === 'note' || initial?.kind === 'doc' ? initial.page : ''
  )
  const [boardId, setBoardId] = useState(initial?.kind === 'board' ? initial.boardId : '')
  const [trackId, setTrackId] = useState(initial?.kind === 'music' ? (initial.trackId ?? '') : '')
  const [playlistId, setPlaylistId] = useState(initial?.kind === 'music' ? (initial.playlistId ?? '') : '')
  const [toolIds, setToolIds] = useState<string[]>(initial?.kind === 'chain' ? initial.toolIds : [])
  const [agentId, setAgentId] = useState<string | null>(
    initial?.kind === 'prompt' || initial?.kind === 'post' || initial?.kind === 'todo'
      ? (initial.agentId ?? null)
      : null
  )

  const offered = TOOL_KINDS.filter(one => kinds.includes(one.kind))
  const tracks = musicItems(uploads)
  const lists = [...MUSIC_SETS, ...playlists]
  // An agent that has gone quiet is still worth showing while it is the one the
  // tool names, or opening a tool to change its wording would quietly take the
  // name off it.
  const here = agentsHere(agents)
  const named = agents.find(agent => agent.id === agentId)
  const choices = named && !here.includes(named) ? [...here, named] : here
  const pages = Object.entries(docs)
  const steps = tools.filter(one => one.id !== exclude)
  const whoId = choices.some(one => one.id === agentId) ? (agentId as string) : ''
  const heldPage = pages.some(([key]) => key === page) ? page : ''
  const heldBoard = boards.some(one => one.id === boardId) ? boardId : ''
  const track = tracks.some(one => one.id === trackId) ? trackId : ''
  const list = lists.some(one => one.id === playlistId) ? playlistId : ''
  const playing = list ? `list:${list}` : track ? `track:${track}` : ''

  useEffect(() => {
    const built = (): ToolAction | null => {
      if (kind === 'web')
        return url.trim() ? (external ? { kind: 'web', url, external: true } : { kind: 'web', url }) : null
      // A command is the one thing a tool can be built without: a terminal that
      // opens on a prompt is a tool.
      if (kind === 'terminal') return { kind: 'terminal', command }
      if (kind === 'file') return path.trim() ? { kind: 'file', path } : null
      if (kind === 'doc') return heldPage ? { kind: 'doc', page: heldPage } : null
      if (kind === 'board') return heldBoard ? { kind: 'board', boardId: heldBoard } : null
      if (kind === 'copy') return copy.trim() ? { kind: 'copy', text: copy } : null
      if (kind === 'prompt')
        return ask.trim() ? (whoId ? { kind: 'prompt', text: ask, agentId: whoId } : { kind: 'prompt', text: ask }) : null
      if (kind === 'post')
        return post.trim() ? (whoId ? { kind: 'post', text: post, agentId: whoId } : { kind: 'post', text: post }) : null
      if (kind === 'say') return say.trim() ? { kind: 'say', text: say } : null
      if (kind === 'todo')
        return task.trim() ? (whoId ? { kind: 'todo', text: task, agentId: whoId } : { kind: 'todo', text: task }) : null
      if (kind === 'note') return heldPage && line.trim() ? { kind: 'note', page: heldPage, text: line } : null
      if (kind === 'music') {
        if (list) return { kind: 'music', playlistId: list }
        return track ? { kind: 'music', trackId: track } : null
      }
      return toolIds.length > 0 ? { kind: 'chain', toolIds } : null
    }
    onChange(built())
  }, [
    kind,
    url,
    external,
    command,
    path,
    copy,
    ask,
    post,
    say,
    task,
    line,
    heldPage,
    heldBoard,
    track,
    list,
    toolIds,
    whoId,
    onChange
  ])

  const who = (label: string) => (
    <Select
      label={label}
      name={`${label} who`}
      value={whoId}
      options={[
        { value: '', label: 'Anyone', mark: <PeopleGlyph className="w-4 h-4" /> },
        ...choices.map(agent => ({
          value: agent.id,
          label: agent.label,
          mark: <AgentIcon seed={agent.id} size="xs" />
        }))
      ]}
      onChange={value => setAgentId(value || null)}
    />
  )

  const doc = (
    <Select
      name="Which doc"
      value={heldPage}
      options={[
        { value: '', label: 'Pick a doc' },
        ...pages.map(([key, held]) => ({
          value: key,
          label: held.title || 'Untitled',
          mark: <DocGlyph className="w-4 h-4" />
        }))
      ]}
      onChange={setPage}
    />
  )

  return (
    <div className="space-y-3">
      <Line>
        <Select
          name="What it does"
          value={kind}
          options={offered.map(one => ({
            value: one.kind,
            label: one.title,
            mark: <one.mark className="w-4 h-4" />
          }))}
          onChange={value => onKind(value as ToolKind)}
        />

        {kind === 'web' && (
          <Select
            label="Open in"
            name="Where it opens"
            value={external ? 'browser' : 'panel'}
            options={[
              { value: 'panel', label: 'Side panel' },
              { value: 'browser', label: 'Your browser' }
            ]}
            onChange={value => setExternal(value === 'browser')}
          />
        )}

        {(kind === 'prompt' || kind === 'post') && who('Ask')}
        {kind === 'todo' && who('For')}

        {(kind === 'doc' || kind === 'note') &&
          (pages.length > 0 ? doc : <Empty>No docs yet</Empty>)}

        {kind === 'board' &&
          (boards.length > 0 ? (
            <Select
              name="Which board"
              value={heldBoard}
              options={[
                { value: '', label: 'Pick a board' },
                ...boards.map(board => ({
                  value: board.id,
                  label: board.name || 'Untitled',
                  mark: <FrameGlyph className="w-4 h-4" />
                }))
              ]}
              onChange={setBoardId}
            />
          ) : (
            <Empty>No boards yet</Empty>
          ))}

        {kind === 'music' &&
          (lists.length + tracks.length > 0 ? (
            <Select
              name="What to play"
              value={playing}
              options={[
                { value: '', label: 'Pick a track or list' },
                ...lists.map(one => ({
                  value: `list:${one.id}`,
                  label: one.name,
                  hint: `${one.trackIds.length} ${one.trackIds.length === 1 ? 'track' : 'tracks'}`
                })),
                ...tracks.map(one => ({ value: `track:${one.id}`, label: one.name, hint: one.mood }))
              ]}
              onChange={value => {
                const [what, id] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)]
                setPlaylistId(what === 'list' ? id : '')
                setTrackId(what === 'track' ? id : '')
              }}
            />
          ) : (
            <Empty>Nothing on the shelf yet</Empty>
          ))}
      </Line>

      {kind === 'web' && (
        <TextField
          glass
          value={url}
          aria-label="Address"
          placeholder="figma.com"
          onChange={event => setUrl(event.target.value)}
        />
      )}

      {kind === 'file' && (
        <TextField
          glass
          value={path}
          aria-label="File"
          placeholder="src/renderer/src/App.tsx"
          className="font-mono"
          onChange={event => setPath(event.target.value)}
        />
      )}

      {kind === 'terminal' && (
        <Words value={command} label="Command" placeholder="yarn dev" mono onWrite={setCommand} />
      )}
      {kind === 'copy' && (
        <Words
          value={copy}
          label="What to copy"
          placeholder="The bit everyone keeps looking up"
          onWrite={setCopy}
        />
      )}
      {kind === 'prompt' && (
        <Words value={ask} label="What to ask" placeholder="Look at what came in overnight" onWrite={setAsk} />
      )}
      {kind === 'post' && (
        <Words value={post} label="What to ask" placeholder="Sum up the week's changes" onWrite={setPost} />
      )}
      {kind === 'say' && (
        <Words value={say} label="What to say" placeholder="Standup in ten minutes" onWrite={setSay} />
      )}
      {kind === 'todo' && (
        <Words
          value={task}
          label="What to add"
          placeholder="Read what the agents left overnight"
          onWrite={setTask}
        />
      )}
      {kind === 'note' && (
        <Words value={line} label="What to write" placeholder="Where everything got to today" onWrite={setLine} />
      )}

      {kind === 'chain' && (
        <div>
          <Label>In the order you pick them</Label>
          {steps.length > 0 ? (
            <Scroller>
              {steps.map(tool => (
                <Picked
                  key={tool.id}
                  label={tool.name}
                  picked={toolIds.includes(tool.id)}
                  order={toolIds.indexOf(tool.id) + 1 || undefined}
                  onClick={() =>
                    setToolIds(held =>
                      held.includes(tool.id)
                        ? held.filter(id => id !== tool.id)
                        : held.length < STEP_LIMIT
                          ? [...held, tool.id]
                          : held
                    )
                  }
                />
              ))}
            </Scroller>
          ) : (
            <Empty>Build a tool or two first</Empty>
          )}
        </div>
      )}

      {blanks && WORDY.includes(kind) && <Hint>{'Anything in {braces} is asked for first.'}</Hint>}
    </div>
  )
}
