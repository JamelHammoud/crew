import { FAN_LIMIT } from '../../../../shared/subagents'
import { setAwake, useAwake } from '../../state/awake'
import { setHelperPrefs, useHelperPrefs } from '../../state/helpers'
import Select from '../Select'
import Toggle from '../Toggle'
import CommandRow from './CommandRow'
import { Page, Row, Section } from './parts'

// What this machine does while Crew is open: whether it sleeps, what agents
// running here may do with your tokens and your files, and whether `crew` is on
// your PATH. All three are yours rather than the crew's, because they are about
// the laptop you are sitting at.

// Not every number up to the ceiling. A menu of twenty rows to pick a number is
// a menu nobody reads, and the steps between four and twenty are the ones worth
// having.
const STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 20]

const COUNTS = STEPS.filter(count => count <= FAN_LIMIT).map(count => ({
  value: String(count),
  label: count === 1 ? 'One at a time' : `Up to ${count}`
}))

export default function Machine() {
  const awake = useAwake()
  const prefs = useHelperPrefs()

  return (
    <Page title="This computer">
      <Section>
        <Row
          label="Keep this computer awake"
          line="Agents carry on working while you are away from it, and the screen still sleeps."
        >
          <Toggle on={awake} label="Keep this computer awake" onChange={setAwake} />
        </Row>
        <Row
          label="Let agents send work out"
          line="Off, and no agent on this machine sends a helper out or takes one somebody else sent."
        >
          <Toggle on={prefs.on} label="Let agents send work out" onChange={want => setHelperPrefs({ on: want })} />
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
        <CommandRow />
      </Section>
    </Page>
  )
}
