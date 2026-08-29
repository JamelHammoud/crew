export default function RunAction({ label, onClick, solid = false }: { label: string; onClick: () => void; solid?: boolean }) {
  return (
    <div className="pl-14">
      <button
        type="button"
        onClick={onClick}
        className={`h-8 px-3 rounded-full text-sm transition-colors active:scale-[0.98] ${
          solid
            ? 'bg-fg text-ink-900 font-semibold hover:bg-fg/90'
            : 'border border-ink-700 text-fg-secondary hover:border-ink-600 hover:bg-fg/[0.04] hover:text-fg'
        }`}
      >
        {label}
      </button>
    </div>
  )
}
