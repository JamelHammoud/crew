import Spinner from '../../components/Spinner'

export default function CrewAway({ busy, onRetry, onOwn }: { busy: boolean; onRetry: () => void; onOwn: () => void }) {
  return (
    <div className="space-y-7 text-center">
      <div>
        <h2 className="text-lg font-semibold text-fg">This crew is private</h2>
        <p className="mt-2 text-sm text-fg-muted text-balance">
          Ask whoever runs the project to add you, then try again.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onRetry}
          disabled={busy}
          className="h-11 px-6 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-colors duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
        >
          {busy && <Spinner size={14} />}
          Try again
        </button>
        <button
          onClick={onOwn}
          disabled={busy}
          className="text-sm font-semibold text-fg-muted transition-colors hover:text-fg active:scale-95 disabled:opacity-40"
        >
          Start a crew of your own
        </button>
      </div>
    </div>
  )
}
