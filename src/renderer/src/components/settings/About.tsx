import CreditsRow from './CreditsRow'
import FeedbackRow from './FeedbackRow'
import MadeBy from './MadeBy'
import { Page, Section } from './parts'
import VersionRow from './VersionRow'

export default function About() {
  return (
    <Page title="About">
      <Section>
        <VersionRow />
        <CreditsRow />
      </Section>
      <Section>
        <FeedbackRow />
      </Section>
      <MadeBy />
    </Page>
  )
}
