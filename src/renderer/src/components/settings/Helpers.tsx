import { useState } from 'react'
import { FAN_LIMIT, type Subagent } from '../../../../shared/subagents'
import { PencilGlyph, PlusGlyph } from '../../icons'
import { setHelperPrefs, useHelperPrefs } from '../../state/helpers'
import { useCrew } from '../../state/store'
import ScreenSwap from '../ScreenSwap'
import Select from '../Select'
import SubagentMark from '../SubagentMark'
import Toggle from '../Toggle'
import SubagentBuilder from '../subagents/SubagentBuilder'
import { Action, Page, Row, Section } from './parts'

// Two things live here and they belong to different people. The roles are the
// crew's, written once and shared the way the toolbox is. What helpers may do
// on this machine is yours alone, because a helper runs a real CLI here and it
// is your tokens and your files it spends.
//
// Writing one is a screen inside the page rather than a card over it. A dialog
// opened from a dialog is a second box to aim at for a choice that belongs to
// what is already in front of you, which is the toolbox builder's rule.

const COUNTS = Array.from({ length: FAN_LIMIT }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? 'One at a time' : `Up to ${i + 1}`
}))

function Roles({ onEdit }: { onEdit: (role: Subagent | null) => void }) {
  const roles = useCrew(state => state.subagents)

  return (
    <Section title="What the crew can send out">
      {roles.length === 0 ? (
        <Row label="Nothing yet" line="A helper is one piece of work handed to an agent of its own.">
          <Action label="Write one" icon={<PlusGlyph />} onClick={() => onEdit(null)} />
        </Row>
      ) : (
        <>
          {roles.map(role => (
            <Row
              key={role.id}
              label={role.name}
              line={<span className="block truncate">{role.brief.split('\n')[0]}</span>}
            >
              <Action label="Edit" icon={<PencilGlyph />} onClick={() => onEdit(role)} />
            </Row>
          ))}
          <div className="pt-4 flex justify-end">
            <Action label="Write another" icon={<PlusGlyph />} onClick={() => onEdit(null)} />
          </div>
        </>
      )}
    </Section>
  )
}

export default function Helpers() {
  const prefs = useHelperPrefs()
  const [editing, setEditing] = useState<Subagent | null | undefined>(undefined)
  const writing = editing !== undefined

  return (
    <Page title="Helpers">
      <ScreenSwap screen={writing ? `build:${editing?.id ?? 'new'}` : 'roles'} depth={writing ? 1 : 0}>
        {writing ? (
          <div className="rounded-card bg-fg/[0.04] overflow-hidden">
            <SubagentBuilder role={editing ?? null} onDone={() => setEditing(undefined)} />
          </div>
        ) : (
          <>
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
            <Roles onEdit={setEditing} />
          </>
        )}
      </ScreenSwap>
    </Page>
  )
}
