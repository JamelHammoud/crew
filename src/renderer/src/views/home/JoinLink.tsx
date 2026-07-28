import Spinner from '../../components/Spinner'
import TextField, { FIELD } from '../../components/TextField'
import { FolderGlyph } from '../../icons'

// Somebody else's session. It still needs a folder on this machine, because
// that is where any agent you bring along does its work.
export default function JoinLink({
  link,
  folder,
  busy,
  onLink,
  onPickFolder,
  onJoin
}: {
  link: string
  folder: string | null
  busy: boolean
  onLink: (link: string) => void
  onPickFolder: () => void
  onJoin: () => void
}) {
  return (
    <div className="space-y-7">
      <h2 className="text-lg font-semibold text-fg text-center">Join a crew</h2>
      <div className="space-y-5">
        <div>
          <label className="block text-sm text-fg-muted mb-2">Join link</label>
          <TextField
            autoFocus
            value={link}
            onChange={e => onLink(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onJoin()
            }}
            placeholder="crew://100.64.1.2:2739/a1b2c3"
          />
        </div>
        <div>
          <label className="block text-sm text-fg-muted mb-2">Where your agents work</label>
          <button onClick={onPickFolder} className={`${FIELD} flex items-center gap-2.5 text-left hover:bg-ink-700`}>
            <FolderGlyph className="w-5 h-5 text-fg-muted shrink-0" />
            <span className={`truncate ${folder ? 'text-fg' : 'text-fg-muted'}`}>{folder ?? 'Choose a folder'}</span>
          </button>
        </div>
      </div>
      <button
        onClick={onJoin}
        disabled={busy}
        className="w-full h-12 rounded-full bg-fg text-ink-900 text-base font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
      >
        {busy && <Spinner size={16} />}
        Join
      </button>
    </div>
  )
}
