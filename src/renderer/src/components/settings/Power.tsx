import { setAwake, useAwake } from '../../state/awake'
import Toggle from '../Toggle'
import { Page, Row, Section } from './parts'

export default function Power() {
  const on = useAwake()

  return (
    <Page title="Power">
      <Section>
        <Row
          label="Keep this computer awake"
          line="Agents carry on working while you are away from it, and the screen still sleeps."
        >
          <Toggle on={on} label="Keep this computer awake" onChange={setAwake} />
        </Row>
      </Section>
    </Page>
  )
}
