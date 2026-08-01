// Where the reading ends. It is the same button Implement plan is, in the same
// place at the foot of the same panel: one white pill the width of the column,
// standing in the layout rather than floating over it. On glass it was a pill
// inside a card, which is two rounded boxes for one press, and it covered the
// last lines of whatever was being read underneath.
//
// It stands only while there is something to commit. Nothing going in is
// nothing to say, and a dead field with a dead button under it was the first
// thing on the screen for the whole of the time there was nothing to save.
export default function CommitBar({ staged, onOpen }: { staged: number; onOpen: () => void }) {
  if (staged === 0) return null

  return (
    <div className="shrink-0 p-4">
      <button
        onClick={onOpen}
        className="h-11 w-full rounded-full bg-fg text-base font-semibold text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-[0.99]"
      >
        Commit {staged} {staged === 1 ? 'file' : 'files'}
      </button>
    </div>
  )
}
