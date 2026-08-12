import { useEffect, useRef, useState } from 'react'
import { MEMBER_NAME_LIMIT } from '../../../../shared/people'
import { useCrew } from '../../state/store'
import { PencilGlyph } from '../../icons'
import Avatar from '../Avatar'
import PhotoPicker from '../PhotoPicker'
import Pill from '../Pill'
import Tooltip from '../Tooltip'
import { useStanding } from '../presence'
import { Danger, Page, Row, Section } from './parts'

export default function You({ onDone }: { onDone: () => void }) {
  const selfName = useCrew(s => s.selfName)
  const connection = useCrew(s => s.connection)
  const hasPhoto = useCrew(s => Boolean(s.members.find(m => m.id === s.selfId)?.avatar))
  const setMyPhoto = useCrew(s => s.setMyPhoto)
  const renameSelf = useCrew(s => s.renameSelf)
  const leave = useCrew(s => s.leave)
  const standing = useStanding()
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const commit = () => {
    if (draft !== null) renameSelf(draft)
    setDraft(null)
  }

  return (
    <Page title={selfName || 'You'}>
      <div className="flex items-center gap-4 pb-2">
        <PhotoPicker has={hasPhoto} onChange={setMyPhoto}>
          <Avatar name={selfName || '?'} px={72} presence={connection === 'online' ? 'online' : 'offline'} />
        </PhotoPicker>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {editing ? (
              <input
                ref={input}
                value={draft}
                maxLength={MEMBER_NAME_LIMIT}
                aria-label="Your name"
                onChange={event => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={event => {
                  if (event.key === 'Enter') commit()
                  if (event.key === 'Escape') setDraft(null)
                }}
                className="w-48 h-9 rounded-full bg-fg/[0.07] px-3.5 text-lg font-semibold text-fg outline-none transition-colors focus:bg-fg/[0.14]"
              />
            ) : (
              <p className="text-lg font-semibold text-fg truncate">{selfName}</p>
            )}
            {import.meta.env.DEV && <Pill glass>DEV</Pill>}
            {!editing && (
              <Tooltip label="Rename">
                <button
                  onClick={() => setDraft(selfName)}
                  aria-label="Rename yourself"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-fg hover:bg-fg/[0.08] active:scale-95"
                >
                  <PencilGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
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
