import { useCrew } from '../../state/store'
import Avatar from '../Avatar'
import PhotoPicker from '../PhotoPicker'
import { useStanding } from '../presence'
import { Danger, Page, Row, Section } from './parts'

export default function You({ onDone }: { onDone: () => void }) {
  const selfName = useCrew(s => s.selfName)
  const connection = useCrew(s => s.connection)
  const hasPhoto = useCrew(s => Boolean(s.members.find(m => m.id === s.selfId)?.avatar))
  const setMyPhoto = useCrew(s => s.setMyPhoto)
  const leave = useCrew(s => s.leave)
  const standing = useStanding()

  return (
    <Page title={selfName || 'You'}>
      <div className="flex items-center gap-4 pb-2">
        <PhotoPicker has={hasPhoto} onChange={setMyPhoto}>
          <Avatar
            name={selfName || '?'}
            px={72}
            presence={connection === 'online' ? 'online' : 'offline'}
          />
        </PhotoPicker>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-fg truncate">{selfName}</p>
          <p className="text-sm text-fg/45">{standing}</p>
        </div>
      </div>

      <Section>
        <Row label="Leave this crew" line="It stays where it is, and so does everything in it.">
          <Danger
            label="Leave"
            onClick={() => {
              onDone()
              leave()
            }}
          />
        </Row>
      </Section>
    </Page>
  )
}
