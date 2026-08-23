import Spinner from '../../components/Spinner'
import TextField from '../../components/TextField'

export function CloneRepoAction({ busy, onClone }: { busy: boolean; onClone: () => void }) {
  return (
    <button
      onClick={onClone}
      disabled={busy}
      className="w-full h-10 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
    >
      {busy && <Spinner size={16} />}
      {busy ? 'Cloning' : 'Choose a folder'}
    </button>
  )
}

export default function CloneRepo({
  remote,
  busy,
  heading = true,
  action = true,
  onRemote,
  onClone
}: {
  remote: string
  busy: boolean
  heading?: boolean
  action?: boolean
  onRemote: (remote: string) => void
  onClone: () => void
}) {
  return (
    <div className="space-y-7">
      {heading && <h2 className="text-lg font-semibold text-fg text-center">Clone a Git repo</h2>}
      <div>
        <label className="block text-sm text-fg/45 mb-2" htmlFor="clone-repository-url">
          Repository URL
        </label>
        <TextField
          id="clone-repository-url"
          autoFocus
          glass
          value={remote}
          disabled={busy}
          onChange={event => onRemote(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onClone()
          }}
          placeholder="https://github.com/owner/project.git"
        />
      </div>
      {action && <CloneRepoAction busy={busy} onClone={onClone} />}
    </div>
  )
}
