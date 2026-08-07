import { useEffect, useState } from 'react'
import { MUSIC_SETS, musicItems } from '../../../../shared/music'
import { SCHEDULABLE } from '../../../../shared/schedules'
import { STEP_LIMIT, type ToolAction } from '../../../../shared/toolbox'
import { agentsHere } from '../../design/askAgent'
import { PeopleGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import AgentIcon from '../AgentIcon'
import Select from '../Select'
import { TextArea } from '../TextField'
import { kindOf, TOOL_KINDS, type ToolKind } from '../toolKinds'
import { Empty, Label, Line, Picked, Scroller } from './parts'

const KINDS = TOOL_KINDS.filter(one => (SCHEDULABLE as readonly string[]).includes(one.kind))

const wordsOf = (action: ToolAction | null, kind: ToolKind): string =>
  action?.kind === kind && 'text' in action ? action.text : ''

export default function ScheduleDoes({
  kind,
  onKind,
  initial,
  onChange
}: {
  kind: ToolKind
  onKind: (kind: ToolKind) => void
  initial: ToolAction | null
  onChange: (action: ToolAction | null) => void
}) {
  const docs = useCrew(s => s.docs)
  const tools = useCrew(s => s.tools)
  const agents = useCrew(s => s.agents)
  const uploads = useMusic(s => s.uploads)
  const playlists = useMusic(s => s.playlists)
  const [ask, setAsk] = useState(wordsOf(initial, 'prompt'))
  const [post, setPost] = useState(wordsOf(initial, 'post'))
  const [say, setSay] = useState(wordsOf(initial, 'say'))
  const [task, setTask] = useState(wordsOf(initial, 'todo'))
  const [line, setLine] = useState(wordsOf(initial, 'note'))
  const [page, setPage] = useState(initial?.kind === 'note' ? initial.page : '')
  const [trackId, setTrackId] = useState(initial?.kind === 'music' ? (initial.trackId ?? '') : '')
  const [playlistId, setPlaylistId] = useState(initial?.kind === 'music' ? (initial.playlistId ?? '') : '')
  const [toolIds, setToolIds] = useState<string[]>(initial?.kind === 'chain' ? initial.toolIds : [])
  const [agentId, setAgentId] = useState<string | null>(
    initial?.kind === 'prompt' || initial?.kind === 'post' || initial?.kind === 'todo'
      ? (initial.agentId ?? null)
      : null
  )

  useEffect(() => {
    const built = (): ToolAction | null => {
      if (kind === 'prompt')
        return ask.trim() ? (agentId ? { kind: 'prompt', text: ask, agentId } : { kind: 'prompt', text: ask }) : null
      if (kind === 'post')
        return post.trim() ? (agentId ? { kind: 'post', text: post, agentId } : { kind: 'post', text: post }) : null
      if (kind === 'say') return say.trim() ? { kind: 'say', text: say } : null
      if (kind === 'todo')
        return task.trim() ? (agentId ? { kind: 'todo', text: task, agentId } : { kind: 'todo', text: task }) : null
      if (kind === 'note') return page && line.trim() ? { kind: 'note', page, text: line } : null
      if (kind === 'music') {
        if (playlistId) return { kind: 'music', playlistId }
        return trackId ? { kind: 'music', trackId } : null
      }
      return toolIds.length > 0 ? { kind: 'chain', toolIds } : null
    }
    onChange(built())
  }, [kind, ask, post, say, task, line, page, trackId, playlistId, toolIds, agentId, onChange])

  const tracks = musicItems(uploads)
  const lists = [...MUSIC_SETS, ...playlists]
  const here = agentsHere(agents)
  const named = agents.find(agent => agent.id === agentId)
  const choices = named && !here.includes(named) ? [...here, named] : here
  const pages = Object.entries(docs)

  // Whoever takes it, said inside the pill rather than over it. A label in a row
  // of its own would be the pill read back in longer words.
  const who = (label: string) => (
    <Select
      label={label}
      name={`${label} who`}
      value={agentId ?? ''}
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

  const words = (
    value: string,
    placeholder: string,
    label: string,
    onWrite: (text: string) => void
  ) => (
    <TextArea
      glass
      rows={2}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={event => onWrite(event.target.value)}
    />
  )

  return (
    <div className="space-y-3">
      <Line>
        <Select
          name="What it does"
          value={kind}
          options={KINDS.map(one => ({
            value: one.kind,
            label: one.title,
            hint: one.note,
            mark: <one.mark className="w-4 h-4" />
          }))}
          onChange={value => onKind(value as ToolKind)}
        />

        {(kind === 'prompt' || kind === 'post') && who('Ask')}
        {kind === 'todo' && who('For')}

        {kind === 'note' &&
          (pages.length > 0 ? (
            <Select
              label="In"
              name="Which doc"
              value={page}
              options={pages.map(([key, doc]) => ({ value: key, label: doc.title || 'Untitled' }))}
              onChange={setPage}
            />
          ) : (
            <Empty>No docs yet</Empty>
          ))}

        {kind === 'music' &&
          (lists.length + tracks.length > 0 ? (
            <Select
              label="Play"
              name="What to play"
              value={playlistId ? `list:${playlistId}` : trackId ? `track:${trackId}` : ''}
              options={[
                ...lists.map(list => ({
                  value: `list:${list.id}`,
                  label: list.name,
                  hint: `${list.trackIds.length} ${list.trackIds.length === 1 ? 'track' : 'tracks'}`
                })),
                ...tracks.map(track => ({ value: `track:${track.id}`, label: track.name, hint: track.mood }))
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

      {kind === 'prompt' && words(ask, 'Look at what came in overnight', 'What to ask', setAsk)}
      {kind === 'post' && words(post, "Sum up the week's changes", 'What to ask', setPost)}
      {kind === 'say' && words(say, 'Standup in ten minutes', 'What to say', setSay)}
      {kind === 'todo' && words(task, 'Read what the agents left overnight', 'What to add', setTask)}
      {kind === 'note' && words(line, 'Where everything got to today', 'What to write', setLine)}

      {kind === 'chain' && (
        <div>
          <Label>In the order you pick them</Label>
          {tools.length > 0 ? (
            <Scroller>
              {tools.map(tool => (
                <Picked
                  key={tool.id}
                  label={tool.name}
                  note={kindOf(tool.action.kind).title}
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
    </div>
  )
}
