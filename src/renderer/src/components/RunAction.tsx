export default function RunAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="pl-14">
      <button
        type="button"
        onClick={onClick}
        className="h-8 px-3 rounded-full border border-ink-700 text-sm text-fg-secondary transition-colors hover:border-ink-600 hover:bg-fg/[0.04] hover:text-fg active:scale-[0.98]"
      >
        {label}
      </button>
    </div>
  )
}
