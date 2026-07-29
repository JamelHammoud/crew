import { useMemo, useState } from 'react'
import { BRIEF_LIMIT, NAME_LIMIT, type Subagent } from '../../../../shared/subagents'
import { SparkGlyph, TrashGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import SubagentMark from '../SubagentMark'
import Tooltip from '../Tooltip'
import { AREA, Field, FIELD, Footer, HeaderButton, Primary, SheetHeader } from '../toolboxParts'

// A name, a brief, who runs it, and the model. The mark is drawn from the id
// and stands at the head with one control under it that draws another, so
// choosing a face is shuffling rather than shopping.

const uuid = (): string => crypto.randomUUID()

export default function SubagentBuilder({ role, onDone }: { role: Subagent | null; onDone: () => void }) {
  const agents = useCrew(state => state.agents)
  const addSubagent = useCrew(state => state.addSubagent)
  const editSubagent = useCrew(state => state.editSubagent)
  const removeSubagent = useCrew(state => state.removeSubagent)

  const [id, setId] = useState(() => role?.id ?? uuid())
  const [name, setName] = useState(role?.name ?? '')
  const [brief, setBrief] = useState(role?.brief ?? '')
  const [provider, setProvider] = useState(role?.provider ?? '')
  const [model, setModel] = useState(role?.settings?.model ?? '')

  // Only the CLIs somebody here actually has. A role naming one nobody runs is
  // a role that falls back to whoever asked for it, so there is nothing to gain
  // by offering it.
  const providers = useMemo(() => [...new Set(agents.map(agent => agent.provider))].sort(), [agents])
  const models = useMemo(() => {
    const agent = agents.find(one => one.provider === provider)
    return agent?.fields.find(field => field.key === 'model')?.options ?? []
  }, [agents, provider])

  const save = () => {
    const settings = model ? { model } : {}
    if (role) editSubagent(role.id, name, brief, provider || undefined, settings)
    else addSubagent(name, brief, provider || undefined, settings, id)
    onDone()
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader title={role ? 'Edit helper' : 'New helper'} onBack={onDone}>
        {role && (
          <HeaderButton
            label="Delete"
            danger
            onClick={() => {
              removeSubagent(role.id)
              onDone()
            }}
          >
            <TrashGlyph className="w-4 h-4" />
          </HeaderButton>
        )}
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <div className="flex flex-col items-center gap-2 py-2">
          <SubagentMark seed={id} size="lg" />
          {!role && (
            <Tooltip label="Another one">
              <button
                onClick={() => setId(uuid())}
                aria-label="Another one"
                className="w-8 h-8 rounded-field flex items-center justify-center text-fg/45 transition-all duration-150 hover:text-fg hover:bg-fg/[0.08] active:scale-95"
              >
                <SparkGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>

        <Field label="Name">
          <input
            value={name}
            maxLength={NAME_LIMIT}
            onChange={event => setName(event.target.value)}
            placeholder="Scout"
            className={FIELD}
          />
        </Field>

        <Field label="What it does">
          <textarea
            value={brief}
            maxLength={BRIEF_LIMIT}
            rows={5}
            onChange={event => setBrief(event.target.value)}
            placeholder="Reads through the project and comes back with what it found. It never edits anything."
            className={AREA}
          />
        </Field>

        <Field label="Runs on">
          <select
            value={provider}
            onChange={event => {
              setProvider(event.target.value)
              setModel('')
            }}
            className={FIELD}
          >
            <option value="">Whoever asked</option>
            {providers.map(one => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
        </Field>

        {models.length > 0 && (
          <Field label="Model">
            <select value={model} onChange={event => setModel(event.target.value)} className={FIELD}>
              {models.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Footer>
        <Primary label={role ? 'Save' : 'Add'} disabled={!name.trim() || !brief.trim()} onClick={save} />
      </Footer>
    </div>
  )
}
