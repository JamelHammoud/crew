import { useEffect, useState } from 'react'
import { MUSIC_SETS, musicItems } from '../../../../shared/music'
import { SCHEDULABLE } from '../../../../shared/schedules'
import { STEP_LIMIT, type ToolAction } from '../../../../shared/toolbox'
import { agentsHere } from '../../design/askAgent'
import { PeopleGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import AgentIcon from '../AgentIcon'
import { TextArea } from '../TextField'
import { kindOf, TOOL_KINDS, type ToolKind } from '../toolKinds'
import { Choice, Field, Picked, Scroller } from './parts'

const KINDS = TOOL_KINDS.filter(one => (SCHEDULABLE as readonly string[]).includes(one.kind))

const wordsOf = (action: ToolAction | null, kind: ToolKind): string =>
  action?.kind === kind && 'text' in action ? action.text : ''

export default function ScheduleDoes({
  initial,
  onChange
}: {
  initial: ToolAction | null
  onChange: (action: ToolAction | null) => void
}) {
  const docs = useCrew(s => s.docs)
  const tools = useCrew(s => s.tools)
  const agents = useCrew(s => s.agents)
  const uploads = useMusic(s => s.uploads)
  const playlists = useMusic(s => s.playlists)
  const [kind, setKind] = useState<ToolKind>(initial?.kind ?? 'prompt')
  const [ask, setAsk] = useState(wordsOf(initial, 'prompt'))
  const [say, setSay] = useState(wordsOf(initial, 'say'))
  const [task, setTask] = useState(wordsOf(initial, 'todo'))
  const [line, setLine] = useState(wordsOf(initial, 'note'))
  const [page, setPage] = useState(initial?.kind === 'note' ? initial.page : '')
  const [trackId, setTrackId] = useState(initial?.kind === 'music' ? (initial.trackId ?? '') : '')
  const [playlistId, setPlaylistId] = useState(initial?.kind === 'music' ? (initial.playlistId ?? '') : '')
  const [toolIds, setToolIds] = useState<string[]>(initial?.kind === 'chain' ? initial.toolIds : [])
  const [agentId, setAgentId] = useState<string | null>(
    initial?.kind === 'prompt' || initial?.kind === 'todo' ? (initial.agentId ?? null) : null
  )

  useEffect(() => {
    const built = (): ToolAction | null => {
      if (kind === 'prompt')
        return ask.trim() ? (agentId ? { kind: 'prompt', text: ask, agentId } : { kind: 'prompt', text: ask }) : null
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
  }, [kind, ask, say, task, line, page, trackId, playlistId, toolIds, agentId, onChange])

  const tracks = musicItems(uploads)
  const lists = [...MUSIC_SETS, ...playlists]
  const here = agentsHere(agents)
  const named = agents.find(agent => agent.id === agentId)
  const choices = named && !here.includes(named) ? [...here, named] : here

  const who = (label: string) => (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        <Choice
          label="Anyone"
          mark={<PeopleGlyph className="w-4 h-4" />}
          picked={agentId === null}
          onClick={() => setAgentId(null)}
        />
        {choices.map(agent => (
          <Choice
            key={agent.id}
            label={agent.label}
            mark={<AgentIcon seed={agent.id} size="xs" />}
            picked={agentId === agent.id}
            onClick={() => setAgentId(agent.id)}
          />
        ))}
      </div>
    </Field>
  )

  return (
    <div className="space-y-3">
      <Field label="What it does">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(one => (
            <Choice
              key={one.kind}
              label={one.title}
              mark={<one.mark className="w-4 h-4" />}
              picked={kind === one.kind}
              onClick={() => setKind(one.kind)}
            />
          ))}
        </div>
      </Field>

      {kind === 'prompt' && (
        <Field label="What to ask">
          <TextArea
            rows={2}
            value={ask}
            aria-label="What to ask"
            placeholder="Look at what came in overnight"
            onChange={event => setAsk(event.target.value)}
          />
        </Field>
      )}

      {kind === 'say' && (
        <Field label="What to say">
          <TextArea
            rows={2}
            value={say}
            aria-label="What to say"
            placeholder="Standup in ten minutes"
            onChange={event => setSay(event.target.value)}
          />
        </Field>
      )}

      {kind === 'todo' && (
        <Field label="What to add">
          <TextArea
            rows={2}
            value={task}
            aria-label="What to add"
            placeholder="Read what the agents left overnight"
            onChange={event => setTask(event.target.value)}
          />
        </Field>
      )}

      {kind === 'note' && (
        <>
          <Field label="Which doc">
            <Scroller empty="No docs yet">
              {Object.entries(docs).map(([key, doc]) => (
                <Picked
                  key={key}
                  label={doc.title || 'Untitled'}
                  picked={page === key}
                  onClick={() => setPage(key)}
                />
              ))}
            </Scroller>
          </Field>
          <Field label="What to write">
            <TextArea
              rows={2}
              value={line}
              aria-label="What to write"
              placeholder="Where everything got to today"
              onChange={event => setLine(event.target.value)}
            />
          </Field>
        </>
      )}

      {kind === 'music' && (
        <Field label="What to play">
          <Scroller empty="Nothing on the shelf yet">
            {[
              ...lists.map(list => (
                <Picked
                  key={list.id}
                  label={list.name}
                  note={`${list.trackIds.length} ${list.trackIds.length === 1 ? 'track' : 'tracks'}`}
                  picked={playlistId === list.id}
                  onClick={() => {
                    setPlaylistId(list.id)
                    setTrackId('')
                  }}
                />
              )),
              ...tracks.map(track => (
                <Picked
                  key={track.id}
                  label={track.name}
                  note={track.mood}
                  picked={trackId === track.id}
                  onClick={() => {
                    setTrackId(track.id)
                    setPlaylistId('')
                  }}
                />
              ))
            ]}
          </Scroller>
        </Field>
      )}

      {kind === 'chain' && (
        <Field label="Which tools, in the order you pick them">
          <Scroller empty="Build a tool or two first">
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
        </Field>
      )}
    </div>
  )
}
