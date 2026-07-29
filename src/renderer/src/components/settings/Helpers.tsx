import { useState } from 'react'
import { FAN_LIMIT, type Subagent } from '../../../../shared/subagents'
import { PencilGlyph, PlusGlyph } from '../../icons'
import { setHelperPrefs, useHelperPrefs } from '../../state/helpers'
import { useCrew } from '../../state/store'
import Modal from '../Modal'
import Select from '../Select'
import SubagentMark from '../SubagentMark'
import Toggle from '../Toggle'
import SubagentBuilder from '../subagents/SubagentBuilder'
import { Action, Page, Row, Section } from './parts'

// Two things live here and they belong to different people. The roles are the
// crew's, written once and shared the way the toolbox is. What helpers may do
// on this machine is yours alone, because a helper runs a real CLI here and it
// is your tokens and your files it spends.

const COUNTS = Array.from({ length: FAN_LIMIT }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? 'One at a time' : `Up to ${i + 1}`
}))

export default function Helpers() {
  const roles = useCrew(state => state.subagents)
  const prefs = useHelperPrefs()
  const [editing, setEditing] = useState<Subagent | null | undefined>(undefined)

  return (
    <Page title="Helpers">
      <Section>
        <Row
          label="Let agents send work out"
          line="Off, and no agent on this machine sends a helper out or takes one somebody else sent."
        >
          <Toggle on={prefs.on} label="Let agents send work out" onChange={on => setHelperPrefs({ on })} />
        </Row>
        {prefs.on && (
          <Row label="How many at once" line="Each one is another CLI running here.">
            <Select
              label="How many at once"
              value={String(prefs.fan)}
              options={COUNTS}
              onChange={value => setHelperPrefs({ fan: Number(value) })}
            />
          </Row>
        )}
      </Section>

      <Section title="What the crew can send out">
        {roles.length === 0 ? (
          <Row label="Nothing yet" line="A helper is one piece of work handed to an agent of its own.">
            <Action label="Write one" icon={<PlusGlyph />} onClick={() => setEditing(null)} />
          </Row>
        ) : (
          <>
            {roles.map(role => (
              <Row
                key={role.id}
                label={role.name}
                line={
                  <span className="flex items-center gap-2">
                    <SubagentMark seed={role.id} size="xs" />
                    <span className="truncate">{role.brief.split('\n')[0]}</span>
                  </span>
                }
              >
                <Action label="Edit" icon={<PencilGlyph />} onClick={() => setEditing(role)} />
              </Row>
            ))}
            <Row label="" >
              <Action label="Write another" icon={<PlusGlyph />} onClick={() => setEditing(null)} />
            </Row>
          </>
        )}
      </Section>

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'Edit helper' : 'New helper'}
        width={420}
        flush
      >
        <div className="h-[520px] max-h-[calc(100vh-200px)]">
          <SubagentBuilder role={editing ?? null} onDone={() => setEditing(undefined)} />
        </div>
      </Modal>
    </Page>
  )
}
