import { useState } from 'react'
import type { CrewHome } from '../../../../shared/project'
import { said } from '../../api/said'
import { FolderGlyph, LinkGlyph, PlusGlyph } from '../../icons'
import { useSidebar } from '../../state/sidebar'
import { useCrew } from '../../state/store'
import JoinLink from '../../views/home/JoinLink'
import WhereTo from '../../views/home/WhereTo'
import Modal from '../Modal'
import { MenuItem, Popover } from '../Popover'

export default function NewPlace({
  busy,
  onOpen
}: {
  busy: boolean
  onOpen: (folder: string, home?: CrewHome) => void
}) {
  const name = useCrew(s => s.selfName)
  const peek = useSidebar(s => s.peek)
  const [ways, setWays] = useState(false)
  const [asking, setAsking] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [link, setLink] = useState('')
  const [folder, setFolder] = useState<string | null>(() => localStorage.getItem('crew.folder'))
  const [going, setGoing] = useState(false)
  const [error, setError] = useState('')

  const pick = async () => {
    const picked = await window.crew.pickFolder()
    if (!picked) return
    peek(false)
    const plan = await window.crew.projectPlan(picked).catch(() => null)
    if (plan?.known) return onOpen(picked)
    setAsking(picked)
  }

  const join = async () => {
    const at = link.trim()
    if (!at) return setError('Paste the link first.')
    if (!folder) return setError('Pick a folder for your agents to work in.')
    setGoing(true)
    setError('')
    try {
      localStorage.setItem('crew.folder', folder)
      localStorage.setItem('crew.link', at)
      useCrew.getState().connect(await window.crew.join(at, folder, name))
      setLink('')
      setJoining(false)
    } catch (err) {
      setError(said(err))
    } finally {
      setGoing(false)
    }
  }

  return (
    <>
      <div className="app-no-drag shrink-0 px-4 pb-4 pt-2 flex flex-col gap-1">
        <button
          onClick={() => void pick()}
          className={`${ROW} bg-fg/[0.10] text-fg/70 hover:bg-fg/[0.14] hover:text-fg`}
        >
          <PlusGlyph className="w-4 h-4" />
          Open a folder
        </button>
        <button
          onClick={() => {
            peek(false)
            setError('')
            setJoining(true)
          }}
          className={`${ROW} text-fg/45 hover:bg-fg/[0.06] hover:text-fg`}
        >
          <LinkGlyph className="w-4 h-4" />
          Join with a link
        </button>
      </div>
      <Modal open={asking !== null} onClose={() => setAsking(null)} title="" width={520} flush>
        <div className="p-6">
          <WhereTo
            busy={busy}
            onPick={home => {
              const picked = asking
              setAsking(null)
              if (picked) onOpen(picked, home)
            }}
          />
        </div>
      </Modal>
      <Modal open={joining} onClose={() => setJoining(false)} title="" width={420} flush>
        <div className="p-6 space-y-4">
          <JoinLink
            glass
            link={link}
            folder={folder}
            busy={going}
            onLink={setLink}
            onPickFolder={async () => {
              const picked = await window.crew.pickFolder()
              if (picked) setFolder(picked)
            }}
            onJoin={() => void join()}
          />
          {error && <p className="text-sm text-danger animate-pop">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
