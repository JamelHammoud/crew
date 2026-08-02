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

const lastFolder = (): string | null => {
  try {
    return globalThis.localStorage?.getItem('crew.folder') ?? null
  } catch {
    return null
  }
}

const keep = (folder: string, link: string): void => {
  try {
    globalThis.localStorage?.setItem('crew.folder', folder)
    globalThis.localStorage?.setItem('crew.link', link)
  } catch {
    return
  }
}

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
  const [folder, setFolder] = useState<string | null>(lastFolder)
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
      keep(folder, at)
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
      <div className="app-no-drag shrink-0 px-4 pb-4 pt-2">
        <button
          onClick={() => setWays(!ways)}
          aria-expanded={ways}
          className="w-full h-9 rounded-full flex items-center justify-center gap-2 text-sm font-medium bg-fg/[0.10] text-fg/70 transition-colors duration-150 hover:bg-fg/[0.14] hover:text-fg active:scale-[0.98]"
        >
          <PlusGlyph className="w-4 h-4" />
          New crew
        </button>
        <Popover open={ways} onClose={() => setWays(false)} align="center" side="top" className="min-w-44">
          <MenuItem
            icon={<FolderGlyph />}
            label="Open a folder"
            onClick={() => {
              setWays(false)
              void pick()
            }}
          />
          <MenuItem
            icon={<LinkGlyph />}
            label="Join with a link"
            onClick={() => {
              setWays(false)
              peek(false)
              setError('')
              setJoining(true)
            }}
          />
        </Popover>
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
