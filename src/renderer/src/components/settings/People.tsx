import { useEffect, useState } from 'react'
import type { CurrentSession } from '../../../../shared/session'
import { CheckGlyph, LinkGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import { toast } from '../../state/toast'
import Avatar from '../Avatar'
import PhotoPicker from '../PhotoPicker'
import Pill from '../Pill'
import Toggle from '../Toggle'
import { folderLine, folderName } from '../../views/home/place'
import { Action, Page, Row, Section } from './parts'

export default function People() {
  const members = useCrew(s => s.members)
  const selfId = useCrew(s => s.selfId)
  const hosting = useCrew(s => s.hosting)
  const shared = useCrew(s => s.shared)
  const joinLink = useCrew(s => s.joinLink)
  const share = useCrew(s => s.share)
  const setMyPhoto = useCrew(s => s.setMyPhoto)
  const [session, setSession] = useState<CurrentSession | null>(null)

  useEffect(() => {
    void window.crew?.current?.().then(setSession)
  }, [shared])

  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link)
    toast.done('Link copied', { key: 'join-link' })
  }

  // Inviting people is one action rather than two, so the link is on the
  // clipboard by the time the row says the crew is open.
  const open = async (on: boolean) => {
    const link = await share(on)
    if (on && link) await copy(link)
  }

  const inProject = session?.home === 'folder'

  return (
    <Page title="People">
      <Section>
        <div className="space-y-0.5">
          {members.map(member => {
            const you = member.id === selfId
            const face = (
              <Avatar name={member.name} presence={member.connected ? 'online' : 'offline'} />
            )
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]"
              >
                {you ? (
                  <PhotoPicker has={Boolean(member.avatar)} onChange={setMyPhoto}>
                    {face}
                  </PhotoPicker>
                ) : (
                  face
                )}
                <span className="text-base font-semibold text-fg truncate">{member.name}</span>
                {you && <Pill glass>You</Pill>}
              </div>
            )
          })}
        </div>
      </Section>

      {(hosting || joinLink) && (
        <Section title="Joining">
          {hosting && (
            <Row label="Anyone with the link can join">
              <Toggle on={shared} label="Anyone with the link can join" onChange={on => void open(on)} />
            </Row>
          )}
          {joinLink && (
            <Row label="Link" line={<span className="font-mono mono-inline break-all">{joinLink}</span>}>
              <Action label="Copy" icon={<LinkGlyph />} onClick={() => void copy(joinLink)} />
            </Row>
          )}
        </Section>
      )}

      {session && (
        <Section title="Where this crew is kept">
          <Row
            label={inProject ? 'In the project' : 'In the Crew app'}
            line={
              inProject
                ? 'Everyone who has the project has the crew.'
                : 'Nothing is written into the project folder.'
            }
          />
          <Row
            label={folderName(session.folder)}
            line={<span className="font-mono mono-inline">{folderLine(session.folder)}</span>}
          >
            {session.synced && (
              <span className="flex items-center gap-1.5 text-sm text-fg/45">
                <CheckGlyph className="w-4 h-4" />
                Syncing
              </span>
            )}
          </Row>
        </Section>
      )}
    </Page>
  )
}
