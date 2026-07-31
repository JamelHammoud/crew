import CreditsRow from './CreditsRow'
import { Page, Section } from './parts'
import VersionRow from './VersionRow'

export default function About() {
  return (
    <Page title="About">
      <Section>
        <VersionRow />
        <CreditsRow />
      </Section>
    </Page>
  )
}
