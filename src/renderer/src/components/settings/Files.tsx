import { ATTACHMENT_MB_STEPS } from '../../../../shared/attachments'
import { useCrew } from '../../state/store'
import Select from '../Select'
import { Page, Row, Section } from './parts'

// How big a file may be is the crew's rather than this machine's, because the
// host is what turns a big one away and everything sent lands in the folder they
// share. Anyone here can change it and everyone gets the same number.

const SIZES = ATTACHMENT_MB_STEPS.map(mb => ({ value: String(mb), label: `${mb} MB` }))

export default function Files() {
  const mb = useCrew(s => s.attachmentMb)
  const setLimit = useCrew(s => s.setAttachmentLimit)

  return (
    <Page title="Files">
      <Section>
        <Row label="How big a file can be">
          <Select
            label="Up to"
            value={String(mb)}
            options={SIZES}
            onChange={value => setLimit(Number(value))}
          />
        </Row>
      </Section>
    </Page>
  )
}
