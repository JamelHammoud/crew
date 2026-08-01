import CreditsRow from './CreditsRow'
import { Page, Section } from './parts'
import ReportRow from './ReportRow'
import VersionRow from './VersionRow'

export default function About() {
  return (
    <Page title="About">
      <Section>
        <VersionRow />
        <CreditsRow />
      </Section>
      <Section>
        <ReportRow />
      </Section>
    </Page>
  )
}
