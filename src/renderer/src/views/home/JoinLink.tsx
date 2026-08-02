import Spinner from '../../components/Spinner'
import TextField, { FIELD, FIELD_GLASS } from '../../components/TextField'
import { FolderGlyph } from '../../icons'

// Somebody else's session. It still needs a folder on this machine, because
// that is where any agent you bring along does its work.
export default function JoinLink({
  link,
  folder,
  busy,
  glass,
  onLink,
  onPickFolder,
  onJoin
}: {
  link: string
  folder: string | null
  busy: boolean
  glass?: boolean
  onLink: (link: string) => void
  onPickFolder: () => void
  onJoin: () => void
}) {
  const quiet = glass ? 'text-fg/45' : 'text-fg-muted'
  const box = glass ? FIELD_GLASS : `${FIELD} hover:bg-ink-700`
  const size = glass ? 'h-10 text-sm' : 'h-12 text-base'

  return (
    <div className="space-y-7">
      <h2 className="text-lg font-semibold text-fg text-center">Join a crew</h2>
      <div className="space-y-5">
        <div>
          <label className={`block text-sm ${quiet} mb-2`}>Join link</label>
          <TextField
            autoFocus
            glass={glass}
            value={link}
            onChange={e => onLink(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onJoin()
            }}
            placeholder="crew://100.64.1.2:2739/a1b2c3"
          />
        </div>
        <div>
          <label className={`block text-sm ${quiet} mb-2`}>Where your agents work</label>
          <button onClick={onPickFolder} className={`${box} flex items-center gap-2.5 text-left`}>
            <FolderGlyph className={`w-5 h-5 ${quiet} shrink-0`} />
            <span className={`truncate ${folder ? 'text-fg' : quiet}`}>{folder ?? 'Choose a folder'}</span>
          </button>
        </div>
      </div>
      <button
        onClick={onJoin}
        disabled={busy}
        className={`w-full ${size} rounded-full bg-fg text-ink-900 font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100`}
      >
        {busy && <Spinner size={16} />}
        Join
      </button>
    </div>
  )
}
