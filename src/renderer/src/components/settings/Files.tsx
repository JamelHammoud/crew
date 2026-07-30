import { attachmentMbChoices, attachmentMbLabel } from '../../../../shared/attachments'
import { useCrew } from '../../state/store'
import Select from '../Select'
import { Page, Row, Section } from './parts'

// How big a file may be is the crew's rather than this machine's, because the
// host is what turns a big one away and everything sent lands in the folder they
// share. Anyone here can change it and everyone gets the same number.

export default function Files() {
  const mb = useCrew(s => s.attachmentMb)
  const shared = useCrew(s => s.shared)
  const setLimit = useCrew(s => s.setAttachmentLimit)
  const sizes = attachmentMbChoices(shared, mb).map(step => ({
    value: String(step),
    label: attachmentMbLabel(step)
  }))

  return (
    <Page title="Files">
      <Section>
        <Row label="Maximum file attachment size">
          <Select value={String(mb)} options={sizes} onChange={value => setLimit(Number(value))} />
        </Row>
      </Section>
    </Page>
  )
}
