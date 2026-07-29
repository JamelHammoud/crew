import { FAN_LIMIT } from '../../../../shared/subagents'
import { setHelperPrefs, useHelperPrefs } from '../../state/helpers'
import Select from '../Select'
import Toggle from '../Toggle'
import { Page, Row, Section } from './parts'

// What helpers may do on this machine, and nothing about what they are: an
// agent makes one up as it needs it, so there is no list here to keep. A helper
// runs a real CLI on your laptop, which is why this is yours rather than the
// crew's.

// Not every number up to the ceiling. A menu of twenty rows to pick a number is
// a menu nobody reads, and the steps between four and twenty are the ones worth
// having.
const STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 20]

const COUNTS = STEPS.filter(count => count <= FAN_LIMIT).map(count => ({
  value: String(count),
  label: count === 1 ? 'One at a time' : `Up to ${count}`
}))

export default function Helpers() {
  const prefs = useHelperPrefs()

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
    </Page>
  )
}
