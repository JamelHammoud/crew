// Where the reading ends. It floats at the foot of the panel the way what is
// playing does, and only while there is something to save: nothing going in is
// nothing to say, and a dead field with a dead button under it was the first
// thing on the screen for the whole of the time there was nothing to commit.
export default function CommitBar({ staged, onOpen }: { staged: number; onOpen: () => void }) {
  if (staged === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
      <div className="glass pointer-events-auto animate-rise rounded-card p-1.5">
        <button
          onClick={onOpen}
          className="flex h-9 w-full items-center justify-center rounded-full bg-fg text-sm font-semibold text-ink-900 transition-colors duration-150 hover:bg-fg/90 active:scale-[0.98]"
        >
          Commit {staged} {staged === 1 ? 'file' : 'files'}
        </button>
      </div>
    </div>
  )
}
